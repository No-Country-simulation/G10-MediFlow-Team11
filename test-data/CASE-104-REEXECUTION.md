# Reejecución de validación #104

Fecha: 2026-10-24 (America/Bogota)

## Build final de IA Core

- Rama: fix/104-ai-core-clinical-cases.
- Base: origin/develop (45a96d8e5c1834981da003eb129732316e4a249c).
- Imagen local reconstruida con docker compose up -d --build ai-core.
- El contenedor quedó healthy y GET /health respondió {"status":"ok"}. Esto solo confirma disponibilidad del proceso, no la del proveedor Gemini.

## Reejecución real de CASE-001 a CASE-007

Se enviaron secuencialmente los siete fixtures al endpoint local POST /api/v1/ai/process, con el build final. Todos devolvieron HTTP 503 AI_UNAVAILABLE; no se obtuvo respuesta clínica para comparar con expected.json.

| Caso | Estado | Evidencia |
|---|---|---|
| CASE-001 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-002 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-003 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-004 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-005 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-006 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-007 | BLOCKED | HTTP 503 AI_UNAVAILABLE |

Las respuestas de corridas anteriores se conservan como antecedente, pero no se cuentan como aceptación del build final porque usaron versiones previas del prompt o del normalizador. El endpoint no expone el diagnóstico interno del proveedor; con esta evidencia no se atribuye el 503 a una causa específica.

## Verificación local

- ai-core/.venv/Scripts/python.exe -m pytest -q: **93 passed**, 3 advertencias deprecadas de dependencias (google-genai, Starlette/httpx y AnyIO).
- Las regresiones para CASE-002/005/007 están incluidas en ai-core/tests/test_gemini_processor.py.
- git diff --check: sin errores.
- Solo hay cambios de código y pruebas dentro de IA Core, más este reporte de reejecución. No se modificaron contratos, Backend, Frontend ni despliegues OCI.

## Estado de aceptación

Las pruebas locales de las instrucciones y de la normalización pasan; no sustituyen la validación de una respuesta real de Gemini. La aceptación funcional de los siete documentos sigue **BLOCKED** hasta que Gemini permita completar las solicitudes y contrastar las respuestas con sus expected.json. Las corridas anteriores no reemplazan esa validación final.
