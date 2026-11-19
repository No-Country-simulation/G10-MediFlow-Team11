# Validación documental del Ticket #84

## Alcance

Este registro reúne las comprobaciones documentales realizadas sobre la rama `task/84-documentation-standardization` y referencia evidencias existentes producidas por los equipos. Esta revisión no volvió a ejecutar pruebas funcionales, despliegues ni una campaña end-to-end; reutilizar una evidencia conserva su procedencia, revisión y límites originales.

## Estados utilizados

- **PASS:** comprobación ejecutada con evidencia local suficiente.
- **WARN:** observación o limitación que requiere atención.
- **NOT_VERIFIED:** comprobación no ejecutada o sin evidencia disponible para el alcance y la revisión indicados.

## Archivos documentales afectados

- `README.md`
- `CONTRIBUTING.md`
- `ai-core/README.md`
- `backend/README.md`
- `frontend/README.md`
- `test-data/README.md`
- `docs/architecture/README.md`
- `docs/frontend-ux/README.md`
- `docs/backend-cloud/README.md`
- `docs/local-demo.md`
- `docs/MediFlow_Datos_Prueba_Escenarios_MVP_v1.1.md`
- `docs/producto-qa/MediFlow_Escenarios_Prueba_Criterios_Aceptacion_MVP_v1.0.md`
- `docs/producto-qa/README.md`
- `docs/producto-qa/VALIDACION_DOCUMENTAL_TICKET_84.md`

Los documentos PDF sustituidos por Markdown se registran como eliminados:

- `docs/architecture/MediFlow Arquitectura v1.0.pdf`, sustituido por `docs/ARCHITECTURE.md`.
- `docs/architecture/MediFlow Contribucion.pdf`, sustituido por `CONTRIBUTING.md` después de incorporar la estructura del monorepo y el ciclo de vida de una tarea.

No se modificaron contratos, código funcional, scripts, infraestructura, configuración ni fixtures de prueba.

## Comandos y comprobaciones estáticas

| Comando o comprobación | Resultado | Estado |
|---|---|---|
| `git branch --show-current` | Rama observada: `task/84-documentation-standardization`. | PASS |
| `git rev-parse HEAD` | SHA observado: `4d9b50ee04e75539ee98b8d63e1c276b3784af7e`. | PASS |
| `git status --short` | Cambios documentales esperados y `CONTRIBUTING.md` como archivo nuevo; sin archivos inesperados identificados. | PASS |
| `git ls-files -- '*.md' '*.MD' '*.pdf' '*.PDF'` | Inventario versionado consultado sin recorrer directorios generados. | PASS |
| `git ls-files --error-unmatch -- <ruta-pdf>` | Los dos PDF documentales retirados estaban versionados en sus rutas declaradas. | PASS |
| Extracción local de texto con `pypdf` | Se compararon las secciones de ambos PDF con sus equivalentes Markdown. | PASS |
| `git diff --check` | Sin errores de whitespace; los avisos LF/CRLF, cuando aparecen, son informativos. | PASS |
| `git diff --stat` | Resumen de cambios consultado. | PASS |
| Validación de enlaces Markdown con resolución local y `Test-Path` | No se encontraron destinos relativos inexistentes en los archivos revisados. | PASS |

## Resultados documentales

- `docs/ARCHITECTURE.md` permanece como autoridad contractual y prevalece ante documentación histórica: **PASS**.
- Los README raíz y de componentes enlazan la documentación especializada y distinguen funcionalidades, responsabilidades y limitaciones: **PASS** documental.
- PASS, WARN y NOT_VERIFIED se distinguen de forma explícita en la documentación de Producto/QA: **PASS**.
- La guía `docs/local-demo.md` coincide estáticamente con su Compose y smoke script: **PASS** documental.
- El Ticket #84 no volvió a ejecutar el smoke test local, Docker, Gemini, OCI ni suites funcionales. Esto describe el alcance de esta revisión documental y no invalida las evidencias históricas enlazadas: **NOT_VERIFIED en esta revisión**.
- El Product Owner confirmó que [mediflowia.dev](https://mediflowia.dev/) está operativo y que las funcionalidades del MVP funcionan; la PR #89 documenta su publicación en OCI con HTTPS. El Ticket #84 registra esa evidencia aportada y no la presenta como una nueva ejecución propia: **PASS con evidencia del proyecto**.
- Los escenarios automáticos de rutina y urgencia no se validan mediante `local-demo`, que inicia IA Core sin Gemini: **NOT_VERIFIED**.
- PR #105: `lab_results` está declarado explícitamente en el modelo y en el esquema enviado a Gemini; las instrucciones prohíben inferir valores. Backend conserva la estructura en JSONB y Frontend la muestra y edita mediante controles estructurados: **PASS** estático.
- PR #106: CASE-002 prohíbe diagnósticos inferidos, CASE-005 espera dosis ausente como `null` y revisión, y CASE-007 conserva la duración indicada. La [reejecución registrada](../../test-data/CASE-104-REEXECUTION.md) reporta 98 pruebas de IA Core y 35 focalizadas aprobadas en la rama de corrección; su ejecución contra el despliegue entonces disponible tuvo resultados mixtos y no acreditó esa revisión. Código integrado: **PASS** estático y unitario reportado; el registro citado no establece por sí solo PASS end-to-end para esos casos corregidos.
- PR #90: `/help`, su navegación, las guías Archivo/Texto, los estados, los problemas frecuentes y las preguntas frecuentes están presentes en el código integrado. El [registro del equipo](./evidencias/ticket-76/README.md) reporta lint, build y 318/318 pruebas aprobadas, además de comprobaciones funcionales y visuales con límites explícitos: **PASS con evidencia reutilizada**.
- El [registro de OCI Compute](../backend-cloud/oci-compute-deployment-evidence.md) conserva verificaciones aportadas por el operador sobre servicios, PostgreSQL y Object Storage en la revisión allí identificada. Esas evidencias siguen siendo válidas para su alcance histórico, pero no acreditan el end-to-end clínico de la revisión integrada actual.

## Dependencias y limitaciones

- El HEAD local `4d9b50e` contiene la implementación documentalmente atribuida a PR #90, #105 y #106. No se consultó el estado remoto; la conclusión se limita al código local integrado: **PASS** estático.
- Las suites unitarias, el pipeline real, Gemini, OCI y la ejecución end-to-end no se ejecutaron de nuevo en esta actualización: **NOT_VERIFIED para la campaña del Ticket #84**.
- Las evidencias de otros equipos se citan con su procedencia y no se atribuyen a Codex ni a este ticket.
- El estado operativo del MVP procede de la confirmación del Product Owner, la PR #89 y las evidencias de los equipos; no se atribuye al Ticket #84 una nueva campaña end-to-end.
