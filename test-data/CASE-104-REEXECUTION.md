# Reejecución de validación #104

Fecha: 2026-10-24 (America/Bogota)

## Build y pruebas locales de IA Core

- Rama: fix/104-ai-core-clinical-cases.
- Commit de código: 4a03d0f.
- Suite completa: 93 passed, 3 advertencias deprecadas de dependencias.
- Imagen local de IA Core reconstruida; su contenedor quedó healthy.

## Prueba directa del endpoint local de IA Core

Se enviaron los siete fixtures al endpoint local POST http://127.0.0.1:8001/api/v1/ai/process. Todos respondieron HTTP 503 AI_UNAVAILABLE.

| Caso | Estado de la prueba directa | Evidencia |
|---|---|---|
| CASE-001 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-002 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-003 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-004 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-005 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-006 | BLOCKED | HTTP 503 AI_UNAVAILABLE |
| CASE-007 | BLOCKED | HTTP 503 AI_UNAVAILABLE |

Esta prueba llamó IA Core directamente. No ejercitó el recorrido completo del Backend ni la persistencia en OCI, así que no debe tomarse como validación end-to-end del puente mencionado por Producto/QA. El endpoint devuelve un error genérico y no permite atribuir el 503 a una causa concreta.

## Disponibilidad del flujo Backend/OCI

- GET https://mediflowia.dev/actuator/health respondió UP; es una comprobación de health, no de procesamiento.
- La documentación del proyecto expone el flujo funcional por POST /api/v1/documents/process-text y POST /api/v1/documents/process-file en mediflowia.dev.
- No se enviaron documentos a ese servicio en esta validación. La guía de despliegue indica que las solicitudes públicas persisten documentos en OCI, pueden consumir cuota de Gemini y deben usar solo datos sintéticos con el entorno autorizado y actualizado.
- El Backend local está healthy, pero su configuración usa instance_principal, no tiene OCI_NAMESPACE configurado ni un montaje de configuración OCI. No se confirmó acceso local a OCI.
- El perfil local-demo no sirve para validar extracción real: deshabilita GEMINI_API_KEY y GEMINI_MODEL, y utiliza fallback con almacenamiento local.
- No se desplegó la rama a OCI. Por tanto, tampoco se confirmó que mediflowia.dev esté ejecutando el commit 4a03d0f.

## Estado de aceptación

Las pruebas unitarias y de contrato pasan. La reejecución funcional end-to-end de CASE-001 a CASE-007 contra el commit de esta rama sigue pendiente. Para hacerla se necesita un entorno de QA/puente autorizado que ejecute esta revisión, permita persistir los fixtures sintéticos y tenga Gemini disponible. Las respuestas de la prueba directa local no sustituyen esa validación.
