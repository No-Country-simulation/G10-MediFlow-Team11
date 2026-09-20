# MediFlow — Escenarios de Prueba y Criterios de Aceptación del MVP v1.0

**Proyecto:** MediFlow — Hackathon ONE G10  
**Issue:** #4 — Definir escenarios de prueba y criterios de aceptación del MVP  
**Squad:** Producto / QA  
**Estado:** Entregable preparado para revisión del equipo  
**Referencia técnica vigente:** `docs/ARCHITECTURE.md` — Arquitectura Base y Contratos de Integración v1.0

---

## 1. Objetivo

Definir los escenarios principales con los que Producto/QA validará el comportamiento observable del MVP de MediFlow y establecer criterios claros para determinar si cada flujo cumple o no cumple lo esperado.

Este documento define **qué se debe comprobar**. Los documentos y datos sintéticos concretos para ejecutar los escenarios se preparan posteriormente en el Issue #8.

## 2. Regla general de validación

Cada ejecución QA debe disponer de:

- entrada conocida;
- resultado esperado definido antes de ejecutar;
- criterio PASS / FAIL;
- evidencia suficiente para reproducir el resultado;
- trazabilidad mediante `documento_id`.

### PASS
El comportamiento obtenido coincide con el resultado esperado y existe evidencia suficiente.

### FAIL
El comportamiento obtenido no coincide con el resultado esperado, falta una condición obligatoria o el sistema produce un resultado inseguro/incompatible con el contrato.

### BLOCKED
La prueba no puede ejecutarse por una dependencia aún no disponible. No equivale a FAIL. Al resolverse la dependencia debe ejecutarse nuevamente y terminar en PASS o FAIL.

Todo FAIL dentro del alcance obligatorio debe registrarse, corregirse y reejecutarse.

## 3. Contratos y estados que gobiernan las pruebas

Las pruebas se alinean con la baseline vigente:

### Entradas externas
- `POST /api/v1/documents/process-file`: PDF, JPG o PNG.
- `POST /api/v1/documents/process-text`: texto normalizado.

### Estados canónicos
- `RECEIVED`
- `PROCESSING`
- `PROCESSED`
- `NEEDS_AUDIT`
- `APPROVED`
- `REJECTED`
- `FAILED`

### Prioridad
- `RUTINA`
- `URGENTE`

### Destinos de negocio
- `EMERGENCIA_MEDICA`
- `FARMACIA`
- `AUDITORIA_AUTORIZACIONES`
- `HISTORIA_CLINICA`
- `REVISION_HUMANA`

### Motivos semánticos de auditoría
- `LOW_CONFIDENCE`
- `ILLEGIBLE_DOCUMENT`
- `MISSING_CRITICAL_FIELDS`
- `INCONSISTENT_DATA`

Los fallos técnicos (`AI_TIMEOUT`, `AI_UNAVAILABLE`, `INVALID_AI_RESPONSE`) son responsabilidad del Backend y se validan mediante pruebas controladas/fault injection, no mediante el contenido del documento.

El umbral inicial del MVP es `AUDIT_CONFIDENCE_THRESHOLD=0.85`, configurable. Una `confianza.global < 0.85` debe originar `LOW_CONFIDENCE`.

## 4. Escenario principal A — Flujo estándar / rutina

### Propósito
Comprobar que un documento clínico válido, legible, completo y sin señales de urgencia puede procesarse automáticamente de extremo a extremo sin intervención humana.

### Entrada esperada
Documento sintético soportado por el MVP, recibido por `process-file` o `process-text`, con información suficiente para clasificar y extraer datos de forma confiable.

### Resultado esperado
- el Backend acepta la entrada y conserva el original;
- el documento recorre `RECEIVED → PROCESSING → PROCESSED`;
- IA Core devuelve una respuesta válida según el contrato;
- `clasificacion.nivel_prioridad = RUTINA`;
- `confianza.global >= 0.85`;
- `audit_reasons = []`;
- `requiere_auditoria_humana = false`;
- `destino_principal` corresponde al contenido del documento y no es `REVISION_HUMANA`;
- `notificacion.generada = false`;
- original y `triage.json` quedan persistidos en el prefijo de rutina definido por arquitectura;
- la respuesta final es JSON estructurado y trazable mediante `documento_id`.

### PASS
Todos los puntos del resultado esperado se cumplen y existe evidencia.

### FAIL
Se produce cualquiera de estas condiciones:
- clasificación/prioridad/destino incorrectos;
- se deriva a auditoría sin causa válida;
- se inventan datos ausentes;
- falta persistencia o trazabilidad;
- la respuesta incumple el contrato.

## 5. Escenario principal B — Prioridad de urgencia médica

### Propósito
Comprobar que un documento con una señal clínica urgente reconocible recibe prioridad urgente y se enruta lógicamente a Emergencia Médica sin perder trazabilidad.

### Entrada esperada
Documento sintético soportado, legible y suficiente, cuyo contenido represente una condición de urgencia prevista para la demostración.

### Resultado esperado
- el documento se procesa de extremo a extremo;
- `clasificacion.nivel_prioridad = URGENTE`;
- `destino_principal = EMERGENCIA_MEDICA`;
- si no existen motivos de auditoría, el estado final es `PROCESSED`;
- `requiere_auditoria_humana = false` cuando el estado es `PROCESSED`;
- se genera la notificación de urgencia definida por Backend;
- original y `triage.json` quedan persistidos en `procesados/urgentes/`;
- la respuesta conserva `documento_id`, clasificación, datos extraídos, confianza, decisión de enrutamiento y almacenamiento.

### PASS
La urgencia es identificada, la prioridad y el destino son correctos, la notificación se genera y la persistencia/trazabilidad quedan confirmadas.

### FAIL
El caso urgente se trata como rutina, se dirige a un destino incorrecto, no genera la notificación prevista, pierde trazabilidad o entrega un resultado incompatible con el contrato.

## 6. Escenario principal C — Ambigüedad/error con revisión humana

### Propósito
Comprobar que MediFlow no automatiza como válido un documento ambiguo, ilegible, incompleto, inconsistente o de baja confianza y lo deriva de forma segura a revisión humana.

### Entrada esperada
Documento sintético que provoque al menos uno de estos motivos:
- `LOW_CONFIDENCE`;
- `ILLEGIBLE_DOCUMENT`;
- `MISSING_CRITICAL_FIELDS`;
- `INCONSISTENT_DATA`.

Los fallos técnicos se validan separadamente mediante fault injection.

### Resultado esperado
- el documento original queda recuperable;
- `status = NEEDS_AUDIT`;
- `requiere_auditoria_humana = true`;
- `decision_enrutamiento.destino_principal = REVISION_HUMANA` cuando no existe un destino confiable;
- `audit_reasons` contiene el/los motivo(s) aplicables;
- no se inventa información faltante o ilegible;
- el caso aparece en `GET /api/v1/documents/audit`;
- original y resultado quedan en `auditoria_humana/`;
- la interfaz permite revisión humana;
- una revisión válida puede terminar en `APPROVED` o `REJECTED`, conservando trazabilidad e historial.

### PASS
El sistema detecta la condición problemática, evita automatizarla como éxito normal y deja el caso disponible para revisión humana con el motivo correcto.

### FAIL
El sistema adivina datos, procesa el caso como válido sin control humano, pierde el original, no registra el motivo o no permite reconstruir qué ocurrió.

## 7. Matriz de validación funcional T01–T10

| ID | Validación | Resultado esperado / PASS | FAIL |
|---|---|---|---|
| T01 | Ingestión válida | Entrada soportada aceptada, `documento_id` válido y flujo iniciado. | Rechazo injustificado, pérdida del documento o imposibilidad de continuar. |
| T02 | Clasificación | `tipo_documento` pertenece al enum y coincide con el caso esperado. | Tipo incorrecto o salida fuera del contrato. |
| T03 | Extracción estructurada | Datos esperados presentes; desconocidos se omiten o quedan `null`; estructura válida. | Datos inventados, incorrectos o estructura inválida. |
| T04 | Confianza | Valores entre 0 y 1; decisión coherente con umbral y hallazgos. | Score inválido o decisión incompatible con la confianza. |
| T05 | Flujo estándar | Estado `PROCESSED`, prioridad `RUTINA`, sin auditoría y destino correcto. | Auditoría injustificada, estado/destino incorrecto o fallo de trazabilidad. |
| T06 | Urgencia | Prioridad `URGENTE`, destino `EMERGENCIA_MEDICA`, notificación y persistencia urgentes. | Caso urgente tratado como rutina o mal enrutado. |
| T07 | Ambigüedad / baja confianza | `NEEDS_AUDIT`, motivo correcto y revisión humana disponible. | Automatización insegura o información inventada. |
| T08 | Faltantes / inconsistencias | Motivo semántico correcto y flujo seguro a auditoría cuando corresponde. | Falta/contradicción ignorada o tratada como dato válido. |
| T09 | Persistencia OCI / trazabilidad | Original y `triage.json` quedan en el prefijo coherente con el estado; historial reconstruible. | Persistencia incorrecta, pérdida de original o ausencia de trazabilidad. |
| T10 | Fallo técnico controlado | Timeout/indisponibilidad/salida inválida producen fallback seguro según Backend y no falso éxito. | Error oculto, pérdida del caso o estado exitoso incorrecto. |

## 8. Evidencia mínima esperada

Para cada ejecución se debe conservar, como mínimo:

- ID de prueba;
- `documento_id`;
- entrada utilizada;
- resultado esperado;
- resultado obtenido;
- estado PASS / FAIL / BLOCKED;
- respuesta JSON o captura equivalente;
- evidencia del estado/destino final;
- evidencia de persistencia cuando aplique;
- observaciones;
- si hubo FAIL: causa, corrección y resultado de reejecución.

## 9. Cobertura del reto y del Issue #4

| Requisito | Cobertura |
|---|---|
| Flujo estándar documentado | Escenario A + T05 |
| Urgencia médica documentada | Escenario B + T06 |
| Ambigüedad/error con revisión humana | Escenario C + T07/T08/T10 |
| Entrada y resultado esperado por escenario | Secciones 4, 5 y 6 |
| Validación end-to-end | T05, T06, T07 y T09 |
| Contratos y estados de arquitectura | Sección 3 y matriz T01–T10 |
| Demo mínima de 3 escenarios | Rutina, Urgencia, Ambigüedad/Error |

## 10. Relación con Issue #8

El Issue #4 define **cómo se validará** MediFlow.

El Issue #8 debe crear posteriormente los **documentos y datos sintéticos concretos** necesarios para ejecutar estas pruebas, manteniendo como mínimo los tres escenarios principales y ampliando la cobertura según las necesidades de Producto/QA y de los squads técnicos.

## 11. Criterio de cierre del Issue #4

El Issue #4 puede pasar a revisión/cierre cuando:

- los tres escenarios principales están documentados;
- cada uno tiene entrada, resultado esperado, PASS y FAIL;
- la matriz T01–T10 está definida;
- PASS / FAIL / BLOCKED están establecidos;
- la evidencia mínima está definida;
- existe trazabilidad con la arquitectura vigente;
- la cobertura de rutina, urgencia y ambigüedad/revisión humana está confirmada;
- el entregable fue revisado por el equipo y las observaciones fueron resueltas.

---

**Nota de gobernanza:** este documento no modifica contratos técnicos. Si la arquitectura cambia, los escenarios deben actualizarse para seguir la baseline aprobada.
