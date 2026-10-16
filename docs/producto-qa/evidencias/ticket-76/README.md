# Ticket #76 - Evidencias del Centro de ayuda

## Alcance

Evidencias de Producto/QA para la implementación del Centro de ayuda (`/help`).
Las capturas deben usar datos no sensibles y mostrar exclusivamente la interfaz necesaria para validar el ticket.

## Evidencias visuales

Las siguientes ocho capturas fueron incorporadas y revisadas para documentar el Ticket #76.

| Archivo | Cobertura | Estado |
|---|---|---|
| `01-help-escritorio.png` | Encabezado final, indice y diseño de escritorio | PASS |
| `02-help-movil-problemas.png` | Adaptacion movil y problemas frecuentes | PASS |
| `03-guias-archivo-texto.png` | Presentacion de las guias de Archivo y Texto | PASS |
| `04a-estados-documento.png` | Estados oficiales del documento | PASS |
| `04b-estado-fallido-problemas.png` | Estado fallido y problemas frecuentes | PASS |
| `04c-preguntas-frecuentes.png` | Presentacion de las preguntas frecuentes | PASS |
| `05a-volver-inicio-movil.png` | Boton Volver al inicio en movil | PASS |
| `05b-volver-inicio-escritorio.png` | Boton Volver al inicio en escritorio | PASS |

PASS indica que la evidencia visual esta presente y fue revisada. Las capturas no sustituyen las pruebas funcionales.

Las guías oficiales utilizadas por la pantalla ya están disponibles en:

- `frontend/src/assets/help/guia-archivo.png`
- `frontend/src/assets/help/guia-texto.png`

El archivo `frontend/src/assets/help/references/centro-ayuda-boceto-aprobado.png` es una referencia local y debe excluirse del commit y de la PR.

## Evidencias técnicas

Validaciones ejecutadas desde el worktree de `feature/76-help-center` el 15 de octubre de 2026:

| Validación | Resultado | Evidencia |
|---|---|---|
| `git diff --check` | PASS | Código de salida 0; solo avisos informativos de conversión LF a CRLF en `AppSidebar.tsx` y `AppRoutes.tsx` |
| `npm run lint` | PASS | ESLint finalizó con código de salida 0 |
| `npm run build` | PASS | TypeScript y Vite finalizaron con código de salida 0; Vite emitió una advertencia no bloqueante por chunks mayores a 500 kB |
| `npm run test` | PASS | 6 archivos y 83 pruebas aprobadas |
| Pruebas focalizadas de `HelpPage.test.tsx` | PASS | 14 pruebas aprobadas, incluidas T76-01 a T76-10 y cuatro casos del botón Volver al inicio |

## Cobertura automatizada focalizada

- Renderizado de `HelpPage` con encabezado uniforme respecto de Procesamiento y Auditoría, sin breadcrumb adicional.
- Siete secciones y correspondencia de los siete enlaces internos.
- Ocho preguntas frecuentes y uso de controles desplegables nativos cerrados inicialmente.
- Siete estados oficiales.
- Prioridades `ROUTINE` y `URGENT` agrupadas.
- Dos guías visuales con enlaces de ampliación.
- Ruta `/help` dentro de `AppLayout`.
- Centro de ayuda habilitado, Configuración deshabilitada y conexión del cierre del menú móvil.
- Botón Volver al inicio oculto inicialmente, visible tras el umbral, desplazamiento al inicio y respeto de `prefers-reduced-motion`.

## Verificaciones manuales

| Comprobacion | Resultado |
|---|---|
| Diseño de escritorio y movil | PASS |
| Visualizacion de guias de Archivo y Texto | PASS |
| Navegacion e indice de secciones | PASS |
| Apertura y cierre de preguntas frecuentes | PASS |
| Boton Volver al inicio en escritorio y movil | PASS |
| Evidencia del pipeline de la PR | PENDIENTE, cuando este disponible |

Los resultados PASS de esta seccion corresponden a las verificaciones manuales realizadas durante la revision de Producto/QA.
