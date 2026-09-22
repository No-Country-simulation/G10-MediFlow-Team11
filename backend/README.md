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
├── backend/     → Spring Boot 3+, Java 21 (este servicio)
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
    open-in-view: false
  jackson:
    serialization:
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
- El arranque completo y la disponibilidad de `GET /actuator/health` con PostgreSQL se validarán al integrar el servicio de base de datos del Issue #13.
- Test de contexto (`BackendApplicationTests`) incluido; queda condicionado a la disponibilidad de PostgreSQL (Issue #13, pendiente).

---

### Infraestructura Cloud — Aprovisionamiento en OCI (Issue #9)

Se completó la configuración base del entorno en Oracle Cloud Infrastructure (capa Always Free) necesaria para soportar Backend, IA Core y Frontend.

**1. Gobernanza, Identidad y Seguridad (IAM)**

Entorno aislado configurado con *Instance Principals*, evitando el uso de credenciales embebidas:

- **Compartment**: `MediFlow_Hackathon` — aislamiento de todos los recursos del MVP.
- **Dynamic Group**: `MediFlow_VM_Group` — asociación automática de instancias del compartment.
- **Política IAM**: `MediFlow_ObjectStorage_Policy` — autoriza al grupo dinámico a administrar objetos dentro del compartment.

**2. Redes (Virtual Cloud Network)**

- **VCN aprovisionada**: `MediFlow_VCN`, con conectividad a Internet.
- **Reglas de ingreso configuradas** para los puertos necesarios del MVP:

  | Puerto | Protocolo | Uso |
  |--------|-----------|-----|
  | 22     | TCP | Acceso SSH administrativo |
  | 80, 443 | TCP | Tráfico HTTP/HTTPS del Frontend |
  | 8080   | TCP | API Backend (Spring Boot) |
  | 8000   | TCP | API IA Core (FastAPI) |
  | 5432   | TCP | Acceso administrativo a PostgreSQL |

**3. Almacenamiento (Object Storage)**

- **Bucket creado**: `mediflow-documentos-clinicos`.
- **Capa**: Standard.
- **Visibilidad**: privado, en cumplimiento de la confidencialidad de datos médicos.
- **Estructura de prefijos inicializada**:
  - `/recibidos/`
  - `/procesados/urgentes/`
  - `/procesados/rutina/`
  - `/auditoria_humana/`

Con esto, el entorno Cloud (IAM, VCN y Object Storage) queda activo y estructurado, y los contratos de integración con el almacenamiento están disponibles para que el Backend continúe su desarrollo.

---

## Requisitos previos

| Herramienta | Verificación | Notas |
|---|---|---|
| JDK 21 | `java -version` | Eclipse Temurin recomendado |
| Maven Wrapper (`./mvnw`) | incluido en el repo | no requiere instalación de Maven |
| Git | `git --version` | |
| PostgreSQL accesible | — | requerido para arrancar completamente el servicio (ver [Próximos pasos](#próximos-pasos)) |

---

## Configuración y ejecución local

1. Clonar el repositorio y ubicarse en la carpeta del backend:

   ```bash
   cd backend
   ```

2. Copiar el archivo de ejemplo de variables de entorno y completar los valores locales:

   ```bash
   cp .env.example .env
   ```

3. Definir las variables de entorno (por ejemplo, en la Run Configuration de tu IDE o exportándolas en la terminal) antes de ejecutar la aplicación. Ver la tabla de la siguiente sección.

4. Compilar el proyecto:

   ```bash
   ./mvnw clean compile
   ```

5. Ejecutar la aplicación:

   ```bash
   ./mvnw spring-boot:run
   ```

   > Sin una instancia de PostgreSQL accesible con las credenciales configuradas, el arranque fallará al inicializar JPA. Esto es esperado hasta completar la configuración de base de datos (Issue #13).

6. Verificar el estado del servicio una vez levantado:

   ```bash
   curl http://localhost:8080/actuator/health
   ```

---

## Variables de entorno

Definidas en `backend/.env.example` (sin valores reales):

| Variable | Obligatoria | Valor por defecto | Descripción |
|---|---|---|---|
| `DB_HOST` | No | `localhost` | Host de PostgreSQL |
| `DB_PORT` | No | `5432` | Puerto de PostgreSQL |
| `DB_NAME` | No | `mediflow` | Nombre de la base de datos |
| `DB_USER` | No | `mediflow_user` | Usuario de la base de datos |
| `DB_PASSWORD` | **Sí** | — (sin fallback) | Contraseña de la base de datos; el arranque falla si no se define |
| `SERVER_PORT` | No | `8080` | Puerto de escucha del servicio |

`.env` está excluido del control de versiones mediante `.gitignore`; solo `.env.example` se versiona.

---

## Flujo de contribución

1. Partir siempre de la rama `develop`:

   ```bash
   git checkout develop
   git pull origin develop
   ```

2. Crear una rama de trabajo por ticket, con el patrón `task/<numero-issue>-<descripcion-corta>`:

   ```bash
   git checkout -b task/<n>-descripcion-corta
   ```

3. Commits con prefijo semántico (`feat:`, `fix:`, `chore:`, `docs:`, etc.).

4. Abrir el Pull Request hacia `develop`, referenciando el Issue correspondiente (`Issue: #n`) e incluyendo cómo se validó el cambio.

5. Requiere al menos una aprobación antes de hacer merge.

---

## Próximos pasos

El backlog continúa, en orden de dependencias, con:

- **Issue #2** — Contratos (DTOs) de entrada y salida para el procesamiento de documentos.
- **Issue #14** — Configuración de PostgreSQL (Docker Compose, healthcheck, conexión desde el Backend).
- **Issue #9 (continuación)** — Aprovisionamiento de la instancia Compute y despliegue de contenedores.
- **Persistencia** — Entidades JPA para `documentos` y `document_triage_history`.
- **Issue #15** — Integración del Backend con OCI Object Storage.
- **Issue #18** — Flujo principal de procesamiento (`process-file` / `process-text`) con orquestación hacia IA Core.

Cada ticket se documentará en este README a medida que se complete y valide.
