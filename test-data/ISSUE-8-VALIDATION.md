# Validación de aceptación - Issue #8

## Cumplimiento estático del entregable

- [x] Existen 12 documentos o entradas sintéticas de prueba.
- [x] Existe un caso de flujo estándar / rutina.
- [x] Existe un caso de urgencia médica.
- [x] Existe al menos un caso que requiere revisión humana.
- [x] Existe cobertura explícita de `PROCEDURE_ORDER` y `AUTHORIZATION_AUDIT`. CASE-011 cubre `extracted_data.requested_studies` como array de objetos con `name`, según la estructura contractual aprobada.
- [x] Existe cobertura explícita de `DISCHARGE_SUMMARY` y `suggested_icd10`.
- [x] Existe un fixture diseñado para cubrir `LOW_CONFIDENCE`.
- [x] Existe un fixture diseñado para cubrir `ILLEGIBLE_DOCUMENT`.
- [x] Existe un fixture diseñado para cubrir `MISSING_CRITICAL_FIELDS`.
- [x] Existe un fixture diseñado para cubrir `INCONSISTENT_DATA`.
- [x] Hay entradas `PDF`, `JPG`, `PNG` y `TEXT`.
- [x] Cada caso define entrada y resultado esperado.
- [x] Cada caso identifica clasificación/prioridad/destino/status/audit reasons cuando el contrato permite fijarlos de forma determinista.
- [x] Los datos son completamente sintéticos.
- [x] La estructura es reutilizable por Backend, IA Core, Frontend y QA.
- [x] Se documentan `AI_TIMEOUT`, `AI_UNAVAILABLE` e `INVALID_AI_RESPONSE` como escenarios de fault injection.
- [x] La revisión estática no detecta enums o estados fuera de `docs/ARCHITECTURE.md`.

## Validación de ejecución pendiente

Estos puntos **no deben marcarse como cumplidos hasta ejecutar el sistema integrado**:

- [ ] CASE-003 produce `confidence.global < 0.85` y `LOW_CONFIDENCE` con el modelo configurado.
- [ ] CASE-004 produce `ILLEGIBLE_DOCUMENT` sin convertirse en un fallo técnico.
- [ ] CASE-005 produce `MISSING_CRITICAL_FIELDS` por dosis ausente.
- [ ] CASE-006 produce `INCONSISTENT_DATA` por contradicción de edad.
- [ ] CASE-009 acumula `INCONSISTENT_DATA` + `MISSING_CRITICAL_FIELDS`.
- [ ] CASE-011 produce `PROCEDURE_ORDER`, `AUTHORIZATION_AUDIT` y `PROCESSED`.
- [ ] CASE-012 produce `DISCHARGE_SUMMARY`, `MEDICAL_RECORD`, `PROCESSED` y `suggested_icd10 = J18.9`.
- [ ] Los casos `PROCESSED` y `NEEDS_AUDIT` terminan en los prefijos OCI esperados.
- [ ] TECH-001, TECH-002 y TECH-003 se reproducen con fault injection y generan el fallback esperado.

## Regla de cierre

El paquete puede considerarse **listo para PR como datos de prueba** después de la auditoría técnica/estructural final. La eficacia real de los fixtures semánticos queda sujeta a la ejecución del pipeline y debe registrarse como evidencia de QA, no asumirse por diseño.
