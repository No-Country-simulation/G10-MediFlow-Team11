# MediFlow AI Core

Servicio de IA del proyecto MediFlow. Expone el procesamiento de documentos clínicos mediante una API FastAPI.

## Contratos Pydantic

Los modelos de `app.schemas` representan el contrato Backend -> IA de
`POST /api/v1/ai/process`, definido en `docs/ARCHITECTURE.md`:

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
 `study_result`.

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
esquema enviado al modelo omite `additionalProperties`; la respuesta resultante
se valida después con los modelos Pydantic completos, que preservan los campos
adicionales permitidos en `extracted_data`.

## Desarrollo local

```powershell
cd ai-core
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

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

## Ejecución con Docker

### Construir la imagen

Las versiones de las dependencias directas están fijadas en `requirements.txt`.
Uvicorn conserva el extra `standard`, con dependencias opcionales resueltas según
la plataforma.

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
AI_SERVICE_URL=http://ai-core:8000
```

(referencia: #30)

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
