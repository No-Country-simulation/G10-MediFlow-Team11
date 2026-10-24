# MediFlow — Ticket #76 — Evidencias del Centro de ayuda

**Actualización:** 24 de octubre de 2026
**Pull request:** [#90 — Centro de ayuda](https://github.com/No-Country-simulation/G10-MediFlow-Team11/pull/90)
**Issue:** #76
**Rama:** `feature/76-help-center` → `develop`
**Estado:** evidencias publicadas; PR pendiente de revisión y aprobación del equipo.

## Alcance

Este directorio reúne **ocho evidencias visuales seleccionadas** del Centro de ayuda de MediFlow (`/help`), correspondientes a la versión integrada con la identidad visual y las preferencias de apariencia Claro, Oscuro y Sistema incorporadas en la PR #99.

Las capturas muestran la interfaz de la aplicación y complementan, pero no sustituyen, las pruebas automatizadas ni las verificaciones funcionales. El conjunto reducido evita duplicar capturas de módulos desarrollados en otros tickets.

## Evidencias visuales

| Archivo | Qué documenta |
|---|---|
| `01-help-escritorio.png` | Centro de ayuda en escritorio, nuevo logo, índice y navegación actualizada. |
| `03-guias-archivo-texto.png` | Acceso a las visitas guiadas de Archivo y Texto. |
| `04c-preguntas-frecuentes.png` | Sección de preguntas frecuentes, con 13 preguntas. |
| `07-guia-archivo-ampliada.png` | Visita guiada de Archivo ampliada, paso 3 de 6, con indicación visual sobre la captura vigente. |
| `08-guia-texto-ampliada.png` | Visita guiada de Texto ampliada, paso 3 de 6, con indicación visual sobre la captura vigente. |
| `16-help-modo-oscuro.png` | Centro de ayuda en modo oscuro, con secciones de revisión humana y estados del documento. |
| `17-help-movil-375.png` | Presentación del Centro de ayuda en una simulación móvil de 375 px. |
| `18-help-movil-320.png` | Presentación del Centro de ayuda en una simulación móvil de 320 px. |

Las capturas móviles incluyen controles de simulación del navegador que permiten identificar el ancho de pantalla comprobado. Las imágenes corresponden a ejemplos de demostración, sin datos clínicos personales reales.

## Funcionalidades documentadas

- Siete secciones informativas del Centro de ayuda.
- Trece preguntas frecuentes, incluidas cuatro relacionadas con Claro, Oscuro, Sistema y persistencia de la preferencia.
- Navegación habilitada hacia `/help` y `/settings`, además de enlaces informativos a Procesamiento, Historial y Auditoría.
- Dos visitas guiadas interactivas de seis pasos cada una, con capturas de Procesamiento actualizadas y resaltados recalibrados.
- Compatibilidad del Centro de ayuda con las variables de apariencia oficiales de MediFlow, sin sistema de temas paralelo.
- Advertencias del MVP sobre datos sintéticos y destinos simulados.

## Validaciones

Resultados de la validación final comunicada para la rama `feature/76-help-center` el **24 de octubre de 2026**:

| Validación | Resultado |
|---|---|
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| `npm run test -- --run --isolate` | **PASS — 318/318 pruebas, 40 archivos** |
| Resolución de conflictos de integración | **PASS — 0 conflictos pendientes** |
| Centro de ayuda en Claro y Oscuro | **PASS visual**, en las vistas comprobadas |
| Guías de Archivo y Texto | **PASS funcional y visual**, en los recorridos comprobados |
| Capturas actualizadas y resaltados | **PASS visual**, en los pasos revisados |
| Vista móvil a 375 y 320 px | **PASS visual**, en las pantallas comprobadas |
| Opción Sistema | **PASS estático**; cambio automático del sistema operativo **NOT_VERIFIED** visualmente |
| Auditoría WCAG, seguridad y responsive exhaustiva | **No realizadas** |

### Observaciones y límites

- La suite histórica ejecutada **sin aislamiento** presentó cuatro fallos (`181/185`) en `documentListService.test.ts`; las pruebas individuales aprobaron y la suite final con `--isolate` aprobó `318/318`. La causa raíz de aquella interferencia no se ha confirmado y no se declara resuelta por este ticket.
- El build presenta una advertencia no bloqueante por un chunk superior a 500 kB.
- Dos advertencias de formato heredadas de `develop` se identificaron en `AppearancePreview.tsx` y `settings-page.css`, sin atribuirlas a las modificaciones funcionales del Centro de ayuda.
- Las capturas ampliadas evidencian el **paso 3 de 6** de cada guía; no constituyen por sí solas prueba visual de los doce pasos.
- La navegación hacia Historial, Auditoría y Revisión Clínica se validó funcionalmente dentro del alcance del ticket; no se certifica el funcionamiento integral de esos módulos ajenos.
- Las evidencias móviles cubren pantallas concretas y no representan una auditoría responsive integral.

## Referencias técnicas

- [Centro de ayuda y preguntas frecuentes](../../../../frontend/src/pages/HelpPage.tsx)
- [Componente de visitas guiadas](../../../../frontend/src/pages/HelpGuide.tsx)
- [Pruebas del Centro de ayuda](../../../../frontend/src/pages/HelpPage.test.tsx)

**Este registro documenta evidencias y validaciones; no implica aprobación de la PR ni autorización para integrarla a `develop`.**
