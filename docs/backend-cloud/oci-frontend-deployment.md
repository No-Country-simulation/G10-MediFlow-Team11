# Despliegue del Frontend en OCI

Guía para publicar y actualizar la aplicación React/Vite en `https://mediflowia.dev`. Caddy sirve los archivos estáticos desde la VM `MediFlow_Core_VM` descrita en la [guía de OCI Compute](./oci-compute-deployment.md); no requiere otra VM, otro proyecto Compose ni credenciales nuevas.

La configuración de Caddy es [`deploy/caddy/Caddyfile`](../../deploy/caddy/Caddyfile):

- `mediflowia.dev` sirve públicamente la SPA con fallback a `index.html` y publica solo los métodos y rutas de la API enumerados en la sección 4. `/actuator/health` sigue disponible; el resto de Actuator y las rutas de API ajenas a la allowlist responden `404`.
- `mediflow-core.duckdns.org` expone únicamente `/actuator/health`.
- El directorio del release activo se fija en dos directivas `root` del sitio `mediflowia.dev`.

Las implementaciones de #25, #31, #22 y #96 están integradas en `develop`. Esto acredita código disponible, **no** que la revisión actual de la VM tenga esos controladores ni que el flujo Frontend → Backend → IA/OCI/PostgreSQL funcione allí. El Caddyfile versionado prepara el acceso público por HTTPS, pero no acredita su aplicación en OCI. Hasta validar Caddy, revisión desplegada y pruebas externas, conservar la API activa bloqueada en la VM.

## 1. Requisitos y configuración del build

- Node.js y npm para compilar `frontend/`.
- PowerShell de Windows con OpenSSH (`ssh.exe`, `scp.exe`) y la clave privada autorizada en la VM.
- IP pública de la VM, obtenida de la consola OCI. No registrarla en el repositorio.
- Acceso SSH con `sudo` en la VM.

Antes de compilar, crear `frontend/.env.production.local`:

```dotenv
VITE_API_BASE_URL=https://mediflowia.dev
VITE_USE_MOCKS=false
```

Ambas variables se leen en `frontend/src/config/env.ts` y quedan incorporadas al bundle: **nunca incluir secretos en variables `VITE_*`**. `frontend/.gitignore` excluye `.env.*` (salvo `.env.example`) y `dist/`. Comprobarlo desde la raíz del repositorio:

```bash
git check-ignore frontend/.env.production.local frontend/dist/
```

## 2. Compilación

En PowerShell, desde `frontend/` en la revisión aprobada:

```powershell
npm ci
npm run lint
npm run test
npm run build
```

Comprobar que existen `dist/index.html` y `dist/assets/`, y que el bundle apunta a producción y no a `localhost`:

```powershell
Select-String -Path .\dist\assets\*.js -Pattern 'mediflowia.dev' -List
Select-String -Path .\dist\assets\*.js -Pattern 'localhost:8080' -List
```

La primera búsqueda debe devolver coincidencias; la segunda no debe devolver ninguna.

## 3. Transferencia e instalación de un release nuevo

Cada publicación usa un `RELEASE_ID` nuevo (por ejemplo, una fecha UTC o una versión). No reutilizar ni sobrescribir un release existente: los anteriores se conservan para el rollback.

En PowerShell, abrir la primera sesión SSH y mantenerla abierta:

```powershell
$vm = 'IP_PUBLICA_VM'
$sshKey = 'RUTA_CLAVE_PRIVADA'
& "$env:WINDIR\System32\OpenSSH\ssh.exe" -i $sshKey "ubuntu@$vm"
```

En Ubuntu, crear un directorio de staging que no exista:

```bash
umask 077
release_id='RELEASE_ID'
mkdir "$HOME/mediflow-frontend-upload-$release_id"
```

En una segunda terminal de PowerShell, desde `frontend/`:

```powershell
$vm = 'IP_PUBLICA_VM'
$sshKey = 'RUTA_CLAVE_PRIVADA'
$releaseId = 'RELEASE_ID'
& "$env:WINDIR\System32\OpenSSH\scp.exe" -i $sshKey -r '.\dist' "ubuntu@${vm}:/home/ubuntu/mediflow-frontend-upload-$releaseId/"
```

En Ubuntu, instalar el release. El script se detiene sin crear el destino si falta algún archivo del staging o si el destino ya existe. Aunque `dist/mocks` se transfiere, no se instala:

```bash
(
  set -euo pipefail
  release_id='RELEASE_ID'
  src="$HOME/mediflow-frontend-upload-$release_id/dist"
  dst="/srv/mediflow/frontend/releases/$release_id"
  test -f "$src/index.html"
  test -d "$src/assets"
  test -d "$src/brand"
  test -f "$src/favicon.svg"
  test -f "$src/icons.svg"
  sudo test -d /srv/mediflow/frontend/releases
  sudo test ! -e "$dst"
  sudo install -d -o root -g root -m 755 "$dst"
  sudo cp -R "$src/index.html" "$src/assets" "$src/brand" \
    "$src/favicon.svg" "$src/icons.svg" "$dst/"
  sudo chown -R root:root "$dst"
  sudo find "$dst" -type d -exec chmod 755 {} +
  sudo find "$dst" -type f -exec chmod 644 {} +
  sudo -u caddy test -r "$dst/index.html"
  sudo test ! -e "$dst/mocks"
  printf 'RELEASE_READY=%s\n' "$release_id"
)
```

Si la instalación falla después de crear el destino, queda un directorio de release parcial: no activarlo (no referenciarlo en `root`) ni sobrescribirlo automáticamente. Corregir la causa e instalar con un `RELEASE_ID` nuevo; el parcial solo se inspecciona y se retira manualmente, tras confirmar que el Caddyfile activo no lo referencia.

Si el build incorpora otros archivos públicos, añadirlos al comando `cp` y a las comprobaciones previas. No instalar documentos reales ni archivos de entorno. No borrar el staging ni los releases anteriores hasta completar la verificación (sección 5).

## 4. Activación del release

### Acceso público de la demostración

`mediflowia.dev` es público y debe recibir **exclusivamente documentos sintéticos**. El aviso discreto en el Frontend recuerda que no se debe ingresar información clínica real. La allowlist reduce la superficie expuesta; **no autentica ni limita la frecuencia**. HTTPS protege el transporte. Los `POST` y `PATCH` exigen `Origin: https://mediflowia.dev` para rechazar solicitudes de navegadores desde otros sitios; clientes automatizados pueden falsificar esa cabecera. No habilitar CORS para otros orígenes.

Antes de preparar el candidato en la VM, comprobar `caddy version` y validar `request_body max_size` y los matchers con ese binario. Confirmar con el responsable del entorno que los documentos ya almacenados y los usados en la demostración son sintéticos; la lectura pública de `/content` expone los originales existentes. El procesamiento público puede consumir la cuota y el presupuesto de Gemini mediante solicitudes repetidas, aun usando datos sintéticos. El límite de tamaño y la allowlist no son protección contra volumen. Antes de activar, revisar cuota/presupuesto y alertas del servicio Gemini, observar solicitudes y errores en los logs existentes y tener listo el rollback del Caddyfile para cerrar la API si aparece abuso. No registrar contenido de documentos ni claves en logs o evidencias.

El Caddy estándar no ofrece en esta configuración un límite de solicitudes por IP por intervalo. `max_conns_per_host` limita conexiones simultáneas al Backend, pero no la frecuencia total ni el consumo de Gemini. Una limitación real necesita un control de cuota en Backend o un componente externo y pruebas de concurrencia, reinicios y respuestas `429`; tratarla como tarea independiente antes de prometer resistencia a tráfico automatizado. Para esta demostración, conservar la ventana supervisada y el cierre operativo de la API como medida de contención.

Rutas públicas permitidas en `mediflowia.dev` (sin prefijo ni método adicional):

| Método | Ruta | Uso del Frontend |
| --- | --- | --- |
| GET | `/api/v1/documents`, `/api/v1/documents/audit` | selección y cola de auditoría |
| GET | `/api/v1/documents/{id}`, `/api/v1/documents/{id}/history`, `/api/v1/documents/{id}/content` | resultado, historial y original |
| POST | `/api/v1/documents/process-text`, `/api/v1/documents/process-file` | procesamiento síncrono |
| PATCH | `/api/v1/documents/{id}/review` | revisión clínica |

El Backend limita multipart a **10 MB por archivo** y **11 MB por solicitud**; Caddy limita el cuerpo de procesamiento a 11 MB. El proxy espera hasta **90 s por cabeceras** en procesamiento y revisión: el contrato de IA permite dos intentos de 30 s y el HTTP externo añade PostgreSQL, OCI y transporte. Un timeout no confirma si una operación de escritura llegó a persistirse; consultar el documento antes de reintentar. La aplicación no debe emitir rutas nuevas ni cambiar el modelo clínico para este despliegue.

El release activo es el que indican las dos directivas `root` del sitio `mediflowia.dev` en `deploy/caddy/Caddyfile` (`handle @assets` y el `handle` por defecto). Para activar un release nuevo:

1. En el repositorio, reemplazar en **ambas** directivas la ruta del release actual por `/srv/mediflow/frontend/releases/RELEASE_ID`, y revisar y aprobar el cambio. En PowerShell, desde la raíz del repositorio, comprobar que existen las dos directivas `root` y que ambas corresponden al release indicado:

   ```powershell
   $releaseId = 'RELEASE_ID'
   $roots = @(Select-String -Path .\deploy\caddy\Caddyfile -Pattern '^\s*root \* (\S+)' | ForEach-Object { $_.Matches[0].Groups[1].Value })
   if ($roots.Count -eq 2 -and @($roots | Sort-Object -Unique).Count -eq 1 -and $roots[0] -eq "/srv/mediflow/frontend/releases/$releaseId") { "ROOT_OK=$($roots[0])" } else { throw "Las directivas root no coinciden con el release: $($roots -join ', ')" }
   ```

2. Aplicar el Caddyfile versionado en el host con el procedimiento de [Caddy v2: configuración y exposición actual](./oci-compute-deployment.md#caddy-v2-configuración-y-exposición-actual): etapa 1 (`caddy_preparar`: respaldo protegido, candidato con el contenido íntegro del archivo, comprobación de dominios y `diff` contra el activo) y, tras revisar el `diff`, etapa 2 (`caddy_aplicar`: confirmación explícita, validación y `reload`). Si el archivo se copió desde Windows, normalizar antes los finales de línea (`sed -i 's/\r$//' ARCHIVO`) para que el `diff` muestre solo cambios reales. La diferencia prevista incluye acceso público, allowlist, límites y ruta del release; revisar cada una.
3. Para recargar Caddy no se reinicia Docker ni se toca PostgreSQL.

Restricciones al modificar el Caddyfile:

- Conservar `@reserved` (`/api`, `/api/*`, `/actuator`, `/actuator/*`) como denegación final. No publicar `/api/v1/*` de forma indiscriminada.
- Usar solo datos sintéticos ([`ARCHITECTURE.md` §15](../ARCHITECTURE.md#15-alcance-y-exclusiones-fuera-de-alcance-del-mvp)).
- Mantener `8080`, `8000` y `5432` sin exposición pública (sección 5).

## 5. Verificación

En PowerShell de Windows, externo a la VM, sin `-k` ni desactivar la validación TLS:

```powershell
curl.exe -sS --max-time 15 -o NUL -w "FRONTEND_HOME=%{http_code}`n" https://mediflowia.dev/
curl.exe -sS --max-time 15 -o NUL -w "MEDIFLOW_HEALTH=%{http_code}`n" https://mediflowia.dev/actuator/health
curl.exe -sS --max-time 15 -o NUL -w "DUCKDNS_HEALTH=%{http_code}`n" https://mediflow-core.duckdns.org/actuator/health
curl.exe -sS --max-time 15 -o NUL -w "API_AUDIT=%{http_code}`n" https://mediflowia.dev/api/v1/documents/audit
curl.exe -sS --max-time 15 -o NUL -w "DUCKDNS_API_BLOQUEADA=%{http_code}`n" https://mediflow-core.duckdns.org/api/v1/documents
```

Con la configuración nueva y un Backend actualizado se esperan `200`, `200`, `200`, `200` y `404` respectivamente (la cola puede estar vacía). Si la VM conserva una revisión anterior, la API puede seguir devolviendo `404`: registrar la revisión activa antes de interpretar resultados. Comprobar `200` en `/processing` y en las lecturas permitidas; `404` en `/actuator/env`, rutas ajenas a la tabla y métodos incorrectos, y rechazo de POST/PATCH sin el `Origin` esperado. Ejecutar una solicitud sintética solo cuando Backend, IA y OCI estén autorizados y actualizados. Un `200` en health o HTML no demuestra el flujo funcional.

Verificar también el JS del release publicado, usando el nombre real del build y no el de versiones anteriores (desde `frontend/`):

```powershell
$js = (Get-ChildItem .\dist\assets\index-*.js).Name
curl.exe -sS --max-time 15 -o NUL -w "FRONTEND_JS=%{http_code} %{content_type}`n" "https://mediflowia.dev/assets/$js"
```

Debe devolver `200` con `text/javascript`. Un `200` en el HTML no prueba el renderizado: abrir `https://mediflowia.dev` en el navegador, comprobar la navegación, recargar `/processing`, confirmar el aviso de datos sintéticos y revisar la consola.

Verificar en la VM que los servicios internos siguen sin exposición pública:

```bash
sudo ss -ltnp | grep -E ':(22|80|443|5432|8000|8080)[[:space:]]'
```

`5432`, `8000` y `8080` deben escucharse solo en `127.0.0.1`. Complementar con la Security List de OCI y las reglas de Ubuntu ([sección 8 de la guía de OCI Compute](./oci-compute-deployment.md#8-https-y-exposición-de-red)). El estado `UP` del Backend no acredita procesamiento, acceso a OCI ni consumo real de la API desde el Frontend.

## 6. Rollback

Los releases anteriores permanecen en `/srv/mediflow/frontend/releases/`; no se eliminan. Restaurar el Caddyfile respaldado antes de la activación devuelve el release que este apuntaba. Mantener abierta la sesión SSH y, si es posible, una segunda.

En Ubuntu, listar los respaldos existentes: `mediflow-backup.*` del procedimiento de Caddy actual e `issue88-backup.*` de la publicación inicial. El comodín se expande dentro de `sh` con `sudo`, porque los directorios de respaldo solo son accesibles para root:

```bash
sudo sh -c 'ls -ld --time-style=long-iso /etc/caddy/*-backup.*'
sudo sh -c 'ls -l --time-style=long-iso /etc/caddy/*-backup.*/Caddyfile'
```

Los sufijos son aleatorios, por lo que el orden alfabético no es cronológico. Cada respaldo contiene el Caddyfile que estaba activo al crearlo, y la fecha del directorio es la de creación del respaldo, no necesariamente la de una aplicación: una preparación que no llegó a aplicarse también deja uno. Para revertir un despliegue concreto, elegir el respaldo creado inmediatamente antes de él (su fecha consta en el registro operativo del host) y confirmar con el `diff` del script, respaldo frente a activo, que solo difiere en los cambios de ese despliegue, por ejemplo la ruta del release. No usar a ciegas el primero de la lista.

Sustituir el marcador por la ruta validada y ejecutar:

```bash
(
  set -euo pipefail
  backup='/etc/caddy/RESPALDO/Caddyfile'
  active='/etc/caddy/Caddyfile'
  install_atomic() {
    local new
    new=$(sudo mktemp /etc/caddy/Caddyfile.new.XXXXXX) || return 1
    if ! sudo cp --preserve=all -- "$1" "$new" \
       || ! sudo cmp -s -- "$1" "$new" \
       || ! sudo sync -- "$new" \
       || ! sudo mv -T -- "$new" "$active"; then
      sudo rm -f -- "$new"
      return 1
    fi
  }
  sudo test -f "$backup"
  sudo test -f "$active"
  sudo caddy validate --config "$backup" --adapter caddyfile
  diff_status=0
  sudo diff -u "$backup" "$active" || diff_status=$?
  if [ "$diff_status" -gt 1 ]; then
    echo "diff falló (código $diff_status): rollback detenido." >&2
    exit 1
  fi
  read -r -p 'Escribir RESTAURAR para confirmar rollback: ' confirmation
  test "$confirmation" = 'RESTAURAR'
  rescue=$(sudo mktemp /etc/caddy/Caddyfile.before-rollback.XXXXXX)
  sudo cp -a "$active" "$rescue"
  sudo cmp -s -- "$active" "$rescue"
  if ! install_atomic "$backup"; then
    echo "No se pudo sustituir el Caddyfile: el activo no se modificó y no requiere recuperación (copia previa: $rescue)." >&2
    exit 1
  fi
  if ! sudo caddy validate --config "$active" --adapter caddyfile || \
     ! sudo systemctl reload caddy; then
    echo 'Rollback fallido: restaurando la configuración que estaba activa.' >&2
    if ! install_atomic "$rescue"; then
      echo "INTERVENCIÓN MANUAL: no se pudo restaurar la configuración previa. El Caddyfile activo contiene el respaldo, que no validó o no recargó; la configuración anterior está en $rescue." >&2
      exit 1
    fi
    if sudo caddy validate --config "$active" --adapter caddyfile && sudo systemctl reload caddy; then
      echo "Configuración previa recuperada y recargada (copia: $rescue)." >&2
    else
      echo "INTERVENCIÓN MANUAL: se restauró la configuración previa (copia: $rescue), pero no validó o no recargó. Revisar $active y el estado de Caddy." >&2
    fi
    exit 1
  fi
  sudo systemctl is-active --quiet caddy
  printf 'ROLLBACK_CADDY=OK; COPIA_ANTES_DEL_ROLLBACK=%s\n' "$rescue"
)
```

El `diff` devuelve 1 cuando hay diferencias (esperado en un rollback); un código superior es un error y detiene el procedimiento antes de modificar nada.

El script no depende de funciones de otras guías. Sustituye el Caddyfile con el mismo mecanismo atómico que `caddy_instalar` de la [guía de OCI Compute](./oci-compute-deployment.md#caddy-v2-configuración-y-exposición-actual): copia temporal en `/etc/caddy`, comprobación con `cmp`, `sync` y renombrado, de modo que una copia interrumpida nunca deja un Caddyfile parcial. Guarda además una copia comprobada de la configuración previa (`Caddyfile.before-rollback.*`), que no se elimina. Si el script informa «INTERVENCIÓN MANUAL», no reiniciar Caddy: revisar el Caddyfile activo y la copia indicada.

Después:

1. Revertir el mismo cambio en `deploy/caddy/Caddyfile` del repositorio para que el archivo versionado describa lo activo.
2. Repetir las verificaciones de la sección 5 según las rutas de la configuración restaurada.

Sin respaldo disponible, recuperar el release anterior restableciendo sus rutas en las dos directivas `root` del Caddyfile versionado y aplicándolo como en la sección 4.

Un respaldo anterior a la publicación del Frontend (configuración solo de health) retira el sitio `mediflowia.dev`: usarlo solo si ese es el objetivo.

El rollback no modifica PostgreSQL, volúmenes de Compose, IA Core ni el firewall. Los respaldos residen en el host, no en Git.
