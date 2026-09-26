# MediFlow - Test Data del MVP (Issue #8)

Este directorio contiene datos **100% sintéticos** para validar los escenarios del MVP de MediFlow.

## Alcance

- 12 casos funcionales reutilizables por Backend, IA Core, Frontend y Producto/QA.
- Cobertura de entradas `TEXT`, `PDF`, `PNG` y `JPG`.
- Cobertura de flujo rutina, urgencia y revisión humana.
- Cobertura semántica de `LOW_CONFIDENCE`, `ILLEGIBLE_DOCUMENT`, `MISSING_CRITICAL_FIELDS` e `INCONSISTENT_DATA`.
- Especificación separada de `AI_TIMEOUT`, `AI_UNAVAILABLE` e `INVALID_AI_RESPONSE`, que requieren mocks/stubs/fault injection.

## Reglas de evaluación

1. `audit_reasons_required` contiene los motivos que **deben** aparecer para declarar PASS.
2. `audit_reasons_allowed_additional` contiene motivos adicionales aceptables cuando la naturaleza del documento puede producir más de una señal semántica.
3. Un motivo semántico lleva a `NEEDS_AUDIT`; el destino de negocio sugerido puede conservarse, pero **no se ejecuta** mientras el documento permanezca en auditoría.
4. `HUMAN_REVIEW` se utiliza cuando no existe un destino de negocio confiable, especialmente en fallos técnicos.
5. `requires_human_review` es autoridad del Backend y se deriva de `status = NEEDS_AUDIT`.
6. El umbral inicial de `LOW_CONFIDENCE` es `confidence.global < 0.85`. CASE-003 es un caso de calibración: su resultado debe comprobarse con el modelo configurado.
7. Los motivos técnicos no se inducen alterando contenido clínico.
8. Los casos `PROCESSED` terminan en `procesados/rutina/` o `procesados/urgentes/`; los casos `NEEDS_AUDIT` en `auditoria_humana/`.
9. Los expected no deben exigir información clínica no respaldada por el documento o por los contratos vigentes.

## Casos

| Caso | Formato | Objetivo | Status esperado | Motivo principal |
|---|---|---|---|---|
| CASE-001 | TEXT | Rutina estándar | PROCESSED | - |
| CASE-002 | TEXT | Urgencia médica | PROCESSED | - |
| CASE-003 | PDF | Ambigüedad / baja confianza | NEEDS_AUDIT | LOW_CONFIDENCE |
| CASE-004 | JPG | Documento parcialmente ilegible | NEEDS_AUDIT | ILLEGIBLE_DOCUMENT |
| CASE-005 | PDF | Dosis faltante en receta | NEEDS_AUDIT | MISSING_CRITICAL_FIELDS |
| CASE-006 | TEXT | Datos inconsistentes | NEEDS_AUDIT | INCONSISTENT_DATA |
| CASE-007 | PNG | Receta rutinaria | PROCESSED | - |
| CASE-008 | PDF | Urgencia radiológica | PROCESSED | - |
| CASE-009 | PNG | Inconsistencia + dosis faltante | NEEDS_AUDIT | INCONSISTENT_DATA + MISSING_CRITICAL_FIELDS |
| CASE-010 | JPG | Certificado rutinario | PROCESSED | - |
| CASE-011 | TEXT | Orden de procedimiento / autorización; `extracted_data.requested_studies` como array de objetos con `name` (estructura contractual aprobada) | PROCESSED | - |
| CASE-012 | PDF | Epicrisis / Historia Clínica / CIE-10 | PROCESSED | - |

Cada carpeta contiene `case.json`, el archivo de entrada y `expected.json`. Los casos TEXT incluyen `request.json`; los casos FILE incluyen `request-meta.json`.

## Escenarios técnicos coordinados

- `TECH-001.json`: `AI_TIMEOUT`
- `TECH-002.json`: `AI_UNAVAILABLE`
- `TECH-003.json`: `INVALID_AI_RESPONSE`

Estos escenarios especifican el comportamiento esperado, pero su ejecución depende de Backend/IA Core y debe realizarse mediante mocks, stubs o fault injection.

## Calidad y trazabilidad

- La auditoría estática del paquete se registra en `QUALITY-GATE.md`.
- `ISSUE-8-VALIDATION.md` separa cumplimiento estático de validaciones que requieren ejecución real.
- Los casos no afirman PASS de comportamiento del modelo hasta ejecutar el sistema.

## Seguridad y privacidad

Todos los nombres, matrículas, centros médicos, resultados y contenidos son ficticios y fueron creados únicamente para pruebas del hackathon. Ningún archivo contiene datos clínicos reales.
