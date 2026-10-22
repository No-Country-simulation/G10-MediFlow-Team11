# MediFlow local-demo (PostgreSQL y archivos aislados)

`local-demo` es un perfil Spring explícito para pruebas locales. Sustituye el cliente de OCI Object Storage por archivos persistentes en un volumen Docker; no inicializa autenticación ni cliente OCI. El Backend mantiene los mismos endpoints y contratos. Fuera de este perfil, sigue usando OCI.

El Compose dedicado usa el proyecto `mediflow22-local-demo`, los volúmenes `local_demo_postgres` y `local_demo_objects`, y publica solo el Backend en `127.0.0.1:18080`. PostgreSQL e IA Core permanecen en la red privada del proyecto. El Backend sigue ejecutándose como `appuser`; `storage-init` ajusta permisos únicamente en el volumen aislado de objetos.

## Arranque (PowerShell, desde la raíz del repositorio)

Requiere Docker Desktop y Node.js. Genere una contraseña desechable y consérvela en **la misma sesión de PowerShell** para futuros `docker compose up` sobre este volumen. No use credenciales de otros entornos.

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

Para detener solo este proyecto, desde la misma sesión que conserva la contraseña:

```powershell
docker compose -p mediflow22-local-demo -f compose.local-demo.yaml down
```

`down` conserva los dos volúmenes. No use `down --volumes` si quiere conservar los documentos de prueba. Si cierra la sesión, recupere la **misma** contraseña local antes de recrear PostgreSQL con el volumen existente.
