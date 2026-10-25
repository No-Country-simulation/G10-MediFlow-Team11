# Contribución a MediFlow

Este documento consolida en Markdown las reglas vigentes de repositorio y flujo de contribución definidas para MediFlow. Los contratos técnicos del MVP se mantienen en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Estructura del monorepo

MediFlow utiliza un monorepo con separación lógica por componente:

```text
/backend
  Spring Boot
  Java 21
/frontend
  React
  TypeScript
  Vite
/ai-core
  Python
  FastAPI
  Pydantic
  LangGraph o pipeline Python puro
/docs
  Arquitectura
  Contratos API
  Diagramas
  Documentación técnica
/test-data
  Documentos y datos sintéticos para pruebas del MVP
```

Los archivos de `/test-data` utilizan únicamente datos sintéticos; no se incluye información clínica real ni información personal de terceros. La elección entre LangGraph y un pipeline Python puro corresponde a IA Core, manteniendo los contratos definidos en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Estrategia de ramas

El repositorio utiliza una estrategia simplificada:

- `main` es la rama estable para demostraciones, entregas e hitos. No recibe desarrollo directo y se actualiza desde `develop` mediante Pull Request.
- `develop` es la rama principal de integración. Las ramas de trabajo nacen desde `develop` y regresan a ella mediante Pull Request.
- Las versiones estables se promueven posteriormente de `develop` a `main`.

### Ramas de trabajo

| Tipo | Uso | Ejemplo |
|---|---|---|
| `feature/*` | Nuevas funcionalidades del producto. | `feature/12-document-upload` |
| `fix/*` | Corrección de defectos o comportamientos incorrectos. | `fix/18-file-validation` |
| `task/*` | Configuración, infraestructura, documentación, contratos, datos de prueba y otras tareas técnicas. | `task/1-init-backend` |

Los cambios puramente documentales utilizan normalmente `task/*`. Si la documentación forma parte de la corrección de un defecto, puede utilizarse `fix/*`.

Formato:

```text
feature/<issue>-<descripcion-corta>
fix/<issue>-<descripcion-corta>
task/<issue>-<descripcion-corta>
```

El nombre debe incluir el número del issue, usar minúsculas y kebab-case, evitar espacios, tildes y caracteres especiales, y mantener una descripción corta. No se utilizan identificadores manuales adicionales como `MF-01`.

## Convención de commits

Se utiliza una versión simplificada de Conventional Commits:

| Prefijo | Uso |
|---|---|
| `feat:` | Nueva funcionalidad. |
| `fix:` | Corrección de un defecto. |
| `docs:` | Cambios únicamente de documentación. |
| `test:` | Creación o modificación de pruebas. |
| `refactor:` | Modificación interna sin cambiar comportamiento. |
| `chore:` | Configuración, dependencias, Docker, tooling o mantenimiento. |

Los scopes, como `feat(backend):` o `fix(frontend):`, son opcionales.

Cada commit debe representar un cambio coherente y utilizar un mensaje descriptivo. Se evitan mensajes genéricos como `cambios`, `update`, `arreglo`, `final`, `ahora si` o `wip`. No se incluyen secretos, tokens, credenciales, claves API ni información sensible. Cuando sea posible, no se mezcla trabajo de issues diferentes. No se exige un único commit por issue.

## Pull Requests

Todo cambio destinado a `develop` o `main` debe ingresar mediante Pull Request.

El título sigue este formato:

```text
[#<issue>] <descripción>
```

El cuerpo incluye, como mínimo:

```markdown
Issue: #<número>

## Qué cambia
Descripción breve del trabajo realizado.

## Cómo se validó
Pruebas o verificaciones realizadas.
```

El Pull Request se vincula manualmente con su issue mediante la sección Development de GitHub. Para PR dirigidos a `develop` no se depende de expresiones como `Closes #1`, porque `main` es la rama predeterminada del repositorio.

## Aprobaciones e integración

### Hacia `develop`

- Pull Request obligatorio.
- Al menos una aprobación.
- Si se agregan nuevos commits, las aprobaciones anteriores dejan de ser válidas.
- Se bloquean la eliminación de la rama y los force-push.
- Se permiten Merge y Squash.
- Rebase no está permitido.
- No se exige Code Owners ni la resolución técnica obligatoria de todos los comentarios.
- Los comentarios sobre errores, integración o contratos compartidos deben atenderse antes del merge. Las sugerencias menores pueden quedar como mejoras posteriores si el equipo lo acuerda.

### Hacia `main`

- Pull Request obligatorio.
- Al menos una aprobación.
- Si se agregan nuevos commits, las aprobaciones anteriores dejan de ser válidas.
- Se bloquean la eliminación de la rama y los force-push.
- El único método permitido es Merge; Squash y Rebase no están permitidos.
- La promoción desde `develop` se realiza por hitos, cuando exista una versión suficientemente estable para demostración o entrega.
- El merge final debe coordinarse por un Tech Lead.
- El PR `develop` a `main` no debe abrirse prematuramente mientras sigan entrando cambios relevantes para el mismo hito, salvo acuerdo del equipo.

Una tarea se considera terminada cuando su implementación está integrada y validada en `develop`; no necesita esperar su promoción a `main`.

## Ciclo de vida de una tarea

```text
Issue
  ↓
Rama desde develop
  ↓
Implementación y commits
  ↓
Pull Request hacia develop
  ↓
Revisión y aprobación
  ↓
Merge hacia develop
  ↓
Cerrar issue
  ↓
Eliminar rama de trabajo
```

La tarea se considera terminada al quedar correctamente integrada y validada en `develop`; no necesita esperar su promoción a `main`, que se realiza por hitos.

## Contratos compartidos

Los cambios que afecten endpoints, DTO, estructuras de datos, estados, enums, contratos Backend-IA, contratos Backend-Frontend u otras interfaces compartidas deben comunicarse y acordarse previamente en el hilo **Arquitectura Y Contratos API**. No basta con comunicarlos por mensaje privado.

## Convención de idioma

- Documentación, issues y Pull Requests: español.
- Nombres de ramas y mensajes de commit: inglés.
- Identificadores de código, endpoints, enums y variables: conservan el idioma y la nomenclatura definidos en la arquitectura y los contratos técnicos.
