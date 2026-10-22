# Ticket #76 — Evidencias actualizadas del Centro de ayuda

**Fecha de revisión:** 22 de octubre de 2026
**Rama de trabajo:** `feature/76-help-center`
**PR:** [#90](https://github.com/No-Country-simulation/G10-MediFlow-Team11/pull/90)
**Estado:** actualización preparada; **aún no publicada ni confirmada en el repositorio local**.

## Alcance

Producto/QA del Centro de ayuda (`/help`) tras integrar `develop` (`603212b`) e incorporar Historial (#98) y Revisión Clínica (#100). Se documenta navegación, texto instructivo, guías interactivas y validaciones funcionales. Las capturas son evidencia visual, no reemplazan los resultados de las pruebas.

## Capturas de esta actualización

| Archivo | Contenido | Evidencia |
|---|---|---|
| `01-help-escritorio.png` | Encabezado, índice y limitaciones del MVP | Captura 22-oct |
| `03-guias-archivo-texto.png` | Guías interactivas de Archivo y Texto | Captura 22-oct |
| `04a-estados-documento.png` | Siete estados documentados, incluido FAILED | Captura 22-oct |
| `04b-estado-fallido-problemas.png` | Problemas frecuentes actualizados; FAILED se ve en `04a` | Captura 22-oct |
| `04c-preguntas-frecuentes.png` | Nueve FAQ, incluida consulta del Historial | Captura 22-oct |
| `06-revision-humana-auditoria.png` | Nueva instrucción de Revisión Clínica y enlace a Auditoría | Captura 22-oct |
| `07-guia-archivo-ampliada.png` | Modal Archivo, paso 3/6 | Captura 22-oct |
| `08-guia-texto-ampliada.png` | Modal Texto, paso 3/6 | Captura 22-oct |
| `09-acceso-historial.png` | Pantalla `/history` alcanzada desde el Centro de ayuda | Navegación verificada |
| `10-acceso-auditoria.png` | Pantalla `/audit` alcanzada desde el Centro de ayuda | Navegación verificada |
| `11-revision-clinica.png` | Ruta `/audit/TEST-CASE-002/review` abierta desde Auditoría | Navegación verificada |
| `12-guia-archivo-movil-375.png` | Tarjeta de guía Archivo en vista móvil de 375 px | Captura y revisión visual 22-oct |
| `13-modal-guia-archivo-movil-375.png` | Modal de visita guiada Archivo en vista móvil de 375 px | Captura y revisión visual 22-oct |
| `14-guia-texto-movil-320.png` | Guía Procesar texto en ancho móvil de 320 px | Captura y revisión visual 22-oct |
| `15-modal-guia-texto-movil-320.png` | Modal Procesar texto, paso 4/6, ancho 320 px | Captura y revisión visual 22-oct |

En las capturas móviles proporcionadas se recortó **únicamente la barra del navegador** para no incluir marcadores de navegación privados. No se modificó el contenido visible de la aplicación.

### Evidencias anteriores que no se reemplazan todavía

- `02-help-movil-problemas.png`: la captura anterior se conserva como referencia histórica. evidencia anterior conservada sin reemplazo. Se revisó la versión integrada a 375 px en `12-guia-archivo-movil-375.png`; se comprobó la guía Texto a 320 px con `14` y `15`. Sigue pendiente una captura específica de Problemas frecuentes en la versión móvil actual.
- `05a-volver-inicio-movil.png`: se conserva la evidencia antigua; funcionamiento móvil actual **NOT_VERIFIED**.
- `05b-volver-inicio-escritorio.png`: se conserva la evidencia antigua; en capturas actuales el botón es visible, pero no se adjuntó una nueva captura específica de su interacción.

**Advertencia:** el reemplazo de `04b` conserva el nombre histórico del archivo, pero su captura nueva muestra Problemas frecuentes; el estado FAILED figura en `04a`. Si el equipo requiere correspondencia estricta entre nombre y contenido, renombrar esta evidencia y actualizar los enlaces de la PR de forma coordinada.

## Guías incluidas en el código (no confundir con capturas de evidencia)

- `frontend/src/pages/HelpGuide.tsx`
- `frontend/src/assets/help/procedimiento-archivo.png`
- `frontend/src/assets/help/procedimiento-texto.png`

Las imágenes originales de guía ya no son `guia-archivo.png` / `guia-texto.png` para la implementación final.
La carpeta `frontend/src/assets/help/references/` queda excluida de los commits.

## Validación técnica registrada

| Prueba | Resultado | Alcance |
|---|---|---|
| `git diff --cached --check` | PASS | Sin errores; avisos informativos LF/CRLF |
| `npm run build` | PASS | TypeScript + Vite; aviso de chunk grande no bloqueante |
| `npm run lint` | PASS | ESLint |
| `npm run test -- --run` | **FAIL: 181/185** | Cuatro fallos de `documentListService.test.ts` en modo compartido (`isolate: false`) |
| `npm run test -- --run src/services/documentListService.test.ts` | PASS: 4/4 | Pruebas aisladas del servicio |
| `npm run test -- --run --isolate` | **PASS: 185/185** | 25 archivos; aislamiento activado mediante CLI |
| `src/pages/HelpPage.test.tsx` | PASS: 22/22 | Incluidas en la ejecución final con aislamiento |

**Observaciones:** el cambio `isolate: false` → `--isolate` en ejecución elimina los fallos observados y apunta a interferencia entre módulos de pruebas; **causa raíz exacta NOT_VERIFIED**. Vitest advirtió uso de build `legacy` en Node durante `HelpPage.test.tsx`, sin fallos. No se modificaron los servicios ni configuración ajenos al ticket.

## Validación funcional manual

| Comprobación | Estado |
|---|---|
| Centro de ayuda y siete secciones, escritorio | PASS — capturas revisadas |
| Enlace en Problemas frecuentes → `/history` | PASS — navegación confirmada |
| Enlace Auditoría → `/audit` | PASS — navegación confirmada |
| Auditoría → `/audit/TEST-CASE-002/review` | PASS — navegación confirmada |
| Ventanas ampliadas de Archivo y Texto | PASS — capturas revisadas |
| Siguiente / Anterior / Ir al paso 6 / Reiniciar / Cerrar | PASS — confirmado manualmente por Producto/QA |
| Navegación con teclado | PASS — confirmado manualmente por Producto/QA |
| Diseño de guía y modal final a 375 px | **PASS visual** — capturas 12 y 13 revisadas |
| Controles Anterior / Siguiente / Ampliar detalle / Cerrar en móvil | **PASS funcional** — confirmado manualmente por Producto/QA |
| Navegación mediante teclado en vista móvil | **PASS** — confirmado manualmente por Producto/QA |
| Diseño guía Texto y modal a 320 px | **PASS visual** — capturas 14 y 15, sin cortes evidentes |
| Diseño completo de las demás secciones a 320 px | **NOT_VERIFIED** |
| Auditoría WCAG exhaustiva | NO REALIZADA |

Las pantallas de Historial y Revisión Clínica corresponden a módulos de otros tickets. Aquí solo se certifica la navegación desde el Centro de ayuda, no todo el flujo funcional de esos módulos.

## Pendientes antes de publicar y solicitar revisión

1. Copiar las imágenes de este paquete a `docs/producto-qa/evidencias/ticket-76/` en el worktree local de T76; reemplazar únicamente los cinco archivos antiguos de igual nombre. Mantener las tres imágenes antiguas indicadas arriba hasta nueva validación.
2. Reemplazar el README por este documento, y verificar rutas y nombres.
3. Las guías tienen evidencia a 375 px (Archivo) y 320 px (Texto); si se exige cobertura móvil integral, validar las demás secciones a 320 px.
4. Confirmar que no haya datos sensibles y que `references/` siga excluida.
5. Revisar `git diff --cached --check` y la lista exacta de archivos antes del commit final.
6. Tras autorización del Product Owner, commit y push; **después** actualizar la descripción de la PR #90, reemplazando cifras de pruebas e imágenes antiguas.
7. Mantener la observación anterior sobre commits en español y solicitud de `Squash and merge` sujeta a revisión de equipo.

**Este README no declara la PR aprobada ni cierra el ticket.**
