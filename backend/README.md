# MediFlow — Backend

Agente autónomo para triaje, extracción y enrutamiento de documentos clínicos.
Proyecto desarrollado para el **Hackathon ONE — Grupo 10** (Oracle Next Education & Alura).

> Este README se actualiza de forma incremental a medida que se completan los tickets del backlog. Solo documenta lo que ya está implementado y validado; el trabajo pendiente se gestiona en los issues del repositorio.

---

## Tabla de contenidos

- [Descripción del proyecto](#descripción-del-proyecto)
- [Arquitectura general](#arquitectura-general)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Estado actual de implementación](#estado-actual-de-implementación)
  - [Backend — Inicialización del servicio (Issue #1)](#backend--inicialización-del-servicio-issue-1)
  - [Infraestructura Cloud — Aprovisionamiento en OCI (Issue #9)](#infraestructura-cloud--aprovisionamiento-en-oci-issue-9)
  - [PostgreSQL — Configuración del servicio](#postgresql--configuración-del-servicio)
  - [Contratos DTO de procesamiento (Issue #5)](#contratos-dto-de-procesamiento-issue-5)
  - [Persistencia de documentos e historial (PostgreSQL)](#persistencia-de-documentos-e-historial-postgresql)
- [Requisitos previos](#requisitos-previos)
- [Configuración y ejecución local](#configuración-y-ejecución-local)
- [Variables de entorno](#variables-de-entorno)
- [Flujo de contribución](#flujo-de-contribución)
- [Próximos pasos](#próximos-pasos)

---

## Descripción del proyecto

MediFlow es un agente autónomo capaz de recibir documentos clínicos y administrativos (PDF, imagen o texto), clasificarlos, extraer entidades clínicas relevantes mediante LLMs multimodales, evaluar su confianza y enrutarlos automáticamente al destino correcto (Emergencia Médica, Farmacia, Auditoría de Autorizaciones, Historia Clínica o Revisión Humana), sin intervención manual en los casos estándar.

El sistema se compone de tres servicios independientes:

| Servicio    | Stack                                   | Responsabilidad principal                                                                 |
|-------------|------------------------------------------|---------------------------------------------------------------------------------------------|
| `backend`   | Java 21, Spring Boot, PostgreSQL, OCI SDK | Recepción de documentos, persistencia, orquestación con IA Core y respuesta canónica al Frontend |
| `ai-core`   | Python, FastAPI, Pydantic, LLM multimodal | Clasificación, extracción de entidades, cálculo de confianza y sugerencia de enrutamiento     |
| `frontend`  | React, TypeScript, Vite                   | Carga de documentos y panel de auditoría Human-in-the-Loop (HITL)                             |

Este documento cubre exclusivamente el **servicio Backend** (`/backend`).

---

## Arquitectura general

El procesamiento es **síncrono** para el MVP: el Backend espera la respuesta de IA Core (con timeout y reintento) y devuelve el resultado completo en la misma llamada HTTP.

```
Frontend (React)
     │
     ▼
Backend (Spring Boot)
  1. Recibe el documento vía process-file / process-text
  2. Guarda el archivo original en OCI Object Storage (recibidos/)
  3. Registra el estado inicial en PostgreSQL (RECEIVED)
  4. Normaliza la entrada a un contrato único (ProcessingRequest)
     │
     ▼
IA Core (Python / FastAPI)
  5. Clasifica, extrae datos, calcula confianza, valida y sugiere ruteo
     │
     ▼
Backend
  6. Valida el contrato de la respuesta de IA
  7. Combina motivos de auditoría (semánticos de IA + técnicos del Backend)
  8. Mueve el documento y su resultado al prefijo final en OCI
  9. Confirma el resultado y el historial en PostgreSQL
     │
     ▼
Frontend
  10. Consume la respuesta canónica (200 OK) o el panel de auditoría (HITL)
```

La definición completa de contratos, DTOs, códigos de error y reglas de enrutamiento vive en el documento interno **MediFlow — Arquitectura Base y Contratos de Integración (v1.0)**.

---

## Estructura del repositorio

```
mediflow/
├── backend/     → Spring Boot 4.1.1, Java 21 (este servicio)
├── frontend/    → React, TypeScript, Vite
├── ai-core/     → Python, FastAPI
├── docs/        → Arquitectura, contratos, diagramas, reportes técnicos
└── test-data/   → Datos sintéticos de prueba
```

Todo el trabajo del servicio Backend vive dentro de `/backend`.

---

## Estado actual de implementación

### Backend — Inicialización del servicio (Issue #1)

Se creó la estructura base del proyecto y se dejó lista para continuar con los siguientes tickets (contratos, persistencia, integración con IA Core y OCI).

**Stack técnico**

- Java 21
- Spring Boot 4.1.1 (Maven)
- Dependencias incluidas:
  - `spring-boot-starter-webmvc` — API REST
  - `spring-boot-starter-data-jpa` — persistencia ORM
  - `postgresql` — driver JDBC (scope `runtime`)
  - `spring-boot-starter-validation` — validación de DTOs
  - `spring-boot-starter-actuator` — health checks (`/actuator/health`, `/actuator/info`)
  - `lombok` — reducción de boilerplate (opcional)
  - `spring-boot-starter-test` — JUnit, Mockito y Spring Test (scope `test`)

**Configuración externa sin credenciales hardcodeadas**

Toda la configuración sensible se resuelve mediante variables de entorno en `src/main/resources/application.yaml`:

```yaml
server:
  port: ${SERVER_PORT:8080}

spring:
  application:
    name: mediflow-backend
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:mediflow}
    username: ${DB_USER:mediflow_user}
    password: ${DB_PASSWORD}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: update
    properties:
      hibernate:
        format_sql: true
        jdbc:
          time_zone: UTC
    open-in-view: false
  jackson:
    datatype:
      datetime:
        write-dates-as-timestamps: false

management:
  endpoints:
    web:
      exposure:
        include: health,info
```

Puntos clave:

- `DB_PASSWORD` **no tiene valor por defecto**: si no se define, el arranque falla explícitamente en lugar de usar una contraseña de ejemplo.
- Ninguna credencial queda escrita en el código ni en el repositorio; `.env` está excluido vía `.gitignore` y solo se versiona `.env.example` con las claves sin valores.
- `open-in-view: false` evita mantener la sesión de Hibernate abierta durante el renderizado de la respuesta.

**Verificación realizada**

- `./mvnw clean compile` → `BUILD SUCCESS`.
- El arranque completo y `GET /actuator/health` requieren PostgreSQL en ejecución (ver [PostgreSQL — Configuración del servicio](#postgresql--configuración-del-servicio)).
- Test de contexto (`BackendApplicationTests`) incluido; requiere PostgreSQL en ejecución.

### PostgreSQL — Configuración del servicio

PostgreSQL 17 se ejecuta en el entorno de desarrollo mediante **Docker Compose**, con el servicio `postgres` definido en [`compose.yaml`](../compose.yaml) en la raíz del repositorio.

| Aspecto | Configuración |
|---|---|
| Imagen | `postgres:17-alpine` (imagen oficial) |
| Base / usuario por defecto | `mediflow` / `mediflow_user` |
| Credenciales | Variables externas (`DB_NAME`, `DB_USER`, `DB_PASSWORD`) leídas desde el `.env` de la raíz; `DB_PASSWORD` es obligatoria y no tiene valor por defecto |
| Persistencia | Named volume `postgres_data`; los datos sobreviven a `docker compose down` |
| Healthcheck | `pg_isready` cada 5 s; el servicio se reporta como `healthy` cuando acepta conexiones |
| Puerto | Publicado solo en loopback: `127.0.0.1:${DB_PORT}` → `5432` del contenedor |

Las mismas variables `DB_*` las utilizan Docker Compose (para crear la base y publicar el puerto) y el Backend (para conectarse), por lo que existe una única plantilla: [`/.env.example`](../.env.example). El archivo `.env` local se crea en la raíz del repositorio.

Docker Compose carga automáticamente el `.env` de la raíz; Spring Boot, en cambio, no lee archivos `.env`, por lo que las variables deben estar disponibles en el entorno del proceso que ejecuta el Backend.

Guía técnica completa, incluida la configuración inicial para quienes no hayan trabajado con Docker: [`docs/backend-cloud/postgresql-docker.md`](../docs/backend-cloud/postgresql-docker.md).

### Contratos DTO de procesamiento (Issue #5)

Se implementaron los contratos de transporte de procesamiento definidos en `docs/ARCHITECTURE.md`, **separados de las entidades JPA**. El JSON usa `snake_case` mediante `JacksonConfig` (`PropertyNamingStrategies.SNAKE_CASE`).

**Enums** (`com.mediflow.backend.enums`), valores en inglés según arquitectura:

| Enum | Valores |
|---|---|
| `InputType` | `FILE`, `TEXT` |
| `DocumentType` | `PRESCRIPTION`, `IMAGING_REPORT`, `STUDY_REPORT`, `PROCEDURE_ORDER`, `DISCHARGE_SUMMARY`, `MEDICAL_CERTIFICATE` |
| `PriorityLevel` | `ROUTINE`, `URGENT` |
| `PrimaryDestination` | `MEDICAL_EMERGENCY`, `PHARMACY`, `AUTHORIZATION_AUDIT`, `MEDICAL_RECORD`, `HUMAN_REVIEW` |
| `DocumentStatus` | `RECEIVED`, `PROCESSING`, `NEEDS_AUDIT`, `PROCESSED`, `APPROVED`, `REJECTED`, `FAILED` |
| `AuditReason` | semánticos: `LOW_CONFIDENCE`, `ILLEGIBLE_DOCUMENT`, `MISSING_CRITICAL_FIELDS`, `INCONSISTENT_DATA`; técnicos: `INVALID_AI_RESPONSE`, `AI_TIMEOUT`, `AI_UNAVAILABLE` |
| `StorageState` | `PENDING`, `SUCCESS`, `ERROR` |
| `HumanDecision` | `APPROVE`, `REJECT` |
| `TriageEventType` | `INITIAL_TRIAGE`, `HUMAN_REVIEW` (historial §10) |
| `BackendErrorCode` | códigos HTTP mínimos §14 |

**Entradas externas**

- `ProcessTextRequest` — JSON de `POST /api/v1/documents/process-text`; `document_id` opcional.
- `ProcessFileRequest` — multipart de `POST /api/v1/documents/process-file`: `document_id` opcional, `file`, `origin_channel`.

**Interno Backend → IA Core**

- `ProcessingRequest` — `input_type = FILE` exige `content_base64`; `TEXT` exige `document_text` (`isValid()`).

**IA Core → Backend**

- `AiProcessResponse` + bloques compartidos (`Classification`, `Confidence`, `ExtractedData`, `Validation`) y `RoutingDecisionAi` (`List<AuditReason>`). No incluye `status`, OCI ni `requires_human_review`.
- `AiErrorResponse` — sobre `{ error: { code, message } }` (p. ej. `AI_OUTPUT_INVALID`).

**Backend → Frontend**

- `DocumentoCanonicoResponse` — respuesta canónica §6; `classification`, `confidence`, `extracted_data` y `validation` nullable.
- `RoutingDecisionResponse` — incluye `requires_human_review` (responsabilidad del Backend).
- `NotificationResponse`, `StorageResponse` (sin bucket/object_key).
- `ApiErrorResponse` — errores HTTP del Backend §14, distinto de `AiErrorResponse`.

Bloques reutilizables en `com.mediflow.backend.dto.shared`.

**Pruebas:** `DtoSerializationTest` serializa/deserializa los contratos principales con el `JsonMapper` de `JacksonConfig`.

### Persistencia de documentos e historial (PostgreSQL)

Modelo mínimo §10, con Hibernate `ddl-auto: update` en desarrollo. Las entidades **no** sustituyen a los DTO.

| Tabla | Entidad | Notas |
|---|---|---|
| `documents` | `DocumentRecord` | PK pública `id` (`document_id`). Columnas consultables + JSONB `extracted_data`, `validation`, `notification`. `audit_reasons` como `text[]`. `priority` mapea `PriorityLevel`. No hay columna `needs_audit` (se deriva de `status`). |
| `document_triage_history` | `DocumentTriageHistory` | PK (`document_id`, `sequence`). `@Immutable` (append-only). `result` JSONB (snapshot canónico, sin rutas OCI). `event_type` + `decision` nullable solo en `INITIAL_TRIAGE`. |

`DocumentPersistenceService` guarda/recupera documentos y **solo inserta** historial: `sequence` = `max + 1` bajo `SELECT … FOR UPDATE` de la fila del documento; `occurred_at` se alinea con `documents.updated_at`.

Repositorios Spring Data: `DocumentRepository`, `DocumentTriageHistoryRepository` (consulta por `document_id` ordenada por `sequence`).

**Pruebas:** `DocumentPersistenceIT` usa Testcontainers (`postgres:17-alpine`) y comprueba round-trip, JSONB real en PostgreSQL, varias entradas de historial y `sequence` creciente. Se omiten si Docker no está disponible (`disabledWithoutDocker`). Con Docker Desktop abierto:

```bash
cd backend
./mvnw -Dtest=DocumentPersistenceIT,DtoSerializationTest test
```

El arranque local con esquema persistente sigue el flujo de [Configuración y ejecución local](#configuración-y-ejecución-local): Hibernate crea/actualiza las tablas al iniciar contra el Postgres de Compose.

---

## Requisitos previos

| Herramienta | Verificación | Notas |
|---|---|---|
| JDK 21 | `java -version` | Eclipse Temurin recomendado |
| Maven Wrapper (`./mvnw`) | incluido en el repo | no requiere instalación de Maven |
| Git | `git --version` | |
| Docker | `docker --version` | ejecuta PostgreSQL; en Windows/macOS normalmente mediante Docker Desktop |
| Docker Compose | `docker compose version` | levanta el servicio `postgres` definido en `compose.yaml` |

---

## Configuración y ejecución local

1. Clonar el repositorio y ubicarse en su **raíz** (donde están `compose.yaml` y `.env.example`).

2. Crear el `.env` **en la raíz del repositorio** a partir de la plantilla y definir `DB_PASSWORD` con un valor local:

   ```bash
   cp .env.example .env
   ```

   En PowerShell: `Copy-Item .env.example .env`.

3. Levantar PostgreSQL y esperar a que `docker compose ps` muestre `healthy`:

   ```bash
   docker compose up -d postgres
   docker compose ps
   ```

4. Cargar las variables del `.env` en el entorno del proceso que ejecutará Maven. Spring Boot **no** lee archivos `.env` automáticamente: las variables deben estar presentes en su proceso (por ejemplo, cargándolas en la sesión de la terminal o en la Run Configuration de tu IDE). La guía de PostgreSQL incluye comandos para PowerShell y Bash: [Conectar el Backend](../docs/backend-cloud/postgresql-docker.md#conectar-el-backend).

5. Compilar el proyecto:

   ```bash
   cd backend
   ./mvnw clean compile
   ```

6. Ejecutar la aplicación:

   ```bash
   ./mvnw spring-boot:run
   ```

7. Verificar el estado del servicio una vez levantado:

   ```bash
   curl http://localhost:8080/actuator/health
   ```

---

## Variables de entorno

Definidas en la plantilla [`/.env.example`](../.env.example), en la raíz del repositorio (sin valores reales). El `.env` local se crea también en la raíz; lo leen Docker Compose y, una vez cargadas las variables en su proceso, el Backend:

| Variable | Obligatoria | Valor por defecto | Descripción |
|---|---|---|---|
| `DB_HOST` | No | `localhost` | Host de PostgreSQL |
| `DB_PORT` | No | `5432` | Puerto del host en el que se publica PostgreSQL (dentro del contenedor siempre es `5432`) |
| `DB_NAME` | No | `mediflow` | Nombre de la base de datos |
| `DB_USER` | No | `mediflow_user` | Usuario de la base de datos |
| `DB_PASSWORD` | **Sí** | — (sin fallback) | Contraseña de la base de datos; el arranque falla si no se define |
| `SERVER_PORT` | No | `8080` | Puerto de escucha del servicio |

`.env` está excluido del control de versiones mediante `.gitignore`; solo `.env.example` se versiona.

---

## Flujo de contribución

Los cambios del Backend se integran por pull request contra la rama acordada del squad. Vincular el issue con Development, no incluir secretos y respetar los contratos de `docs/ARCHITECTURE.md`.

Plantilla: [`.github/PULL_REQUEST_TEMPLATE.MD`](../.github/PULL_REQUEST_TEMPLATE.MD).

---

## Próximos pasos

- Endpoints de procesamiento, orquestación con IA Core y reconstrucción de la respuesta canónica a partir de `DocumentRecord`.
- Integración OCI Object Storage y compensación PostgreSQL ↔ OCI (secciones 11–12).
- Revisión humana `PATCH /api/v1/documents/{id}/review` usando el historial append-only.

