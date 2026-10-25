# Reejecución de validación #104

Fecha: 2026-10-24 (America/Bogota)

## Pruebas locales de IA Core

- Rama: `fix/104-ai-core-clinical-cases`.
- Base: `origin/develop` en el commit `6401f41` (#103 integrado).
- Suite completa de IA Core: **98 passed**, 3 advertencias deprecadas de dependencias.
- Pruebas focalizadas de `test_gemini_processor.py`: **35 passed**, 1 advertencia de dependencia.
- `git diff --check`: sin errores.
- La prueba directa previa a `http://127.0.0.1:8001/api/v1/ai/process` devolvió HTTP 503 `AI_UNAVAILABLE` en los siete fixtures; no sirve para validar las respuestas reales del modelo.

## Reejecución por el puente Backend/OCI

El 2026-10-24 se enviaron los siete fixtures sintéticos por los endpoints de `https://mediflowia.dev/api/v1/documents/process-text` y `process-file`. Las solicitudes respondieron HTTP 200 y quedaron persistidas en el servicio. Los IDs usados fueron `CASE104-20261024202850-076476-1` a `CASE104-20261024202850-076476-7`, en orden CASE-001 a CASE-007.

El servicio no expuso su revisión de código. No se confirmó que ejecutara esta rama, por lo que la tabla documenta el comportamiento observado del despliegue disponible y **no valida el commit de #104**.

| Caso | Estado observado | Comparación con `expected.json` |
|---|---|---|
| CASE-001 | BLOCKED | Clasificación, prioridad, destino, paciente y médico coinciden. El campo de laboratorio esperado (`estudio`) pertenece al alcance de #103; no se evalúa ni se implementa en #104. |
| CASE-002 | FAIL | Conservó `URGENT` y `MEDICAL_EMERGENCY`, pero devolvió `primary_diagnosis: "Dolor torácico opresivo"` e ICD-10 `R07.9`, no expresados como diagnóstico en el documento. |
| CASE-003 | FAIL | El resultado incluyó `MISSING_CRITICAL_FIELDS` e `INCONSISTENT_DATA` además de `LOW_CONFIDENCE`; `expected.json` solo permite `LOW_CONFIDENCE`. |
| CASE-004 | PASS | Estado, clasificación, destino y auditoría por ilegibilidad cumplen los valores permitidos por `expected.json`. |
| CASE-005 | FAIL | Devolvió `dosage: null` y `NEEDS_AUDIT`, pero `validation.missing_fields` contenía `dosis de Amoxicilina` y no `medications[0].dosage`. |
| CASE-006 | PASS | Conservó `NEEDS_AUDIT`, prioridad rutinaria, destino de registro médico y la inconsistencia de edades 44 vs. 64. |
| CASE-007 | FAIL | Conservó los 3 días, pero devolvió `500 mg, 1 comprimido cada 8 horas por 3 dias, via oral`, distinto del valor esperado sin vía y con separador `/`. |

La prueba persistió documentos sintéticos en OCI; no se borraron. No se hizo un segundo envío para evitar duplicar registros ni consumir cuota adicional de Gemini.

## Cambios de esta rama y estado de aceptación

La corrección local refuerza CASE-002 con una verificación de que el diagnóstico aparezca explícitamente en el texto, elimina un CIE-10 si no hay diagnóstico explícito y normaliza el formato de dosis de CASE-007. CASE-005 ya tiene normalización local que convierte textos de ausencia en `null`, añade `medications[i].dosage` y agrega `MISSING_CRITICAL_FIELDS`.

Los siete resultados end-to-end siguen **BLOCKED respecto de esta rama** hasta que una ejecución autorizada identifique y use la revisión actualizada de IA Core. No se desplegó a OCI. La observación de CASE-003 también requiere reejecutarse contra esa revisión antes de determinar si la discrepancia sigue presente.
