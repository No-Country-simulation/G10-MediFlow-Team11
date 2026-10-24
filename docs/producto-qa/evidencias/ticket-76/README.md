# MediFlow — Ticket #76 — Evidencias seleccionadas para PR #90

**Preparación:** 24 de octubre de 2026
**Rama de trabajo:** `feature/76-help-center`
**Destino:** `develop`
**Estado:** paquete preparado, **no integrado ni publicado**. La integración local de `origin/develop` continúa pendiente de completar y verificar.

## Alcance

Selección reducida de **8 capturas auténticas** aportadas por Producto/QA tras integrar los cambios de `develop`, incluida la nueva identidad visual y las opciones Claro/Oscuro/Sistema de PR #99. Las capturas se conservan tal como se recibieron, sin cambiar logo, contenidos ni marcas de resaltado mediante edición.

## Evidencias vigentes

| Archivo | Qué demuestra | Estado |
|---|---|---|
| `01-help-escritorio.png` | Página de ayuda, nuevo logo, navegación y advertencia de MVP | Revisada visualmente |
| `03-guias-archivo-texto.png` | Ambas tarjetas de guía, nuevo logo y navegación | Revisada visualmente |
| `07-guia-archivo-ampliada.png` | Guía Archivo ampliada, paso 3/6 y resaltado | Revisada visualmente |
| `08-guia-texto-ampliada.png` | Guía Texto ampliada, paso 3/6 y resaltado | Revisada visualmente |
| `04c-preguntas-frecuentes.png` | Listado de las 13 preguntas frecuentes | Revisada visualmente |
| `16-help-modo-oscuro.png` | Compatibilidad visual: Revisión humana y Estados del documento en modo oscuro | Revisada visualmente |
| `17-help-movil-375.png` | Centro de ayuda en simulación móvil 375 px | Evidencia visual de viewport |
| `18-help-movil-320.png` | Centro de ayuda en simulación móvil 320 px | Evidencia visual de viewport |

> Las evidencias móviles incluyen la barra de herramientas de simulación de dispositivo para mostrar el ancho comprobado. No representan una auditoría responsive completa.

## Cambios funcionales cubiertos

- Siete secciones del Centro de ayuda y **13 preguntas frecuentes**; cuatro de ellas explican los modos de apariencia y acceso a `/settings`.
- Configuración habilitada junto a Centro de ayuda en navegación lateral.
- Dos guías interactivas de seis pasos cada una, con capturas de Procesamiento actualizadas al nuevo logo.
- Apariencia clara/oscura: comprobación visual manual; comportamiento de Sistema respaldado por análisis estático y pruebas de la aplicación, sin afirmar prueba visual independiente del cambio automático del SO.

## Validación técnica comunicada por Codex (estado previo al paquete)

| Validación | Resultado |
|---|---|
| `npm run lint` | PASS |
| `npm run build` | PASS, advertencia no bloqueante de chunk >500 kB |
| `npm run test -- --run --isolate` | **318/318 PASS**, 40/40 archivos |
| Corrección pixel a pixel de línea residual en ambos PNG de las guías | Inspección y build PASS; suite final **318/318 PASS**, 40/40 archivos |
| Merge Git | En curso; conflictos resueltos y registrados en el índice, pendiente de validación final y commit local |

La ejecución histórica estándar de Vitest sin aislamiento (181/185, cuatro fallos en `documentListService.test.ts`) fue registrada en la descripción previa de la PR. Corresponde mantenerla como antecedente, sin afirmar que fue resuelta por este ticket.

## Límites y advertencias

- Estas son evidencias seleccionadas, no sustituyen el plan QA, las pruebas automatizadas ni la revisión humana.
- Las capturas de modal documentan el paso 3/6; **no certifican por sí solas** los doce pasos. La revisión funcional manual se registró por separado.
- Los enlaces a Historial, Auditoría y Revisión Clínica se mantienen cubiertos funcionalmente por QA previo, sin adjuntar capturas duplicadas de módulos de otros tickets.
- No se incluyen datos clínicos reales. Se utilizan ejemplos sintéticos de demostración.
- Los archivos de referencia de `frontend/src/assets/help/references/` no deben añadirse al control de versiones.
- Antes de reemplazar evidencias antiguas: hacer respaldo local, revisar la diferencia de archivos, mantener únicamente estas ocho en el directorio versionado del ticket y actualizar los enlaces de la descripción de PR #90.
- Pendiente: completar el merge con `origin/develop`, revisar Git, repetir QA final tras las modificaciones, realizar commit/push autorizados y solicitar nueva revisión de PR #90.

**Esta documentación no declara aprobada la PR ni autoriza su integración.**
