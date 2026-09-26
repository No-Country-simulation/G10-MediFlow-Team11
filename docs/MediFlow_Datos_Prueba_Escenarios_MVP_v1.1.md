# MediFlow - Datos de Prueba y Escenarios MVP v1.1

## Estado

**Auditoría estática: PASS con validación de ejecución pendiente.**

Este entregable corresponde al Issue #8 y contiene 12 casos funcionales sintéticos, 3 escenarios técnicos coordinados y los resultados esperados para Backend, IA Core, Frontend y Producto/QA.

## Cobertura

- Rutina: CASE-001, CASE-007, CASE-010, CASE-011, CASE-012.
- Urgencia: CASE-002, CASE-008.
- LOW_CONFIDENCE: CASE-003.
- ILLEGIBLE_DOCUMENT: CASE-004.
- MISSING_CRITICAL_FIELDS: CASE-005.
- INCONSISTENT_DATA: CASE-006.
- Motivos combinados: CASE-009.
- Orden de procedimiento / Auditoría de Autorizaciones: CASE-011. CASE-011 cubre `extracted_data.requested_studies` como array de objetos con `name`, según la estructura contractual aprobada.
- Epicrisis / Historia Clínica / CIE-10 positivo: CASE-012.
- Fallos técnicos: TECH-001/002/003.
- Formatos: TEXT, PDF, JPG y PNG.

## Principio de validación

Los fixtures definen entradas y expectativas, pero los comportamientos dependientes del modelo no se declaran PASS hasta ejecutarse con una versión/configuración identificada del pipeline.

## Correcciones v1.1

- Se hizo reproducible y menos sobreespecificado CASE-003.
- Se reforzó CASE-004 para que el cuerpo sea realmente no confiable.
- CASE-005 se limitó a la ausencia de dosis, respaldada por el alcance oficial.
- CASE-009 combina edad contradictoria y dosis ausente, evitando reglas clínicas no documentadas.
- CASE-011 y CASE-012 completan la cobertura contractual de `PROCEDURE_ORDER`, `DISCHARGE_SUMMARY`, `AUTHORIZATION_AUDIT` y `suggested_icd10`.
- Se corrigió el tratamiento del destino sugerido cuando `status = NEEDS_AUDIT`.
- Se separó validación estática de validación de ejecución.

Para detalle operativo, ver `test-data/README.md`, `test-data/ISSUE-8-VALIDATION.md` y `test-data/QUALITY-GATE.md`.
