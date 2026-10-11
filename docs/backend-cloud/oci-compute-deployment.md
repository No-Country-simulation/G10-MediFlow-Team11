# Despliegue de MediFlow en OCI Compute — Issue #59

Esta guía prepara el despliegue de Backend, PostgreSQL e IA Core en la instancia existente `MediFlow_Core_VM`. Reutiliza el único [`compose.yaml`](../../compose.yaml), PostgreSQL de #13, Backend de #53, IA Core de #72 y el cliente Backend → IA de #30. No crea infraestructura OCI, credenciales estáticas, otro Compose ni contratos funcionales.

**Estado:** preparación del repositorio. Los comandos de ejecución son para una sesión posterior autorizada en la VM. Ningún checklist marcado como pendiente acredita una validación realizada.

## 1. Prerrequisitos y revisión desplegada

- #12 debe proporcionar la VM operativa, SSH administrativo restringido, Docker Engine y Compose. El [registro de aprovisionamiento](./README.md#compute) describe Ubuntu 22.04 Minimal, Ampere `aarch64`, `VM.Standard.A1.Flex`, 2 OCPU y 12 GB RAM; volver a comprobar su estado antes del despliegue.
- La instancia debe pertenecer a `MediFlow_VM_Group` y tener la política existente para el bucket privado `mediflow-documentos-clinicos`. La preparación de #59 no modifica Dynamic Groups, IAM, VCN ni el bucket.
- Usar una revisión aprobada que incluya #13, #53, #72, PR #82 y la preparación de #59. Registrar el SHA real, sin desplegar cambios locales no revisados.
- Confirmar espacio para las imágenes y el volumen, salida HTTPS hacia registros de imágenes, dependencias de construcción, OCI y Gemini, y disponibilidad del puerto loopback del Backend.
- Confirmar el mecanismo HTTPS del MVP: hostname, certificado y proxy reales. Son datos del despliegue, no valores inventados por esta guía.

### Obtener el checkout y seleccionar el commit aprobado

Git y `python3` deben estar disponibles en el host Ubuntu; el preflight usa solo la biblioteca estándar de Python, sin instalar dependencias de aplicación. Elegir la ruta del checkout en la VM. Si ya hay un despliegue, reutilizar su directorio, conservar `.env.oci` y registrar previamente el nombre del proyecto Compose y la identidad del volumen PostgreSQL (secciones 2 y 9). No mover ni reemplazar un checkout existente para actualizarlo.

El siguiente bloque clona solo cuando la ruta no existe y selecciona un **SHA completo aprobado**, en detached HEAD. La revisión inicial obtenida por `clone` no es una autorización para construir o iniciar servicios. El acceso al repositorio debe usar los mecanismos Git del operador; no insertar tokens ni contraseñas en la URL.

```bash
read -r -p "Ruta elegida para el checkout en la VM: " DEPLOY_CHECKOUT
test -n "$DEPLOY_CHECKOUT" || exit 1
if [ ! -e "$DEPLOY_CHECKOUT" ]; then
  git clone -- https://github.com/No-Country-simulation/G10-MediFlow-Team11.git "$DEPLOY_CHECKOUT" || exit 1
fi
cd -- "$DEPLOY_CHECKOUT" || exit 1
checkout_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 1
test "$checkout_root" = "$(pwd -P)" || exit 1
case "$(git remote get-url origin)" in
  https://github.com/No-Country-simulation/G10-MediFlow-Team11.git|git@github.com:No-Country-simulation/G10-MediFlow-Team11.git) ;;
  *) printf '%s\n' 'origin no corresponde al repositorio de MediFlow.' >&2; exit 1 ;;
esac
worktree_status=$(git status --porcelain=v1 --untracked-files=all) || exit 1
if [ -n "$worktree_status" ]; then
  printf '%s\n' 'Checkout con cambios: detenerse sin stash, reset ni clean.' >&2
  exit 1
fi
read -r -p "SHA completo del commit aprobado para desplegar: " APPROVED_DEPLOY_SHA
[[ "$APPROVED_DEPLOY_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || exit 1
git fetch --no-tags origin "$APPROVED_DEPLOY_SHA" || exit 1
deploy_commit=$(git rev-parse --verify 'FETCH_HEAD^{commit}') || exit 1
test "$deploy_commit" = "${APPROVED_DEPLOY_SHA,,}" || exit 1
worktree_status=$(git status --porcelain=v1 --untracked-files=all) || exit 1
if [ -n "$worktree_status" ]; then
  printf '%s\n' 'Checkout con cambios: no seleccionar otra revisión.' >&2
  exit 1
fi
git switch --detach "$deploy_commit" || exit 1
test "$(git rev-parse HEAD)" = "$deploy_commit" || exit 1
git rev-parse HEAD
```

Registrar ese SHA y usarlo para todo el despliegue; no reemplazarlo con `origin/develop` ni el HEAD de una rama sin aprobación. Este bloque no ejecuta Compose ni toca volúmenes. Mantener después el mismo proyecto Compose registrado; el cambio de revisión Git no autoriza crear otro proyecto ni otro volumen.

En una sesión Bash en la raíz del checkout de la VM:

```bash
git status --short
git rev-parse HEAD
uname -m
docker --version
docker compose version
docker compose ls
df -h .
```

La arquitectura esperada es `aarch64`. Si faltan prerrequisitos de #12, reportarlos antes de continuar; no sustituirlos con aprovisionamiento dentro de #59.

## 2. Variables protegidas y proyecto Compose

Crear el archivo únicamente si no existe y restringir sus permisos:

```bash
umask 077
if [ ! -e .env.oci ]; then
  cp .env.example .env.oci
fi
chmod 600 .env.oci
git check-ignore .env.oci
stat -c '%a %n' .env.oci
```

Editar `.env.oci` localmente con los valores reales. `.gitignore` excluye `.env.oci`; no agregarlo a Git, copiarlo a imágenes ni compartir su contenido. Restringir también el acceso al host y al daemon Docker: las variables de contenedores pueden ser inspeccionadas por administradores. Usar comillas simples en `.env.oci` para valores que contengan un `$` literal; evitar expansión accidental o registrar secretos en la línea de comandos.

| Variable | Configuración en OCI |
| --- | --- |
| `DB_PASSWORD` | Contraseña propia, no vacía. Si ya existe el volumen, debe coincidir con la contraseña almacenada; cambiar el archivo no la rota. |
| `DB_NAME`, `DB_USER` | Conservar los valores del volumen existente. Defaults: `mediflow`, `mediflow_user`. |
| `OCI_BUCKET_NAME` | `mediflow-documentos-clinicos`, bucket existente y privado. |
| `OCI_NAMESPACE` | Namespace real del bucket. Obligatorio para almacenamiento en OCI, aunque Compose permita vacío en desarrollo local. |
| `OCI_REGION` | Región real del bucket; la infraestructura documentada utiliza `us-ashburn-1`. |
| `OCI_AUTH_MODE` | `instance_principal`. No usar `config_file` ni montar `~/.oci` en la VM. |
| `BACKEND_LAZY_INIT` | `false`, para no diferir errores de autenticación hasta el primer uso. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Clave y modelo habilitados para el entorno. `/health` puede pasar aunque estén vacíos. |
| `AUDIT_CONFIDENCE_THRESHOLD` | Umbral acordado; default `0.85`. |
| `BACKEND_PORT`, `DB_PORT`, `AI_CORE_PORT` | Puertos publicados en loopback; defaults `8080`, `5432`, `8000`. |

Compose usa el archivo indicado por `--env-file` para **interpolación**. Solo los valores declarados en `environment` llegan a cada servicio; no se inyecta todo el archivo. Backend recibe las cuatro variables OCI y los valores internos fijos `DB_HOST=postgres`, `DB_PORT=5432`, `SERVER_PORT=8080` y `MEDIFLOW_AI_SERVICE_URL=http://ai-core:8000`. La URL `localhost` de la plantilla sirve al Backend nativo local y no reemplaza la URL interna. IA Core recibe solo sus variables de Gemini y umbral.

Usar una sesión sin overrides heredados de despliegues anteriores: las variables del shell pueden prevalecer sobre el archivo. Conservar el nombre del proyecto Compose ya existente para reutilizar su volumen; elegir y registrar uno estable solo para el primer despliegue. Un nombre o directorio diferente puede seleccionar otro volumen y aparentar pérdida de datos.

```bash
read -r -p "Nombre estable del proyecto Compose: " COMPOSE_PROJECT_NAME
test -n "$COMPOSE_PROJECT_NAME" || exit 1
export COMPOSE_PROJECT_NAME
dc() { docker compose --env-file .env.oci "$@"; }
dc config --quiet
```

Mantener esa función y el mismo proyecto para los comandos siguientes. `config --quiet` valida sin imprimir secretos. No adjuntar `docker compose config`, `config --environment`, `printenv` ni inspecciones completas de contenedores como evidencia. Una validación estática exitosa no comprueba que el namespace, la contraseña almacenada o las API keys sean correctos.

### Preflight obligatorio de la configuración efectiva

Ejecutar este bloque en la misma sesión y directorio, después de definir el proyecto y antes de **cualquier build o arranque**. Resuelve Compose con el mismo `.env.oci` y entorno heredado que `dc`: respeta la precedencia del shell, las interpolaciones y los valores efectivamente enviados a cada servicio. No basta con inspeccionar el archivo `.env.oci`.

La configuración JSON y los diagnósticos de Compose se capturan únicamente en memoria. Los fallos de variables muestran solo sus nombres; otros errores de resolución tienen un mensaje genérico. No activar `set -x`, imprimir la configuración ni incluir valores en mensajes. Un fallo termina la sesión antes de continuar al build. Python no consulta OCI ni valida la autenticidad de las credenciales: comprueba modo, inicialización y presencia de valores.

```bash
command -v python3 >/dev/null 2>&1 || {
  printf '%s\n' 'Preflight: python3 no disponible.' >&2
  exit 1
}
python3 - <<'PY' || exit 1
import json
import re
import subprocess
import sys

names = (
    "OCI_AUTH_MODE", "SPRING_MAIN_LAZY_INITIALIZATION", "OCI_NAMESPACE",
    "DB_PASSWORD", "GEMINI_API_KEY", "GEMINI_MODEL",
)

def fail(invalid=()):
    message = "Preflight inválido: " + ", ".join(invalid) if invalid else "Preflight: configuración Compose no resoluble."
    print(message, file=sys.stderr)
    sys.exit(1)

try:
    result = subprocess.run(
        ["docker", "compose", "--env-file", ".env.oci", "config", "--format", "json"],
        capture_output=True, text=True, check=False,
    )
except OSError:
    fail()

if result.returncode != 0:
    fail([name for name in names if re.search(r"\b" + re.escape(name) + r"\b", result.stderr)])

try:
    services = json.loads(result.stdout)["services"]
    backend = services["backend"]["environment"]
    ai_core = services["ai-core"]["environment"]
    if not isinstance(backend, dict) or not isinstance(ai_core, dict):
        fail()
except (ValueError, KeyError, TypeError):
    fail()

invalid = []
if backend.get("OCI_AUTH_MODE") != "instance_principal":
    invalid.append("OCI_AUTH_MODE")
if str(backend.get("SPRING_MAIN_LAZY_INITIALIZATION")).lower() != "false":
    invalid.append("SPRING_MAIN_LAZY_INITIALIZATION")
for environment, name in (
    (backend, "OCI_NAMESPACE"), (backend, "DB_PASSWORD"),
    (ai_core, "GEMINI_API_KEY"), (ai_core, "GEMINI_MODEL"),
):
    value = environment.get(name)
    if value is None or not str(value).strip():
        invalid.append(name)
if invalid:
    fail(invalid)
print("Preflight OK.")
PY
```

Repetir el preflight si cambia el archivo, el entorno del shell, el proyecto o la revisión antes de construir/iniciar. Solo continuar a la sección 3 después de `Preflight OK.`.

## 3. Imágenes ARM64

Construir directamente en la VM ARM64. Las imágenes Java y Python conservan sus versiones y digests; comprobar los índices de las referencias exactas antes de construir:

```bash
awk '/^FROM/ {print $2}' backend/Dockerfile ai-core/Dockerfile |
while IFS= read -r image_ref; do
  docker buildx imagetools inspect "$image_ref"
done
docker buildx imagetools inspect postgres:17-alpine
dc build backend ai-core
```

Los índices deben incluir `linux/arm64`. IA instala `requirements.lock.txt` con hashes; verificar que las dependencias nativas también se instalen en ARM. No quitar hashes, cambiar Dockerfiles ni forzar `linux/amd64` para ocultar errores. Como alternativa, imágenes construidas y publicadas fuera de la VM deben incluir `linux/arm64`; esa publicación no forma parte de esta preparación.

## 4. Arranque y salud

```bash
dc up -d --wait --wait-timeout 180
dc ps
dc images
for service_name in postgres ai-core backend; do
  docker inspect --format '{{.Name}} health={{.State.Health.Status}} restarts={{.RestartCount}}' "$(dc ps -q "$service_name")"
done
dc exec -T backend curl -fsS http://127.0.0.1:8080/actuator/health
dc exec -T ai-core python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3).read().decode())"
```

Los tres contenedores deben estar `healthy`; Backend espera PostgreSQL e IA saludables. Backend debe devolver `status: UP` e IA `status: ok`. Comprobar las arquitecturas de las imágenes efectivamente utilizadas:

```bash
for service_name in postgres ai-core backend; do
  image_id=$(docker inspect --format '{{.Image}}' "$(dc ps -q "$service_name")")
  docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image_id"
done
```

`pg_isready` indica disponibilidad, no autenticación del Backend. El healthcheck de IA no valida Gemini. El healthcheck de Backend no prueba IA ni Object Storage. `depends_on` ordena el arranque; `restart: unless-stopped` reinicia procesos que terminan, no procesos vivos que permanecen `unhealthy`. Si arranque o salud fallan, investigar logs y permisos antes de reiniciar repetidamente.

## 5. Backend → PostgreSQL

Provocar una consulta mediante el endpoint existente y comprobar el origen de las conexiones:

```bash
dc exec -T backend curl -fsS http://127.0.0.1:8080/api/v1/documents/audit
docker inspect --format '{{range .NetworkSettings.Networks}}{{println .IPAddress}}{{end}}' "$(dc ps -q backend)"
dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT current_database(), current_user;"'
dc exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT application_name, client_addr, state FROM pg_stat_activity WHERE datname = current_database() AND client_addr IS NOT NULL;"'
```

La consulta HTTP debe responder `200` (un array vacío es válido). Comparar `client_addr` con la IP interna del Backend y registrar la conexión junto al health `UP`. El `psql` ejecutado dentro de PostgreSQL usa su socket local: por sí solo no prueba Backend → PostgreSQL. Usar exclusivamente datos sintéticos y retirar contenidos de documentos de la evidencia compartida.

El Backend mantiene `ddl-auto: update`: al iniciar puede crear o actualizar tablas. Para un volumen existente, conservar respaldo recuperable antes de desplegar una nueva revisión y registrar el esquema/datos de referencia. Esta guía no cambia la política de esquema ni introduce migraciones.

## 6. Backend → IA Core

Consultar desde el contenedor Backend, usando el DNS de Compose y el puerto interno:

```bash
dc exec -T backend curl -fsS http://ai-core:8000/health
dc exec -T backend curl -sS -w '\nHTTP %{http_code}\n' \
  -H 'Content-Type: application/json' \
  -d '{"document_id":"DEPLOY-CHECK"}' \
  http://ai-core:8000/api/v1/ai/process
```

La solicitud incompleta debe devolver `400` con `error.code=INVALID_REQUEST`; confirma acceso al endpoint sin invocar Gemini. Ambas consultas prueban conectividad HTTP desde Backend, no la ejecución de `AiCoreClient` ni un procesamiento válido.

El cliente de #30 usa `mediflow.ai.service-url`, con `MEDIFLOW_AI_SERVICE_URL` establecido por Compose. Su suite `AiCoreClientTest` comprueba el cliente con stubs en un entorno de desarrollo con JDK 21 (`cd backend` y `./mvnw -Dtest=AiCoreClientTest test`); no acredita red ni Gemini en la VM. No agregar un endpoint diagnóstico ni reimplementar #30 para el despliegue. Cuando la orquestación funcional esté disponible, registrar una solicitud sintética autorizada que invoque el cliente real. La validación end-to-end completa corresponde a #56; si falta un camino funcional para esa prueba, dejarla pendiente explícitamente.

## 7. Backend → OCI Object Storage

La autenticación usa `InstancePrincipalsAuthenticationDetailsProvider` del SDK existente. El contenedor necesita alcanzar metadata y los servicios regionales de autenticación/Object Storage. Las verificaciones del host realizadas en #12 no demuestran acceso desde el contenedor.

En la VM, comprobar metadata sin imprimir certificados ni identidad:

```bash
dc exec -T backend curl --noproxy 169.254.169.254 --max-time 5 \
  -fsS -o /dev/null -w 'metadata HTTP %{http_code}\n' \
  -H 'Authorization: Bearer Oracle' \
  http://169.254.169.254/opc/v2/instance/region
```

Un `200` demuestra reachability de IMDSv2, no permisos sobre el bucket. Si falla, revisar compatibilidad IMDS, rutas del bridge, firewall y proxy; reportar dependencias de #12 sin desactivar protecciones ni cambiar redes automáticamente. No usar claves privadas, `network_mode: host` ni inicialización perezosa como sustitutos de la verificación.

Para probar el SDK usado por **el Backend desplegado**, leer el contenido de un documento sintético ya existente, cuya fila apunte a un objeto real del bucket:

```bash
read -r -p "ID sintético existente, codificado como segmento URL: " DOCUMENT_ID_PATH
test -n "$DOCUMENT_ID_PATH" || exit 1
dc exec -T backend curl -fsS -o /dev/null -w 'contenido HTTP %{http_code}\n' \
  "http://127.0.0.1:8080/api/v1/documents/$DOCUMENT_ID_PATH/content"
```

Esperar `200` y registrar el ID de la fixture sin publicar su contenido ni claves internas. Esta prueba verifica lectura mediante la configuración de Instance Principals del Backend; un `404` no acredita almacenamiento y un `500` requiere diagnóstico.

Si no existe una fixture, dejar la prueba pendiente y coordinar su creación. La suite existente `ObjectStorageServiceIT`, habilitada con `RUN_OCI_IT=true`, **crea, lee y elimina un objeto**, además de arrancar Spring contra PostgreSQL. Requiere autorización para esas escrituras y una configuración de prueba explícita; ejecutarla como JVM separada no prueba automáticamente el contenedor desplegado. No habilitarla durante la preparación estática ni afirmar permisos de escritura/eliminación a partir de una lectura exitosa. Registrar esa evidencia separada cuando corresponda.

## 8. HTTPS y exposición de red

La arquitectura exige HTTPS en el despliegue y bucket privado. `compose.yaml` conserva los tres puertos en `127.0.0.1`; no publicar Backend, PostgreSQL o IA directamente en todas las interfaces. La red Compose es compartida y permite comunicación entre servicios; no constituye segmentación estricta de PostgreSQL respecto de IA.

Usar el proxy HTTPS del host si ya existe. Si falta, preparar su configuración en la fase de ejecución con el hostname y certificado confirmados; hasta entonces HTTPS es un bloqueo de aceptación, no una validación cumplida. No requiere otro Compose.

Requisitos del proxy:

- Terminar TLS en `443` con certificado válido para el hostname real, clave privada protegida y renovación comprobada.
- Redirigir HTTP a HTTPS en `80`, salvo las rutas necesarias para el mecanismo de emisión/renovación del certificado.
- Enviar la API a `127.0.0.1:<BACKEND_PORT real>`, preservando `/api/v1/...` y los métodos/cuerpos. No exponer todo Actuator: si se habilita `/actuator/health` para verificación externa, limitarlo a ese endpoint.
- Permitir el presupuesto síncrono de hasta 60 segundos de IA **más** transporte y PostgreSQL/OCI. Definir y verificar un timeout mayor a 60 segundos; 120 segundos es un punto de partida que debe ajustarse con evidencia, no una garantía extrema a extremo.
- Alinear límites de carga y configuración de origen del Frontend con los contratos existentes; no modificar esos contratos en #59.

En la VM:

```bash
dc port postgres 5432
dc port ai-core 8000
dc port backend 8080
sudo ss -lntp
```

Esperar `127.0.0.1` en los puertos publicados. Corroborar reglas OCI y firewall del host: SSH solo desde la fuente administrativa; `80/443` para el proxy; sin ingreso público para `5432`, `8000` ni `8080` (o los puertos configurados). Las reglas de red registradas durante el aprovisionamiento deben revisarse de nuevo, sin asumir vigencia.

Desde un equipo externo, usando la URL confirmada y el endpoint de health habilitado:

```bash
read -r -p "URL HTTPS real de health del MVP: " MVP_HEALTH_URL
case "$MVP_HEALTH_URL" in https://*) ;; *) exit 1 ;; esac
curl -fsS --max-time 15 "$MVP_HEALTH_URL"
```

No usar `-k`: la prueba debe validar el certificado. Registrar respuesta `UP`, cadena TLS y renovación; probar también la API a través del proxy y la ausencia de acceso externo directo a los puertos internos. Un curl local no demuestra exposición pública HTTPS.

## 9. Operación, logs y persistencia

Usar el mismo checkout, archivo de entorno y proyecto en cada sesión:

```bash
dc logs --tail 100 postgres backend ai-core
dc stop
dc start
dc ps
dc restart
dc ps
```

Tras `start` y `restart`, esperar `healthy` y repetir consultas de disponibilidad y conectividad. Comparar los contadores `RestartCount` durante una ventana de observación registrada; separar reinicios solicitados de reinicios inesperados. Revisar logs localmente y sanear datos/secretos antes de compartir evidencia.

Para retirar contenedores y red conservando el volumen:

```bash
dc down
dc up -d --wait --wait-timeout 180
```

**No usar `down -v`**, `docker volume rm` ni limpieza de volúmenes. El volumen `postgres_data` persiste después de `down`, pero no sustituye un respaldo. Registrar su identidad antes y después:

```bash
docker inspect --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}' "$(dc ps -q postgres)"
```

Antes y después del ciclo de detención/recreación, comparar una fila sintética previamente identificada o los conteos de `documents` y `document_triage_history`, sin actividad concurrente que cambie la comparación. No declarar persistencia solo porque existe un volumen. Para cambios de variables usar `dc up -d --wait --wait-timeout 180`; `restart` conserva el entorno anterior del contenedor.

## 10. Evidencia de aceptación de #59

Registrar fecha, operador, SHA desplegado, proyecto Compose, IDs de imágenes y resultados sanitizados. Mantener todos los puntos pendientes hasta ejecutar la verificación correspondiente en el entorno real.

- [ ] Dependencias #12, #13, #53 y #72 disponibles; revisión incluye PR #82 y preparación #59.
- [ ] Arquitectura ARM64 comprobada en host e imágenes; construcción exitosa.
- [ ] `.env.oci` ignorado, protegido, con namespace real, `instance_principal`, lazy init desactivado y secretos fuera de Git/imágenes.
- [ ] Tres servicios `healthy`; Backend `UP` e IA `ok`, sin reinicios inesperados en la ventana registrada.
- [ ] Backend → PostgreSQL comprobado mediante consulta HTTP y conexiones internas.
- [ ] Backend → IA: `/health` y `400 INVALID_REQUEST` desde el contenedor; ejecución del cliente real registrada aparte o pendiente identificada.
- [ ] Metadata accesible desde Backend y lectura de fixture OCI mediante el SDK desplegado; permisos de escritura/eliminación registrados aparte si se requieren.
- [ ] Bucket privado y Dynamic Group/política existentes comprobados para la instancia.
- [ ] HTTPS externo con certificado válido y proxy configurado; puertos PostgreSQL/IA/Backend sin exposición directa.
- [ ] Detención, inicio y reinicio reproducibles; misma identidad de volumen y datos conservados tras recreación.
- [ ] Evidencia distingue controles estáticos, pruebas de red, pruebas funcionales y pendientes para #56; no se cierra #59 con validación estática solamente.

Referencias: [arquitectura §§11–15](../ARCHITECTURE.md), [PostgreSQL](./postgresql-docker.md), [Backend](../../backend/README.md#contenerización-del-backend-issue-53), [IA Core](../../ai-core/README.md#ejecución-con-docker), [variables de Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/), [Instance Principals](https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/callingservicesfrominstances.htm).
