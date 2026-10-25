# MediFlow Frontend

Frontend de **MediFlow**, desarrollado con React y TypeScript. Esta aplicación proporciona la interfaz de usuario del sistema y se comunica exclusivamente con el Backend de MediFlow para el procesamiento de documentos clínicos.

## Stack tecnológico

* React
* TypeScript
* Vite
* Material UI (MUI)
* React Router

## Requisitos

Antes de ejecutar el proyecto es necesario contar con:

* Node.js compatible con Vite 8.3.0 (`^20.19.0 || >=22.12.0`)
* npm

## Instalación

Desde la carpeta `frontend/`:

```bash
npm install
```

## Configuración de entorno

Crea un archivo `.env` en la raíz de `frontend/` tomando como referencia `.env.example`.

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_USE_MOCKS=false
```

### `VITE_API_BASE_URL`

Define la URL base del Backend utilizado por el Frontend.

Ejemplo:

```env
VITE_API_BASE_URL=http://localhost:8080
```

### `VITE_USE_MOCKS`

Permite trabajar con respuestas simuladas sin depender de que Backend o AI Core estén disponibles.

Para utilizar la API real:

```env
VITE_USE_MOCKS=false
```

Para utilizar datos simulados:

```env
VITE_USE_MOCKS=true
```

## Ejecución local

Inicia el servidor de desarrollo con:

```bash
npm run dev
```

Por defecto, Vite expone la aplicación en:

```text
http://localhost:5173/
```

## Validación

Antes de enviar cambios, ejecutar:

```bash
npm run build
npm run lint
```

`npm run build` valida la compilación de TypeScript y genera el build de producción.

`npm run lint` ejecuta ESLint sobre el proyecto.

Para obtener una vista previa local del build de producción, ejecuta primero `npm run build` y después `npm run preview`.

## Estructura principal

```text
src/
├── components/
├── config/
├── layouts/
├── mocks/
├── pages/
├── routes/
├── services/
├── theme/
├── types/
├── App.tsx
├── index.css
└── main.tsx
```

### `components/`

Componentes reutilizables de la interfaz.

### `config/`

Configuración de la aplicación.

Actualmente contiene la configuración de variables de entorno utilizada para acceder al Backend y activar el modo mock.

### `layouts/`

Layouts compartidos entre páginas.

### `mocks/`

Datos simulados utilizados para desarrollar y probar el Frontend sin depender de los servicios externos.

Actualmente incluye escenarios de procesamiento exitoso y documentos que requieren auditoría.

### `pages/`

Páginas principales de la aplicación.

### `routes/`

Configuración de navegación mediante React Router.

### `services/`

Capa de comunicación con el Backend.

Los componentes y páginas no deben implementar directamente la lógica de comunicación HTTP.

### `theme/`

Configuración global de Material UI.

### `types/`

Contratos y tipos TypeScript compartidos, incluyendo los contratos utilizados para la integración con la API de procesamiento.

## Integración con Backend

El Frontend se comunica exclusivamente con el Backend de MediFlow.

Actualmente están preparados los siguientes endpoints:

### Procesamiento de archivos

```http
POST /api/v1/documents/process-file
```

Utiliza `multipart/form-data` para enviar el documento y sus datos asociados.

### Procesamiento de texto

```http
POST /api/v1/documents/process-text
```

Utiliza JSON para enviar texto clínico estructurado hacia el Backend.

Ambos endpoints retornan el contrato canónico de procesamiento definido por la arquitectura de MediFlow.

La implementación correspondiente se encuentra en:

```text
src/services/processingService.ts
```

## Manejo de errores de API

Los errores HTTP del Backend son normalizados por la capa de servicios mediante `ApiError`.

Un error conserva:

```text
status
code
message
```

Esto permite que las capas de interfaz puedan manejar errores sin interpretar directamente la respuesta HTTP del Backend.

## Contratos TypeScript

Los contratos relacionados con el procesamiento de documentos se encuentran en:

```text
src/types/processing.ts
```

Estos tipos representan las solicitudes, respuestas, estados, clasificación, validación, enrutamiento, almacenamiento y errores utilizados en la integración con Backend.

Los identificadores técnicos deben mantenerse alineados con los contratos definidos en [Arquitectura de MediFlow](../docs/ARCHITECTURE.md).

## Resultados, revisión clínica e historial

La vista de resultado presenta `extracted_data` de forma estructurada. Además de
los campos comunes, conserva y muestra campos adicionales por tipo de documento.
Para `STUDY_REPORT`, `lab_results` se representa como una lista legible de
resultados de laboratorio, omitiendo valores nulos sin inventar información.

La revisión clínica permite editar clasificación, datos extraídos, validación y
destino antes de aprobar o rechazar. Los campos comunes tienen controles
específicos; `lab_results` dispone de un editor visual por filas para `name`,
`value`, `unit` y `reference_range`. Los demás campos adicionales se editan como
JSON estructurado y se validan antes de enviar el `PATCH` al Backend. La interfaz
mantiene visible el documento original y evita perder cambios sin guardar.

La vista de Historial consulta
`GET /api/v1/documents/{id}/history` y presenta los snapshots confirmados del
triaje inicial y de las revisiones humanas. La visualización y edición descritas
están presentes en el código integrado; esta comprobación estática no sustituye
una validación funcional end-to-end.

## Modo Mock

Cuando:

```env
VITE_USE_MOCKS=true
```

la capa de servicios utiliza respuestas simuladas en lugar de realizar solicitudes al Backend.

Actualmente existen escenarios para:

* procesamiento exitoso;
* documento que requiere auditoría humana.

Los mocks se encuentran en:

```text
src/mocks/processingMocks.ts
```

El modo mock está destinado al desarrollo y pruebas del Frontend cuando los demás servicios todavía no están disponibles.

### Limitaciones del modo mock

* `processFile()` ignora el archivo seleccionado y devuelve siempre el resultado `DOC-2026-0002`. `getDocumentContent()` asocia cada identificador a un archivo estático de `public/mocks` (`mockDocumentFiles`). Por eso, en Resultado el visor muestra el documento de muestra y no el archivo elegido en Procesamiento, sea PDF, JPG o PNG.
* En modo texto, el texto ingresado llega a Resultado mediante `location.state` y solo si `VITE_USE_MOCKS=true`. Con el Backend real, el contenido se consulta en `GET /api/v1/documents/{id}/content`.
* Los resultados de `DOC-2026-0001` a `DOC-2026-0005` están fijos en `src/mocks/resultMocks.ts`.
* La coherencia entre el archivo enviado y el visor solo puede verificarse con el Backend real (`VITE_USE_MOCKS=false`).

## Convenciones

* El código y los identificadores técnicos se escriben en **inglés**.
* Los textos visibles para el usuario se escriben en **español**.
* El Frontend no debe comunicarse directamente con AI Core; toda comunicación externa debe realizarse mediante Backend.
* Los contratos de integración deben respetar `ARCHITECTURE.md`.
* La configuración dependiente del entorno no debe hardcodearse en componentes o servicios.
* Los archivos `.env` locales no deben versionarse.
* `.env.example` documenta las variables necesarias para ejecutar el proyecto.

## App Shell y navegación global

La aplicación utiliza un App Shell reutilizable definido en:

```text
src/layouts/AppLayout.tsx
```
El layout mantiene una estructura común para las vistas principales:

-   sidebar persistente;
-   header sobre el área principal;
-   contenido dinámico mediante rutas anidadas de React Router.

La navegación principal incluye:

-   `Inicio` (`/`);
-   `Procesamiento` (`/processing`);
-   `Auditoría` (`/audit`);
-   `Historial` (`/history`).

Las vistas de Resultado y Revisión Clínica utilizan rutas contextuales. Configuración está disponible en `/settings`.

Las nuevas vistas que utilicen el App Shell deben integrarse como rutas hijas de `AppLayout` para reutilizar sidebar y header.

## Notificaciones y errores

El sistema global de notificaciones se encuentra en:

```
src/notifications/
```

Las vistas pueden utilizar `useNotification()` para mostrar mensajes de:

-   éxito;
-   advertencia;
-   error.

Para errores provenientes de servicios, `showError(error)` convierte el error en un mensaje seguro para el usuario.

La normalización de errores HTTP permanece en la capa de servicios. La interfaz no debe mostrar directamente códigos de error, stack traces, URLs internas u otros detalles técnicos sensibles.

El Centro de ayuda está disponible en `/help` y desde la navegación. Incluye
guías diferenciadas para procesar archivos y texto, explicación de resultados,
auditoría y estados, además de problemas frecuentes y preguntas frecuentes.
Configuración permite seleccionar la apariencia: claro, oscuro o sistema.

## Formulario de procesamiento de documentos

La vista `/processing` permite iniciar el procesamiento de un documento clínico mediante archivo o texto.

La implementación principal se encuentra en:

```text
src/pages/ProcessingPage.tsx
```

### Modos de entrada

El formulario admite dos modos:

-   **Archivo:** permite seleccionar un archivo mediante el selector del sistema o arrastrarlo al área de carga.
-   **Texto:** permite ingresar directamente el contenido clínico en un campo de texto.

Los formatos de archivo admitidos actualmente son:

-   PDF;
-   JPG/JPEG;
-   PNG.

El tamaño máximo permitido por archivo es de **10 MB**. La validación de formato y tamaño se realiza antes de enviar el documento a la capa de servicios.

### Datos del procesamiento

Además del contenido, el formulario permite indicar:

-   **Canal de origen:** obligatorio. Incluye los canales más comunes y una opción `Otro` que habilita un campo de texto libre.
-   **ID del documento:** no se solicita manualmente; el Backend determina el identificador y lo devuelve en la respuesta.

`origin_channel` se mantiene como `string` en el contrato enviado al Backend.

### Envío y validación

Antes de procesar el documento, la vista valida los campos requeridos según el modo de entrada seleccionado.

Una vez validado el formulario:

-   los archivos se procesan mediante `processFile()`;
-   el texto se procesa mediante `processText()`;
-   los controles de acción se deshabilitan mientras la solicitud está en curso;
-   la interfaz informa al usuario que el documento está siendo procesado;
-   el resultado de la operación se comunica mediante el sistema global de notificaciones.

Los errores provenientes de la capa de servicios se presentan mediante `showError()` para evitar exponer detalles técnicos del Backend.

El botón `Limpiar` restablece el contenido y los estados del formulario.

## Documentación por ticket

Este `README.md` es la documentación técnica principal del escuadrón Frontend.

Debe actualizarse cuando un ticket introduzca cambios relevantes en la instalación, estructura, configuración, arquitectura, integración o forma de ejecutar el Frontend.
