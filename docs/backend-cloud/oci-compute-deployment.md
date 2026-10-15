# Despliegue de MediFlow en OCI Compute

Esta guía documenta el despliegue y la operación de Backend, PostgreSQL e IA Core en la instancia existente `MediFlow_Core_VM`. Reutiliza el único [`compose.yaml`](../../compose.yaml), PostgreSQL de #13, Backend de #53, IA Core de #72 y el cliente Backend → IA de #30. No crea infraestructura OCI, credenciales estáticas, otro Compose ni contratos funcionales.

**Configuración actual del entorno de demostración del MVP:** Ubuntu 22.04 ARM64. Caddy termina HTTPS con la configuración versionada en [`deploy/caddy/Caddyfile`](../../deploy/caddy/Caddyfile): `mediflow-core.duckdns.org` publica solo `/actuator/health` y `mediflowia.dev` sirve el Frontend ([guía](./oci-frontend-deployment.md)). La API funcional permanece sin publicación pública en ambos dominios. El [registro de evidencias](./oci-compute-deployment-evidence.md) concentra fecha, revisión desplegada, fuentes, resultados y pendientes.

Los comandos de esta guía son procedimientos para sesiones operativas autorizadas; su inclusión no acredita que se hayan ejecutado. Registrar cada nueva verificación por separado, sin confundir despliegue (#59) con validación funcional end-to-end (#56).

## 1. Prerrequisitos y revisión desplegada

- #12 proporciona la VM existente, acceso SSH administrativo, Docker y Docker Compose. El [registro de aprovisionamiento](./README.md#compute) describe Ampere `aarch64`, `VM.Standard.A1.Flex`, 2 OCPU y 12 GB RAM. Revalidar capacidad disponible antes de nuevas construcciones; no confundir esa caracterización con una medición actual de RAM o disco.
- La instancia debe pertenecer a `MediFlow_VM_Group` y tener la política existente para el bucket privado `mediflow-documentos-clinicos`. La preparación de #59 no modifica Dynamic Groups, IAM, VCN ni el bucket.
- Usar una revisión aprobada que incluya #13, #53, #72, PR #82 y la preparación de #59. Consultar el SHA en el registro de evidencias; para una actualización registrar su nuevo SHA aprobado, sin desplegar cambios locales no revisados.
- Confirmar espacio para las imágenes y el volumen, salida HTTPS hacia registros de imágenes, dependencias de construcción, OCI y Gemini, y disponibilidad del puerto loopback del Backend.
- El mecanismo HTTPS actual es Caddy v2 en el host, con los dominios `mediflow-core.duckdns.org` (DuckDNS) y `mediflowia.dev` y certificados TLS públicos. Mantener la restricción de rutas descrita en la sección 8.

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

Mantener las variables sensibles fuera del repositorio en `.env.oci` protegido. Para operar la instalación existente, conservar ese archivo y su proyecto Compose; el siguiente bloque crea el archivo solo si falta.

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

El Issue #59 utiliza el nombre `AI_SERVICE_URL`; la propiedad implementada y conservada en el repositorio es `MEDIFLOW_AI_SERVICE_URL`. Esa diferencia de nomenclatura no requiere renombrar variables durante la operación.

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

### CLI y SDK Java aislado

Verificar con OCI CLI e Instance Principals desde un contenedor temporal en la red Docker del Backend la autenticación, el listado de objetos y `NoPublicAccess` del bucket. Conservar únicamente resultados sanitizados; no publicar namespace ni credenciales. Esa comprobación de red y permisos no sustituye una operación del SDK Java.

[`ObjectStorageServiceIT.java`](../../backend/src/test/java/com/mediflow/backend/service/ObjectStorageServiceIT.java) arranca Spring y utiliza el servicio de almacenamiento del repositorio para subir, leer, comparar y eliminar un JSON sintético. Para ejecutarla de forma aislada en una sesión autorizada:

1. Utilizar el código de la revisión aprobada y registrar la red Docker existente del Backend.
2. Preparar una imagen temporal con JDK 21 y Maven y un PostgreSQL de prueba separado; no adjuntar el volumen de producción ni apuntar sus variables `DB_*` a la base desplegada.
3. Proporcionar a esa imagen las variables de prueba mediante configuración protegida, con `OCI_AUTH_MODE=instance_principal`, el bucket/región existentes y el namespace real; no montar claves OCI estáticas ni imprimir secretos.
4. Desde `backend/` dentro de la imagen temporal, ejecutar el siguiente objetivo. Es un comando de reproducción, no una transcripción del comando exacto usado por el operador:

```bash
RUN_OCI_IT=true ./mvnw -B -Dtest=ObjectStorageServiceIT test
```

5. Registrar el resultado y limpiar únicamente los recursos temporales de esa prueba, sin tocar servicios, datos ni volúmenes del despliegue. La prueba escribe y elimina un objeto sintético del bucket; repetirla requiere autorización para esas operaciones.

### Diagnóstico y lectura por el Backend desplegado

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

Si no existe una fixture, crearla en una sesión autorizada: subir con OCI CLI e Instance Principals un objeto sintético sin sobrescritura, confirmar `content-length` y `content-type`, insertar una única fila válida que apunte a su clave y, tras la lectura, comparar el SHA-256 original con el recuperado. Esa escritura procede de OCI CLI, no del Backend. Al terminar, eliminar la fila y la versión específica del objeto, y comprobar que no quedan referencias, que el listado de versiones está vacío y que HEAD devuelve `404`. Hacer antes un respaldo de PostgreSQL. Sin autorización para crearla, dejar la lectura por endpoint pendiente. Una prueba Java aislada no acredita esa petición al contenedor de producción ni un flujo clínico completo. Registrar por separado CLI, SDK aislado, diagnóstico de metadata y endpoint en el documento de evidencias.

## 8. HTTPS y exposición de red

La arquitectura exige HTTPS en el despliegue y bucket privado. `compose.yaml` conserva los tres puertos en `127.0.0.1`; no publicar Backend, PostgreSQL o IA directamente en todas las interfaces. La red Compose es compartida y permite comunicación entre servicios; no constituye segmentación estricta de PostgreSQL respecto de IA.

### Responsabilidades y preparación del host

#12 aporta la instancia, Ubuntu ARM64, acceso administrativo, Docker/Compose y la infraestructura OCI existente (red, Security List e IAM). #59 configura el despliegue sobre esa base: Caddy v2, su ruta HTTPS, el dominio temporal y las aperturas 80/443 del firewall del host con persistencia. Las reglas OCI son un prerrequisito que debe coordinarse con infraestructura si falta; estos procedimientos no las modifican.

Los pasos de instalación siguientes son solo para un host que aún carezca de esos componentes y una sesión autorizada. En `MediFlow_Core_VM` ya configurada, comprobar y reutilizar lo existente; no reinstalar, actualizar paquetes ni reemplazar configuraciones como parte de una consulta de salud. Antes de instalar Caddy, comprobar que 80/443 no pertenecen a otro servicio y que el DNS confirmado apunta al host. El paquete inicia el servicio automáticamente: coordinar esa primera instalación y aplicar enseguida el [Caddyfile versionado](../../deploy/caddy/Caddyfile) con el procedimiento de esta sección.

En Ubuntu 22.04 con `dpkg --print-architecture` igual a `arm64`, usar el [repositorio estable oficial de Caddy](https://caddyserver.com/docs/install#debian-ubuntu-raspbian). Si ya existen la clave o la lista APT, verificar su origen y reutilizarlas; no sobrescribirlas con este bloque:

```bash
(
  set -o pipefail
  test "$(dpkg --print-architecture)" = arm64 || exit 1
  if command -v caddy >/dev/null 2>&1; then exit 1; fi
  test ! -e /usr/share/keyrings/caddy-stable-archive-keyring.gpg || exit 1
  test ! -e /etc/apt/sources.list.d/caddy-stable.list || exit 1
  sudo ss -lntp
  sudo apt-get update || exit 1
  sudo apt-get install debian-keyring debian-archive-keyring apt-transport-https curl gnupg || exit 1
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
    sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg || exit 1
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt |
    sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null || exit 1
  sudo chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list || exit 1
  sudo apt-get update || exit 1
  apt-cache policy caddy
  read -r -p "Versión 2.x aprobada del repositorio oficial mostrada arriba: " CADDY_PACKAGE_VERSION
  case "$CADDY_PACKAGE_VERSION" in 2.*) ;; *) exit 1 ;; esac
  sudo apt-get install "caddy=$CADDY_PACKAGE_VERSION" || exit 1
) || exit 1
caddy version
dpkg-query -W -f='${Version} ${Architecture}\n' caddy
systemctl is-active caddy
systemctl is-enabled caddy
```

Registrar la versión y arquitectura obtenidas; no atribuirlas retrospectivamente al despliegue registrado. Si el servicio no está activo, diagnosticar con `sudo journalctl -u caddy --no-pager -n 50` antes de continuar; sanear los logs antes de compartirlos.

### Caddy v2: configuración y exposición actual

Caddy v2 se ejecuta en el host Ubuntu y termina TLS en `443`. La configuración de referencia es [`deploy/caddy/Caddyfile`](../../deploy/caddy/Caddyfile); se instala como `/etc/caddy/Caddyfile` y no se reproduce en otros documentos. Define dos sitios:

- `mediflow-core.duckdns.org`, **dominio temporal del entorno de demostración del MVP**, no una solución definitiva de producción: solo `/actuator/health` llega al Backend; las demás rutas devuelven `404`.
- `mediflowia.dev`: sirve el Frontend estático ([guía](./oci-frontend-deployment.md)) y deja pasar al Backend únicamente `/actuator/health`; `/api`, `/api/*` y el resto de `/actuator` devuelven `404`.

HTTP redirige a HTTPS (`308`, comprobado en DuckDNS). Backend permanece en `127.0.0.1:8080`, IA Core en `127.0.0.1:8000` y PostgreSQL en `127.0.0.1:5432`. **La API funcional no está públicamente disponible en ningún dominio.** Un `200` interno de auditoría y un `404` público son compatibles con esta restricción.

El `Caddyfile` versionado contiene **todos** los sitios: aplicarlo siempre completo. Un archivo que omita `mediflowia.dev` deja sin servicio al Frontend. Antes de aplicarlo, comparar el versionado con el activo (`sudo diff -u`) y confirmar que solo cambian las líneas previstas.

Para aplicar el Caddyfile versionado de una revisión aprobada, el procedimiento se divide en dos etapas que se ejecutan por separado y en la misma sesión Bash: **preparar y revisar**, que no modifica el Caddyfile activo, y **aplicar**, que exige una confirmación explícita. No copiar ambas etapas en una sola operación. El [servicio oficial](https://caddyserver.com/docs/running#using-the-service) utiliza `/etc/caddy/Caddyfile`; verificarlo antes si existe una instalación personalizada.

`caddy_backup`, `caddy_service_user` y `caddy_candidate_sha` existen solo en la sesión Bash donde se asignan. Registrar la ruta de `caddy_backup` en el registro operativo protegido del host; en otra sesión, recuperar y comprobar esa ruta antes de restaurar. El directorio creado por `sudo mktemp -d` queda protegido en el host y no se elimina al cerrar Bash. Conservar propietario, grupo, permisos y demás atributos del Caddyfile original; comprobar la lectura con el usuario efectivo del servicio. Si no puede leerlo, detenerse y diagnosticar sin imponer permisos nuevos.

**Etapa 1: preparar y revisar.** Crea el respaldo protegido y un candidato, abre `sudoedit` para que el candidato contenga el contenido íntegro de `deploy/caddy/Caddyfile` de esa revisión, valida su sintaxis y comprueba que contiene los dos dominios analizando la configuración que interpreta Caddy, no el texto. Después muestra el `diff` contra el activo (código 0: sin diferencias; 1: diferencias; superior: error) y el SHA-256 del candidato. Si se añade o retira un sitio, actualizar la lista `required` del script.

```bash
caddy_preparar() {
  sudo test -f /etc/caddy/Caddyfile && sudo test ! -L /etc/caddy/Caddyfile || return 1
  caddy_service_user=$(systemctl show caddy --property=User --value) || return 1
  test -n "$caddy_service_user" || return 1
  if sudo test -e /etc/caddy/Caddyfile.candidate; then
    echo 'Existe un candidato residual: gestionarlo antes (ver "Candidato residual").' >&2
    return 1
  fi
  caddy_backup=$(sudo mktemp -d /etc/caddy/mediflow-backup.XXXXXX) || return 1
  sudo cp -a /etc/caddy/Caddyfile "$caddy_backup/Caddyfile" || return 1
  sudo cp -a /etc/caddy/Caddyfile /etc/caddy/Caddyfile.candidate || return 1
  sudoedit /etc/caddy/Caddyfile.candidate || return 1
  sudo cp --attributes-only --preserve=all "$caddy_backup/Caddyfile" /etc/caddy/Caddyfile.candidate || return 1
  sudo -u "$caddy_service_user" test -r /etc/caddy/Caddyfile.candidate || return 1
  sudo caddy validate --config /etc/caddy/Caddyfile.candidate --adapter caddyfile || return 1
  adapted=$(sudo caddy adapt --config /etc/caddy/Caddyfile.candidate --adapter caddyfile) || return 1
  printf '%s' "$adapted" | python3 -c '
import json
import sys

required = {"mediflow-core.duckdns.org", "mediflowia.dev"}

def hosts(node):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "host" and isinstance(value, list):
                yield from value
            else:
                yield from hosts(value)
    elif isinstance(node, list):
        for item in node:
            yield from hosts(item)

found = set(hosts(json.load(sys.stdin)))
missing = sorted(required - found)
if missing:
    print("Dominios ausentes en el candidato: " + ", ".join(missing), file=sys.stderr)
    sys.exit(1)
print("Dominios presentes: " + ", ".join(sorted(found)))
' || { echo 'El candidato no contiene todos los dominios requeridos.' >&2; return 1; }
  sudo diff -u /etc/caddy/Caddyfile /etc/caddy/Caddyfile.candidate
  diff_status=$?
  case "$diff_status" in
    0) echo 'Sin diferencias con el Caddyfile activo.' ;;
    1) echo 'Diferencias mostradas arriba.' ;;
    *) echo "diff falló (código $diff_status)." >&2; return 1 ;;
  esac
  caddy_candidate_sha=$(sudo sha256sum /etc/caddy/Caddyfile.candidate | awk '{print substr($1,1,12)}')
  test -n "$caddy_candidate_sha" || return 1
  echo "SHA-256 del candidato (12 primeros caracteres): $caddy_candidate_sha"
  echo 'Revisar el diff. Para aplicar, ejecutar caddy_aplicar por separado.'
}
caddy_preparar
```

Revisar el `diff` completo: solo deben cambiar las líneas previstas (por ejemplo, la ruta del release), sin ampliar rutas ni retirar ningún sitio. Si no es el previsto, no continuar y retirar el candidato como se indica en "Candidato residual".

**Etapa 2: aplicar.** Solo después de esa revisión, en un comando separado. Comprueba que el candidato no cambió desde la revisión, pide escribir los 12 primeros caracteres de su SHA-256 mostrados en la etapa 1 y, si coinciden, valida, sustituye el Caddyfile activo y recarga Caddy. Una confirmación vacía o incorrecta, incluida la que resulte de pegar más comandos a continuación, aborta sin cambios.

La sustitución es atómica (`caddy_instalar`): copia el origen a un archivo temporal del mismo directorio conservando propietario, permisos y atributos, comprueba que es idéntico y lo escribe en disco, y solo entonces lo renombra sobre `/etc/caddy/Caddyfile`. Una copia interrumpida o con error solo deja el temporal, que se elimina, y el activo no cambia. Ante un fallo posterior a la sustitución (lectura, validación o recarga) se restaura el respaldo con el mismo mecanismo.

```bash
caddy_instalar() {
  local nuevo
  nuevo=$(sudo mktemp /etc/caddy/Caddyfile.new.XXXXXX) || return 1
  if ! sudo cp --preserve=all -- "$1" "$nuevo" \
     || ! sudo cmp -s -- "$1" "$nuevo" \
     || ! sudo sync -- "$nuevo" \
     || ! sudo mv -T -- "$nuevo" /etc/caddy/Caddyfile; then
    sudo rm -f -- "$nuevo"
    return 1
  fi
}

caddy_aplicar() {
  test -n "${caddy_backup:-}" && test -n "${caddy_candidate_sha:-}" && test -n "${caddy_service_user:-}" || {
    echo 'Ejecutar antes caddy_preparar en esta sesión.' >&2
    return 1
  }
  sudo test -f /etc/caddy/Caddyfile.candidate || return 1
  current_sha=$(sudo sha256sum /etc/caddy/Caddyfile.candidate | awk '{print substr($1,1,12)}')
  if [ "$current_sha" != "$caddy_candidate_sha" ]; then
    echo 'El candidato cambió después de la revisión: repetir caddy_preparar.' >&2
    return 1
  fi
  read -r -p 'SHA-256 (12 caracteres) del candidato revisado para confirmar: ' confirmation
  if [ "$confirmation" != "$caddy_candidate_sha" ]; then
    echo 'Confirmación no válida: no se aplicó nada.' >&2
    return 1
  fi
  sudo caddy validate --config /etc/caddy/Caddyfile.candidate --adapter caddyfile || return 1
  caddy_instalar /etc/caddy/Caddyfile.candidate || {
    echo 'No se pudo sustituir el Caddyfile; el activo no se modificó.' >&2
    return 1
  }
  if ! sudo -u "$caddy_service_user" test -r /etc/caddy/Caddyfile \
     || ! sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile \
     || ! sudo systemctl reload caddy; then
    echo 'Fallo tras sustituir el Caddyfile: restaurando el respaldo.' >&2
    caddy_instalar "$caddy_backup/Caddyfile" || return 1
    sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile || return 1
    sudo systemctl reload caddy
    return 1
  fi
  unset caddy_candidate_sha
  sudo systemctl enable caddy || return 1
  sudo systemctl is-active caddy
  sudo systemctl is-enabled caddy
  sudo rm -- /etc/caddy/Caddyfile.candidate
}
caddy_aplicar
```

**Candidato residual.** Si `caddy_preparar` informa un `/etc/caddy/Caddyfile.candidate` previo (por una validación fallida, una revisión rechazada o una sesión interrumpida), primero inspeccionarlo sin modificar nada:

```bash
sudo ls -l /etc/caddy/Caddyfile.candidate
sudo diff -u /etc/caddy/Caddyfile /etc/caddy/Caddyfile.candidate
```

Solo si es un resto propio que ya no se necesita, retirar únicamente ese archivo. No tocar `/etc/caddy/Caddyfile`:

```bash
sudo rm -- /etc/caddy/Caddyfile.candidate
```

Conservar el respaldo hasta completar las comprobaciones externas de esta sección: health `200`, redirección `308` y ruta funcional `404` en DuckDNS, y las verificaciones de `mediflowia.dev` de la [guía del Frontend](./oci-frontend-deployment.md#5-verificación). Si falla alguna, diagnosticar y restaurar el archivo respaldado, validarlo y recargarlo con los mismos pasos; no reiniciar Caddy a ciegas ni ampliar rutas. Una validación fallida del candidato no altera la configuración activa.

Mantener esa restricción al operar el host. Antes de publicar cualquier ruta de la API, deben decidirse el acceso seguro, las rutas permitidas y los controles de acceso. No ampliar el proxy a `/api/v1/...` ni a todo Actuator como parte de una verificación de salud.

La renovación futura del certificado y la estrategia de actualización DuckDNS requieren verificación separada; no incluir tokens ni claves privadas en el registro. Para habilitar consumo funcional, verificar timeouts que contemplen hasta 60 segundos de IA más transporte y PostgreSQL/OCI, así como límites de carga y origen del Frontend, sin cambiar contratos. El health público no prueba ese procesamiento.

### Firewall OCI y Ubuntu

Conservar en la Security List de OCI `80/443` y SSH restringido al origen administrativo autorizado, cuyo valor no se publica. En Ubuntu, mantener los permisos `80/443` en `INPUT` **antes** de `REJECT` y su persistencia mediante `netfilter-persistent`. Backend, IA Core y PostgreSQL deben mantener sus enlaces loopback sin exposición pública directa en `8080/8000/5432`.

Las reglas OCI, las reglas de Ubuntu y las rutas de Caddy son controles complementarios. Preservarlos y revisar su estado en una sesión administrativa autorizada; esta guía no modifica reglas ni contiene IPs administrativas.

### Preparar INPUT y su persistencia sin alterar Docker

Mantener abierta la sesión SSH, disponer del acceso de recuperación administrativo y probar una segunda conexión antes de cerrar la primera. Conservar las reglas existentes de SSH, loopback y conexiones `ESTABLISHED,RELATED`, así como las reglas propias de OCI. No cambiar políticas, hacer flush, activar otro gestor de firewall ni modificar las cadenas `DOCKER*`, `FORWARD` o NAT. Estos pasos usan IPv4; si se habilita IPv6, revisar sus controles por separado antes de publicar un registro AAAA.

Comprobar primero los paquetes `netfilter-persistent` e `iptables-persistent` y la base persistente aprobada del host en `/etc/iptables/rules.v4`. Si faltan los paquetes, instalarlos **solo en la preparación inicial, antes de arrancar Docker**, evitando guardar automáticamente reglas activas:

```bash
printf '%s\n' \
  'iptables-persistent iptables-persistent/autosave_v4 boolean false' \
  'iptables-persistent iptables-persistent/autosave_v6 boolean false' |
  sudo debconf-set-selections
sudo apt-get install netfilter-persistent iptables-persistent || exit 1
```

En un host con Docker activo y sin esos paquetes, detener este procedimiento y coordinar una ventana de mantenimiento: la instalación puede cargar reglas. Si falta la base persistente o contiene reglas dinámicas de Docker, obtener/revisar la base del host con el responsable de infraestructura antes de continuar; no reconstruirla filtrando cadenas automáticamente.

Inspeccionar localmente y respaldar la base persistente; los respaldos pueden contener el origen administrativo y no deben adjuntarse a Git ni a las evidencias públicas:

`firewall_backup` también pertenece a la sesión Bash actual. Conservar su ruta en el registro operativo protegido y comprobarla si se retoma desde otra sesión; el directorio creado con `sudo mktemp -d` y sus respaldos permanecen protegidos en el host después de cerrar la sesión.

```bash
sudo iptables --version
sudo iptables -w -L INPUT -n --line-numbers
sudo test -s /etc/iptables/rules.v4 || exit 1
firewall_backup=$(sudo mktemp -d /etc/iptables/mediflow-backup.XXXXXX) || exit 1
sudo cp -a /etc/iptables/rules.v4 "$firewall_backup/rules.v4" || exit 1
sudo sh -c 'iptables-save > "$1/active.v4"' sh "$firewall_backup" || exit 1
```

El snapshot activo es solo diagnóstico protegido, **no** el archivo que se restaurará al iniciar. Para cada puerto, si ya existe un permiso efectivo antes del `REJECT`, omitir su inserción. Si falta, leer la posición actual del rechazo y añadir solo ese permiso; volver a listar antes del siguiente puerto porque cambian los números. No reutilizar las posiciones históricas 5/6/7:

```bash
read -r -p "Puerto que falta permitir (80 o 443): " WEB_PORT
case "$WEB_PORT" in 80|443) ;; *) exit 1 ;; esac
sudo iptables -w -L INPUT -n --line-numbers
read -r -p "Número actual de la regla REJECT, revisado arriba: " INPUT_REJECT_POSITION
[[ "$INPUT_REJECT_POSITION" =~ ^[1-9][0-9]*$ ]] || exit 1
sudo iptables -w -I INPUT "$INPUT_REJECT_POSITION" -p tcp --dport "$WEB_PORT" -j ACCEPT || exit 1
sudo iptables -w -L INPUT -n --line-numbers
```

Para persistir, usar `sudoedit /etc/iptables/rules.v4` y añadir únicamente estas líneas dentro de la tabla `*filter`, antes del `-A INPUT ... -j REJECT` correspondiente; omitir las que ya estén bien ubicadas. Preservar todas las demás reglas y el `COMMIT`:

```text
-A INPUT -p tcp --dport 80 -j ACCEPT
-A INPUT -p tcp --dport 443 -j ACCEPT
```

Revisar localmente el diff contra el respaldo y comprobar que solo cambian esos permisos. [`iptables-restore --test`](https://manpages.debian.org/bookworm/iptables/iptables-restore.8.en.html) valida sin aplicar; habilitar la carga en el próximo arranque, sin recargar el firewall ahora:

```bash
sudo diff -u "$firewall_backup/rules.v4" /etc/iptables/rules.v4
sudo iptables-restore --test /etc/iptables/rules.v4 || exit 1
sudo systemctl enable netfilter-persistent || exit 1
systemctl is-enabled netfilter-persistent
sudo iptables -w -C INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -w -C INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -w -L INPUT -n --line-numbers
```

`-C` comprueba presencia, no orden: revisar que ambos permisos precedan al rechazo. No ejecutar `netfilter-persistent save` sobre Docker activo: guarda las reglas cargadas, incluidas las dinámicas. Tampoco ejecutar `netfilter-persistent reload/start/restart`, `iptables-restore` sin `--test` ni restaurar el snapshot completo sobre Docker en marcha. [Docker requiere conservar sus reglas](https://docs.docker.com/engine/network/packet-filtering-firewalls/) y la carga de la base por [`netfilter-persistent`](https://manpages.debian.org/bookworm/netfilter-persistent/netfilter-persistent.8.en.html) debe coordinarse para no sobrescribirlas.

El reboot exitoso registrado no acredita una comprobación específica del orden de arranque entre ambos servicios. Esa revisión sigue sin evidencia: en una sesión autorizada, inspeccionar `systemctl cat netfilter-persistent docker` y `systemctl show netfilter-persistent docker --property=After --property=Before --property=Wants --property=Requires`, incluidas personalizaciones. Revisar la relación efectiva antes de cambiar la carga persistente; no inferirla ni modificar dependencias systemd automáticamente.

Si falla la validación del archivo, restaurar únicamente su copia persistente antes de cualquier reboot; no restaurar tablas activas completas. Verificar segunda conexión SSH, HTTPS y salud de Compose. Comprobar persistencia con el siguiente reboot autorizado mediante la sección 9; no afirmar esa prueba solo por habilitar el servicio. Ante un fallo, conservar la sesión administrativa y diagnosticar antes de retirar exclusivamente una regla recién añadida e identificada.

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
MVP_HEALTH_URL='https://mediflow-core.duckdns.org/actuator/health'
curl -fsS -D - --max-time 15 "$MVP_HEALTH_URL"
curl -sS -o /dev/null -w 'HTTP %{http_code}\n' --max-time 15 \
  http://mediflow-core.duckdns.org/actuator/health
curl -sS -o /dev/null -w 'API pública HTTP %{http_code}\n' --max-time 15 \
  https://mediflow-core.duckdns.org/api/v1/documents/audit
```

Esperar `UP` por HTTPS, `308` por HTTP (sin `-L`, para observar la redirección) y `404` en la ruta funcional pública. No usar `-k`: la consulta HTTPS debe validar el certificado. Estos son comandos de repetición; no implican acceso funcional a la API ni una prueba de renovación. Un curl local no demuestra exposición pública HTTPS.

## 9. Operación, logs y persistencia

Usar el mismo checkout, archivo de entorno y proyecto en cada sesión. Consultar los logs no modifica los servicios:

```bash
dc logs --tail 100 postgres backend ai-core
```

Los tres comandos siguientes son operaciones **alternativas e independientes**: ejecutar solo la que se necesita y no copiarlos consecutivamente. `dc stop` detiene los tres servicios y la aplicación deja de responder hasta un `dc start`.

Detener los contenedores (interrumpe el servicio):

```bash
dc stop
```

Iniciar contenedores detenidos previamente con `dc stop`:

```bash
dc start
dc ps
```

Reiniciar los contenedores en una sola operación, sin `stop` previo:

```bash
dc restart
dc ps
```

Tras `start` y `restart`, esperar `healthy` y repetir consultas de disponibilidad y conectividad. Comparar los contadores `RestartCount` durante una ventana de observación registrada; separar reinicios solicitados de reinicios inesperados. Revisar logs localmente y sanear datos/secretos antes de compartir evidencia.

Para la ventana de observación, repetir en varios momentos y registrar la hora UTC de cada medición:

```bash
date -u '+%Y-%m-%dT%H:%M:%SZ'
for service_name in backend ai-core postgres; do
  docker inspect --format '{{.Name}} health={{.State.Health.Status}} restarts={{.RestartCount}} started={{.State.StartedAt}}' "$(dc ps -q "$service_name")"
done
```

`RestartCount` constante y `StartedAt` sin cambios entre mediciones indican ausencia de reinicios en esos puntos, no monitoreo continuo.

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

### Respaldos antes de una actualización

Conservar los respaldos fuera del checkout y con acceso restringido. El siguiente procedimiento crea un **nuevo** respaldo en formato custom, sin presuponer una ruta del servidor:

```bash
read -r -p "Directorio existente y autorizado para respaldos fuera del checkout: " BACKUP_DIRECTORY
test -d "$BACKUP_DIRECTORY" || exit 1
backup_root=$(cd -- "$BACKUP_DIRECTORY" && pwd -P) || exit 1
checkout_root=$(git rev-parse --show-toplevel) || exit 1
case "$backup_root/" in
  "$checkout_root/"*) printf '%s\n' 'El respaldo debe quedar fuera del checkout.' >&2; exit 1 ;;
esac
backup_file="$backup_root/mediflow-$(date -u +%Y%m%dT%H%M%SZ).dump"
test ! -e "$backup_file" || exit 1
umask 077
if ! dc exec -T postgres sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"; then
  printf '%s\n' 'Respaldo fallido; no continuar con la actualización.' >&2
  exit 1
fi
chmod 600 "$backup_file"
test -s "$backup_file" || exit 1
dc exec -T postgres pg_restore --list < "$backup_file" > /dev/null || exit 1
```

La inspección del catálogo no restaura la base ni sustituye una prueba de restauración aislada. No borrar volúmenes ni esquemas del despliegue para probar persistencia. La limpieza de una fixture debe limitarse al esquema de prueba identificado y autorizado; no ejecutar una limpieza genérica de la base.

### Recuperación después de reboot

Después de un reboot autorizado, reconectar mediante el acceso SSH existente, volver al mismo checkout, proyecto y archivo de entorno y repetir el preflight de la sección 2. Comprobar servicios del host y estado del despliegue sin cambiar su configuración:

```bash
systemctl is-active ssh docker caddy netfilter-persistent
systemctl is-enabled ssh docker caddy netfilter-persistent
dc ps
dc exec -T backend curl -fsS http://127.0.0.1:8080/actuator/health
dc exec -T backend curl -fsS http://ai-core:8000/health
```

La reconexión exitosa acredita recuperación del acceso SSH. Los comandos con `ssh` anteriores son diagnósticos para futuras verificaciones, no la fuente de la evidencia histórica de reconexión. Repetir además `/api/v1/documents/audit` internamente y los controles externos de la sección 8. Un fallo de recuperación requiere diagnóstico del servicio y de las reglas existentes; no reinstalar paquetes, cambiar puertos ni abrir rutas como reacción automática. Registrar una ventana de observación de `RestartCount` sin inferir disponibilidad continua a partir de una consulta de salud.

## 10. Registro y criterios de aceptación de #59

Consultar el [registro de evidencias](./oci-compute-deployment-evidence.md) para resultados, extractos del operador, limitaciones y pendientes. Contrastar cada actualización con el [Issue #59](https://github.com/No-Country-simulation/G10-MediFlow-Team11/issues/59): servicios y configuraciones existentes, salud, comunicaciones internas, Instance Principals, secretos protegidos, PostgreSQL sin exposición pública y operación reproducible.

Registrar fecha, SHA desplegado, alcance y tipo de evidencia de cada verificación. Separar salidas textuales, capturas OCI disponibles, reportes del operador y comprobaciones sin evidencia; no registrar como cumplido un paso solo por figurar en este runbook. Añadir identificadores de imágenes y una ventana de observación de reinicios únicamente cuando se disponga de ellos.

La conectividad HTTP con IA y la prueba Java aislada de Object Storage tienen límites distintos del flujo real de `AiCoreClient`. La lectura mediante un endpoint del Backend desplegado y la ventana de observación de reinicios constan en el registro con sus límites; el flujo de `AiCoreClient` sigue pendiente. #56 corresponde a la integración end-to-end posterior; publicación funcional de API/Frontend, pruebas de carga, renovación futura de TLS y restauración de respaldo no se convierten automáticamente en bloqueos de #59. El estado de aceptación debe revisarse contra los criterios del Issue, sin cerrarlo desde esta documentación.

Referencias: [arquitectura §§11–15](../ARCHITECTURE.md), [PostgreSQL](./postgresql-docker.md), [Backend](../../backend/README.md#contenerización-del-backend-issue-53), [IA Core](../../ai-core/README.md#ejecución-con-docker), [variables de Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/), [Instance Principals](https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/callingservicesfrominstances.htm).
