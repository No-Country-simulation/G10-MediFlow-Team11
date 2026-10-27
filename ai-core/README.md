# MediFlow AI Core

Servicio de IA del proyecto MediFlow. Expone el procesamiento de documentos clínicos mediante una API FastAPI.

## Contratos Pydantic

Los modelos de `app.schemas` representan el contrato Backend -> IA de
`POST /api/v1/ai/process`, definido en [Arquitectura de MediFlow](../docs/ARCHITECTURE.md):

- `ProcessingRequest` exige `document_id`, `input_type`, `mime_type` y
 `origin_channel`; para `FILE` exige `content_base64` y para `TEXT` exige
 `document_text`.
- `AIProcessingResponse` exige los bloques `classification`, `confidence`,
 `extracted_data`, `validation` y `routing_decision`.
- Los enums contractuales usan los valores `PRESCRIPTION`, `IMAGING_REPORT`,
  `STUDY_REPORT`, `PROCEDURE_ORDER`, `DISCHARGE_SUMMARY` y
  `MEDICAL_CERTIFICATE`; prioridades `ROUTINE` y `URGENT`; y destinos
  `MEDICAL_EMERGENCY`, `PHARMACY`, `AUTHORIZATION_AUDIT`, `MEDICAL_RECORD` y
  `HUMAN_REVIEW`.
- `confidence` acepta los valores numericos `classification`, `extraction` y
 `global` dentro de `0..1`. `global_` es solo el nombre interno de Python y
 no es una clave de entrada valida.
- `patient.age` acepta `null` o enteros no negativos estrictos; rechaza
 booleanos, strings numericos y negativos.
- `validation.missing_fields`, `inconsistencies` y `warnings`, junto con
 `routing_decision.audit_reasons`, son arrays obligatorios. Los motivos de
 auditoria se limitan a los enums semanticos del contrato.
- `extracted_data` permite campos adicionales por tipo de documento, como
  `lab_results` para `STUDY_REPORT`. Este campo conserva una lista de resultados
  estructurados presentes en el documento; IA Core no inventa valores ausentes.

## Procesamiento con Gemini

El servicio `app.services.gemini_processor.GeminiProcessor` recibe un
`ProcessingRequest` y devuelve un `AIProcessingResponse` validado de forma
independiente del endpoint HTTP. Para habilitarlo, configura `GEMINI_API_KEY` y
`GEMINI_MODEL`; no hay credenciales ni nombre de modelo por defecto en el
código. Los documentos FILE se envían a Gemini como contenido binario con su
MIME type y los documentos TEXT como texto. El servicio rechaza las respuestas
que no cumplen el contrato o que contienen un `document_id` distinto al de la
solicitud.

Los estudios solicitados se devuelven como
`extracted_data.requested_studies`, un array de objetos `{ "name": "..." }`;
solo se incluyen solicitudes explícitas y se devuelve `[]` cuando no se
identifican. Para cumplir con las restricciones de Gemini Developer API, el
esquema enviado al modelo omite `additionalProperties`. `lab_results` no depende
de esa apertura: está declarado explícitamente en `ExtractedData`, por lo que la
propiedad y su estructura permanecen en el esquema enviado a Gemini. La respuesta
resultante se valida después con los modelos Pydantic completos, que preservan
los campos adicionales permitidos en `extracted_data`.

El procesamiento del MVP es **síncrono**: IA Core recibe una solicitud del
Backend, consulta Gemini, valida la salida y responde en la misma llamada HTTP.
No utiliza colas, workers ni polling. Gemini realiza el análisis multimodal; los
modelos Pydantic y el pipeline local aplican el contrato, normalizan
`requested_studies` y agregan `LOW_CONFIDENCE` según el umbral configurado.

### Resultados de laboratorio

Cuando el documento se clasifica como `STUDY_REPORT`, los resultados de
laboratorio pueden devolverse en `extracted_data.lab_results`. El campo se trata
como una lista explícita de objetos con `name`, `value`, `unit` y
`reference_range`; `unit` y `reference_range` son `null` cuando no aparecen. Se
conserva dentro de `extracted_data` sin introducir otro endpoint ni otro tipo de
respuesta. Solo deben incluirse resultados respaldados por el documento, sin
inferir valores ni duplicarlos en `requested_studies`.

## Alcance y limitaciones del MVP

IA Core clasifica documentos, extrae datos, calcula confianza, informa
validaciones semánticas y sugiere un destino. Sus `audit_reasons` se limitan a
`LOW_CONFIDENCE`, `ILLEGIBLE_DOCUMENT`, `MISSING_CRITICAL_FIELDS` e
`INCONSISTENT_DATA`.

El Backend conserva la responsabilidad final sobre `document_id`, `status`,
`requires_human_review`, motivos técnicos, notificaciones, persistencia y
respuesta al Frontend. IA Core no escribe directamente en OCI Object Storage ni
PostgreSQL: recibe el contenido normalizado del Backend y devuelve únicamente el
resultado de IA.

Los errores HTTP de IA Core mantienen el sobre `{ "error": { "code",
"message" } }`: `400 INVALID_REQUEST`, `502 AI_OUTPUT_INVALID` y
`503 AI_UNAVAILABLE`. El Backend traduce los fallos técnicos a los motivos
contractuales `INVALID_AI_RESPONSE`, `AI_TIMEOUT` o `AI_UNAVAILABLE` cuando
corresponde.

El MVP no incluye procesamiento asíncrono, integraciones hospitalarias reales,
persistencia propia, autenticación clínica de producción ni resiliencia
distribuida avanzada. Utiliza datos sintéticos y enrutamiento lógico/simulado,
según [Arquitectura de MediFlow](../docs/ARCHITECTURE.md).

## Dependencias y reproducibilidad

`requirements.txt` contiene solo las dependencias directas. El archivo
`requirements.lock.txt` es generado y fija todas las dependencias, incluidas las
transitivas, con hashes. No lo edites a mano: es el archivo que instala el
Dockerfile.

### Regenerar el lock

Desde la raíz del repositorio, en PowerShell:

```powershell
docker run --rm -v "${PWD}/ai-core:/work" -w /work python:3.12.15-slim-trixie@sha256:05cda9777409a9c3ffddd94a4c476b79f0769a0b4857f0c7ed9226b6800b0d6f sh -c "pip install -q pip-tools && pip-compile --generate-hashes --output-file=requirements.lock.txt requirements.txt"
```

### Actualizar el digest de la imagen base

Obtén el digest del índice multi-arquitectura, que debe incluir `linux/amd64` y
`linux/arm64`:

```powershell
docker buildx imagetools inspect python:3.12.15-slim-trixie
```

Reemplaza el digest en `ai-core/Dockerfile` y en el comando de regeneración del
lock, y vuelve a generarlo.

## Desarrollo local

```powershell
cd ai-core
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

La variable `APP_ENV` identifica el entorno de ejecución y utiliza `development` como valor predeterminado. Actualmente no modifica el comportamiento del servicio.

Completa `GEMINI_API_KEY` y `GEMINI_MODEL` en `.env` antes de utilizar el
servicio de procesamiento.

`AUDIT_CONFIDENCE_THRESHOLD` configura el umbral de confianza global que agrega
el motivo semántico `LOW_CONFIDENCE`; su valor por defecto es `0.85` y acepta
valores entre `0` y `1`. IA Core conserva el destino de negocio sugerido incluso
cuando devuelve motivos de auditoría; el Backend decide el estado de revisión.

La API queda disponible en `http://localhost:8000` y su estado se puede consultar en `GET /health`.

## Pruebas

```powershell
python -m pytest -q
```

Desde `ai-core/`, ejecuta la suite completa con `python -m pytest -q`.

Este comando documenta el procedimiento de ejecución; este README no atribuye a
IA Core resultados de pruebas ejecutadas o reportadas por otros squads.

## Ejecución con Docker

### Construir la imagen

Las versiones de las dependencias directas están fijadas en `requirements.txt`.
Uvicorn conserva el extra `standard`, con dependencias opcionales resueltas según
la plataforma.

Desde la raíz del repositorio:

```bash
docker build -t mediflow-ai-core ./ai-core
```

### Iniciar con Docker Compose

Desde la raíz del repositorio, con un `.env` que defina al menos `DB_PASSWORD`
(Compose exige esa variable para todo el archivo, aunque solo levantes IA Core):

```bash
docker compose up -d --build ai-core
```

Variables que usa el servicio: `GEMINI_API_KEY`, `GEMINI_MODEL`,
`AUDIT_CONFIDENCE_THRESHOLD` y `AI_CORE_PORT` (por defecto 8000). El puerto se
publica solo en `127.0.0.1`, porque IA Core no debe exponerse a Internet. Si el
puerto 8000 ya está ocupado, define otro `AI_CORE_PORT` en el `.env` de la raíz.

### Verificar

```bash
docker compose ps
```

El servicio debe aparecer como `healthy`. En PowerShell, consulta el endpoint
publicado; `docker compose port` resuelve el puerto asignado (incluido
`AI_CORE_PORT`):

```powershell
$publishedPort = docker compose port ai-core 8000
$port = ($publishedPort -split ":")[-1]
Invoke-RestMethod "http://localhost:$port/health"
```

La respuesta esperada es `status: ok`.

### Integración con el Backend

Dentro de la red de Compose, el Backend debe usar:

```text
MEDIFLOW_AI_SERVICE_URL=http://ai-core:8000
```

Esta propiedad del Backend ya está fijada en `compose.yaml` (referencia: #30). La URL `http://localhost:8000` de la plantilla raíz aplica al Backend ejecutado fuera de Docker. Para desplegar los servicios en la VM, sigue la [guía de OCI Compute](../docs/backend-cloud/oci-compute-deployment.md).

### Notas importantes

- `/health` solo indica que el proceso está vivo. **No valida la configuración
  de Gemini**: sin `GEMINI_API_KEY` o `GEMINI_MODEL` el servicio arranca, pero
  `/api/v1/ai/process` responde 503.
- La VM de OCI es ARM. La imagen debe construirse en esa VM o publicarse como
  imagen multi-arquitectura.

### Verificar el endpoint de procesamiento

Con el contenedor en ejecución, una solicitud incompleta debe responder `400 INVALID_REQUEST`:

```powershell
$publishedPort = docker compose port ai-core 8000
$port = ($publishedPort -split ":")[-1]
$client = [System.Net.Http.HttpClient]::new()
$content = [System.Net.Http.StringContent]::new(
  '{"document_id":"X"}',
  [System.Text.Encoding]::UTF8,
  "application/json"
)
$response = $client.PostAsync("http://localhost:$port/api/v1/ai/process", $content).GetAwaiter().GetResult()
$status = [int]$response.StatusCode
$body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
if ($status -ne 400 -or $body.error.code -ne "INVALID_REQUEST") {
  throw "Expected 400 INVALID_REQUEST; received $status $($body | ConvertTo-Json -Compress)"
}
"HTTP $status $($body | ConvertTo-Json -Compress)"
$response.Dispose()
$content.Dispose()
$client.Dispose()
```

Desde otro servicio de la red de Compose (por ejemplo, Backend), la URL base es
`http://ai-core:8000`; desde ese contenedor, `/health` y
`/api/v1/ai/process` se consultan en la red interna, sin usar el puerto del host.

### Arquitectura de despliegue

La VM de OCI usa procesadores Ampere ARM (`aarch64`). La imagen se construye
directamente en la VM (`docker compose build ai-core`) o se publica como imagen
multi-arquitectura (`linux/arm64`). Una imagen construida solo para x86 no
funcionará en la VM.
