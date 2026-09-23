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

## Desarrollo local

```powershell
cd ai-core
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

La API queda disponible en `http://localhost:8000` y su estado se puede consultar en `GET /health`.

## Pruebas

```powershell
python -m pytest -q
```

Desde `ai-core/`, el resultado esperado de la suite actual es `35 passed`.
