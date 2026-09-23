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

* Node.js
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

Los identificadores técnicos deben mantenerse alineados con los contratos definidos en `ARCHITECTURE.md`.

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

## Convenciones

* El código y los identificadores técnicos se escriben en **inglés**.
* Los textos visibles para el usuario se escriben en **español**.
* El Frontend no debe comunicarse directamente con AI Core; toda comunicación externa debe realizarse mediante Backend.
* La comunicación externa del Frontend se realiza mediante Backend.
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

La navegación global incluye únicamente:

-   `Procesamiento` (`/processing`);
-   `Auditoría` (`/audit`).

Las vistas de resultado e historial se consideran navegación contextual asociada a un documento y no forman parte de la navegación global.

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

## Documentación por ticket

Este `README.md` es la documentación técnica principal del escuadrón Frontend.

Debe actualizarse cuando un ticket introduzca cambios relevantes en la instalación, estructura, configuración, arquitectura, integración o forma de ejecutar el Frontend.
