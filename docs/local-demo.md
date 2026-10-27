# MediFlow local-demo (PostgreSQL y archivos aislados)

`local-demo` es un perfil Spring explícito para pruebas locales. Sustituye el cliente de OCI Object Storage por archivos persistentes en un volumen Docker; no inicializa autenticación ni cliente OCI. El Backend mantiene los mismos endpoints y contratos. Fuera de este perfil, sigue usando OCI.

El Compose dedicado usa el proyecto `mediflow22-local-demo`, los volúmenes `local_demo_postgres` y `local_demo_objects`, y publica solo el Backend en `127.0.0.1:18080`. PostgreSQL e IA Core permanecen en la red privada del proyecto. El Backend sigue ejecutándose como `appuser`; `storage-init` ajusta permisos únicamente en el volumen aislado de objetos.

## Requisitos y dependencias

- Docker Desktop con Docker Compose compatible con `up --wait`.
- PowerShell 7 o posterior para `scripts/local-demo-smoke.ps1`; el script usa APIs modernas de .NET para verificar el hash del archivo sintético.
- Node.js compatible con Vite 8.3.0 (`^20.19.0 || >=22.12.0`) para ejecutar el Frontend fuera de Compose.
- `curl.exe`, utilizado por el smoke test para la carga multipart.

No requiere credenciales de OCI ni de Gemini. Compose inicia PostgreSQL, IA Core, `storage-init` y Backend; el Frontend se inicia por separado con Node.js. Solo se publican Backend (`127.0.0.1:18080`) y el servidor de desarrollo del Frontend (`127.0.0.1:5174`).

## Arranque (PowerShell, desde la raíz del repositorio)

Genere una contraseña desechable y consérvela en **la misma sesión de PowerShell** para futuros `docker compose up` sobre este volumen. `LOCAL_DEMO_DB_PASSWORD` solo se entrega a PostgreSQL y Backend dentro de este proyecto. No la escriba en archivos ni use credenciales de otros entornos.

```powershell
$env:LOCAL_DEMO_DB_PASSWORD = [guid]::NewGuid().ToString('N')
docker compose -p mediflow22-local-demo -f compose.local-demo.yaml up -d --build --wait
Invoke-RestMethod 'http://127.0.0.1:18080/actuator/health'
```

En otra terminal, arranque el Frontend con la API real. Estas variables de proceso prevalecen sobre `frontend/.env` sin modificarlo; Vite reenvía `/api/v1` al Backend de loopback.

```powershell
Set-Location frontend
$env:VITE_USE_MOCKS = 'false'
$env:VITE_API_BASE_URL = 'http://127.0.0.1:18080'
npm ci # solo si faltan las dependencias
.\node_modules\.bin\vite.cmd --port 5174
```

Abra `http://127.0.0.1:5174/processing`. El proxy de desarrollo escucha solo en `127.0.0.1`. No se modifica la configuración de producción.

## Smoke test persistente

IA Core arranca **sin Gemini**. Su respuesta de indisponibilidad activa el fallback técnico existente del Backend, por lo que los documentos sintéticos llegan a `NEEDS_AUDIT`; esta prueba cubre almacenamiento, PostgreSQL y revisión humana, no la calidad de clasificación de IA.

Desde la raíz del repositorio y con el Backend saludable:

```powershell
$stateFile = Join-Path $env:TEMP ("mediflow-local-demo-" + [guid]::NewGuid().ToString('N') + '.json')
.\scripts\local-demo-smoke.ps1 -Phase Create -StateFile $stateFile
docker restart mediflow22-local-demo-backend-1
Invoke-RestMethod 'http://127.0.0.1:18080/actuator/health' # repita cuando el Backend esté listo
.\scripts\local-demo-smoke.ps1 -Phase Verify -StateFile $stateFile
```

El script procesa dos textos y el JPG sintético `test-data/cases/CASE-010/input.jpg`; comprueba la cola, APPROVE/REJECT, resultado, original e historial. `Verify` vuelve a consultar esos datos después del reinicio. En el navegador, recargue Resultado e Historial y confirme que la decisión persiste.

## Cobertura de la demostración

| Escenario | Cobertura en este entorno |
|---|---|
| Ambigüedad/fallo y revisión humana | Cubierto estáticamente por el procedimiento: IA no configurada produce el fallback `NEEDS_AUDIT`; el script comprueba cola, aprobación, rechazo, originales e historial. Su ejecución permanece `NOT_VERIFIED` hasta conservar la salida obtenida. |
| Rutina automática | `NOT_VERIFIED` en `local-demo`: requiere una respuesta válida de Gemini y este Compose inicia IA Core sin credenciales ni modelo. |
| Urgencia automática | `NOT_VERIFIED` en `local-demo` por la misma dependencia; el smoke no valida clasificación `URGENT`, destino `MEDICAL_EMERGENCY` ni notificación. |

La guía reproduce el flujo persistente de fallback y revisión, no los tres resultados clínicos automáticos. Los escenarios completos y sus criterios se mantienen en [Producto y QA](./producto-qa/MediFlow_Escenarios_Prueba_Criterios_Aceptacion_MVP_v1.0.md); no configure secretos ni cambie este Compose para convertir esta verificación aislada en una prueba de Gemini u OCI.

## Detención

Detenga primero el servidor de Vite con `Ctrl+C` en su terminal. Después, para detener los contenedores de este proyecto desde la sesión que conserva la contraseña:

```powershell
docker compose -p mediflow22-local-demo -f compose.local-demo.yaml down
```

`down` conserva los dos volúmenes. No use `down --volumes` si quiere conservar los documentos de prueba. Si cierra la sesión, recupere la **misma** contraseña local antes de recrear PostgreSQL con el volumen existente.
