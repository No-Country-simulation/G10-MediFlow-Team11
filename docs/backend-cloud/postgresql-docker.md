# PostgreSQL con Docker

MediFlow ejecuta PostgreSQL 17 mediante **Docker Compose** para el desarrollo local. No hace falta instalar PostgreSQL en tu equipo: Docker descarga la imagen oficial y crea un contenedor con la base de datos lista para usar.

La configuración vive en [`compose.yaml`](../../compose.yaml), en la raíz del repositorio:

| Elemento | Valor |
|---|---|
| Imagen | `postgres:17-alpine` (imagen oficial) |
| Servicio Compose | `postgres` |
| Base de datos por defecto | `mediflow` |
| Usuario por defecto | `mediflow_user` |
| Puerto interno de PostgreSQL | `5432` |
| Volumen persistente | `postgres_data` (named volume) |
| Healthcheck | `pg_isready`, cada 5 segundos |
| Publicación del puerto | Solo en `127.0.0.1` (loopback), nunca en todas las interfaces |

Conceptos básicos de Docker:

- **Imagen:** plantilla de solo lectura con PostgreSQL ya instalado.
- **Contenedor:** instancia en ejecución de esa imagen. Se puede borrar y volver a crear.
- **Volumen:** espacio de almacenamiento gestionado por Docker, independiente del contenedor. Es donde quedan los datos.
- **Healthcheck:** comando que Docker ejecuta periódicamente para saber si PostgreSQL ya acepta conexiones.

---

## Requisitos previos

| Herramienta | Uso |
|---|---|
| Git | Clonar el repositorio |
| Docker | Ejecutar el contenedor de PostgreSQL |
| Docker Compose | Levantar el servicio definido en `compose.yaml` |

- En **Windows y macOS** normalmente se utiliza [Docker Desktop](https://docs.docker.com/desktop/), que ya incluye Docker Compose.
- En **Linux** puede utilizarse Docker Engine junto con el plugin de Compose (`docker-compose-plugin`).

Docker Desktop debe estar abierto (o el servicio de Docker iniciado) antes de ejecutar cualquier comando `docker`.

Para comprobar que ambas herramientas están disponibles:

```bash
docker --version
docker compose version
```

> Se usa `docker compose` (con espacio), que es el comando actual de Compose.

---

## Configuración inicial

Todos los comandos de esta guía se ejecutan **desde la raíz del repositorio**, donde están `compose.yaml` y `.env.example`.

Copia la plantilla de variables de entorno para crear tu archivo local `.env`:

PowerShell:

```powershell
Copy-Item .env.example .env
```

Bash:

```bash
cp .env.example .env
```

Después abre `.env` con tu editor y completa `DB_PASSWORD`.

| Variable | Valor en la plantilla | Para qué sirve |
|---|---|---|
| `DB_HOST` | `localhost` | Host donde el Backend busca PostgreSQL. En desarrollo local es tu propio equipo. |
| `DB_PORT` | `5432` | Puerto del **host** en el que se publica PostgreSQL. Lo usan Docker Compose (para publicar el puerto) y el Backend (para conectarse). |
| `DB_NAME` | `mediflow` | Nombre de la base de datos que se crea al iniciar el contenedor por primera vez. |
| `DB_USER` | `mediflow_user` | Usuario de PostgreSQL que se crea junto con la base. |
| `DB_PASSWORD` | *(vacía)* | Contraseña de `DB_USER`. **Obligatoria**: se define en cada entorno local. |
| `SERVER_PORT` | `8080` | Puerto HTTP del Backend (Spring Boot). No lo usa PostgreSQL. |

Importante:

- **`DB_PASSWORD` debe definirse localmente y nunca versionarse.** Elige una contraseña propia; esta guía no propone ninguna a propósito.
- **`.env` está ignorado por Git** (`.gitignore`), por lo que no se sube al repositorio. Solo se versiona la plantilla `.env.example`, que no contiene credenciales.
- Si `DB_PASSWORD` no está definida, Docker Compose se detiene con el error `required variable DB_PASSWORD is missing a value`. Esto es intencional: evita levantar la base sin contraseña.

### Conflicto con el puerto 5432

Si en tu equipo ya existe otra instalación de PostgreSQL usando el puerto `5432`, el contenedor no podrá publicar ese puerto (o el Backend podría terminar conectándose a la otra instalación).

En ese caso, cambia **únicamente tu `.env`** para usar otro puerto del host, por ejemplo:

```env
DB_PORT=5433
```

PostgreSQL sigue utilizando `5432` **dentro del contenedor**; solo cambia el puerto por el que se accede desde tu equipo. Como el Backend lee la misma variable `DB_PORT`, se conecta automáticamente al puerto correcto. No hace falta modificar `compose.yaml` ni `.env.example`.

---

## Levantar PostgreSQL

```bash
docker compose up -d postgres
docker compose ps
```

- `up -d postgres` crea (si no existen) la red, el volumen y el contenedor, y los deja ejecutándose en segundo plano (`-d`). La primera vez descarga la imagen, por lo que puede tardar un poco más.
- `ps` muestra el estado del servicio.

El resultado esperado en `docker compose ps` es que la columna `STATUS` indique **`healthy`**, por ejemplo `Up 10 seconds (healthy)`. Durante los primeros segundos puede aparecer `health: starting`; en ese caso, vuelve a ejecutar `docker compose ps` unos segundos después.

---

## Verificar PostgreSQL

Ver en qué dirección y puerto del host está publicado PostgreSQL:

```bash
docker compose port postgres 5432
```

Debe mostrar `127.0.0.1:5432` (o `127.0.0.1:<DB_PORT>` si cambiaste el puerto en tu `.env`).

Ver los logs del servicio:

```bash
docker compose logs postgres
```

En el primer arranque aparecen `CREATE DATABASE` y `database system is ready to accept connections`. En los arranques siguientes aparece `Database directory appears to contain a database; Skipping initialization`, que confirma que se reutilizan los datos existentes.

Comprobar la base y el usuario **sin escribir ni mostrar la contraseña**:

```bash
docker compose exec postgres psql -U mediflow_user -d mediflow -c "SELECT current_database(), current_user;"
```

Resultado esperado:

```
 current_database | current_user
------------------+---------------
 mediflow         | mediflow_user
```

Este comando ejecuta `psql` **dentro del contenedor** y se conecta por el socket local de PostgreSQL, por eso no pide contraseña. Si cambiaste `DB_NAME` o `DB_USER` en tu `.env`, usa esos valores en `-d` y `-U`.

---

## Persistencia

Los datos de PostgreSQL se guardan en el named volume `postgres_data`, no dentro del contenedor. El contenedor puede eliminarse y recrearse sin perder la información: al volver a levantarse, PostgreSQL encuentra los datos existentes en el volumen y los reutiliza.

```bash
docker compose down
```

Elimina el **contenedor** y la **red** creados por Compose, pero **conserva el volumen** y, por lo tanto, los datos. El siguiente `docker compose up -d postgres` vuelve a crear el contenedor sobre los mismos datos.

> [!WARNING]
> `docker compose down -v` elimina **también el volumen** y, con él, **todos los datos locales de PostgreSQL**. No es un comando de uso habitual: utilízalo solo si realmente quieres descartar la base local y empezar desde cero.

> [!NOTE]
> PostgreSQL crea la base, el usuario y su contraseña **solo la primera vez**, cuando el volumen está vacío. Si más adelante cambias `DB_PASSWORD` en tu `.env`, la contraseña guardada en la base **no cambia** y el Backend no podrá autenticarse con la nueva.

---

## Detener y volver a iniciar

Para pausar PostgreSQL sin eliminar nada:

```bash
docker compose stop postgres
docker compose start postgres
```

| Comando | Contenedor | Red | Volumen (datos) |
|---|---|---|---|
| `docker compose stop postgres` | Se detiene, pero se conserva | Se conserva | Se conserva |
| `docker compose start postgres` | Vuelve a iniciar el contenedor existente | — | — |
| `docker compose down` | Se elimina | Se elimina | Se conserva |

- Usa `stop` / `start` para pausar y reanudar en el día a día.
- Usa `down` cuando quieras eliminar el contenedor (por ejemplo, para recrearlo desde cero con `up`). Los datos se conservan igualmente.

El servicio está configurado con `restart: unless-stopped`: si PostgreSQL estaba en ejecución y Docker se reinicia (por ejemplo, al reabrir Docker Desktop), el contenedor vuelve a iniciarse solo. Si lo detuviste con `stop`, permanece detenido hasta que lo inicies de nuevo.

---

## Conectar el Backend

El Backend (Spring Boot) lee la conexión a PostgreSQL desde estas variables de entorno, definidas en `backend/src/main/resources/application.yaml`:

`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` y `SERVER_PORT`.

> [!IMPORTANT]
> Docker Compose carga automáticamente el `.env` de la raíz, pero **Spring Boot no carga archivos `.env` automáticamente**. Las variables tienen que estar presentes en el entorno del proceso que ejecuta Maven.

Una forma de hacerlo es cargar el `.env` en la sesión actual de la terminal antes de ejecutar Maven. Las variables solo quedan disponibles en esa terminal.

PowerShell, desde la raíz del repositorio:

```powershell
Get-Content .env | Where-Object { $_ -and -not $_.StartsWith('#') } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$name" -Value $value
}

Set-Location backend
.\mvnw.cmd spring-boot:run
```

Bash, desde la raíz del repositorio:

```bash
set -a
source .env
set +a
cd backend
./mvnw spring-boot:run
```

Con el Backend en ejecución, desde otra terminal:

```bash
curl http://localhost:8080/actuator/health
```

Si cambiaste `SERVER_PORT`, usa ese puerto en la URL.

---

## Seguridad y OCI

- **Las credenciales no se versionan.** `DB_PASSWORD` solo existe en el `.env` de cada entorno local, que está ignorado por Git. `compose.yaml` y `.env.example` no contienen contraseñas.
- **PostgreSQL se publica en el host únicamente mediante `127.0.0.1`.** Solo es accesible desde el propio equipo (o desde la propia instancia, en un servidor), no desde otras máquinas de la red.
- **En OCI, PostgreSQL no debe exponerse públicamente mediante reglas de ingreso al puerto `5432`.** La configuración de red (Security Lists / NSG) debe mantener el servicio restringido a los componentes internos que lo consumen.

---

## Comandos útiles

| Comando | Qué hace |
|---|---|
| `docker compose up -d postgres` | Crea (si hace falta) e inicia PostgreSQL en segundo plano |
| `docker compose ps` | Muestra el estado del servicio (esperado: `healthy`) |
| `docker compose logs postgres` | Muestra los logs de PostgreSQL |
| `docker compose stop postgres` | Detiene PostgreSQL sin eliminar el contenedor |
| `docker compose start postgres` | Vuelve a iniciar el contenedor detenido |
| `docker compose down` | Elimina contenedor y red; **conserva** el volumen con los datos |
