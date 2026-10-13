# MediFlow - Evidencias del despliegue OCI Compute, Issue #59

## 1. Datos generales y procedencia

| Dato | Valor |
| --- | --- |
| Proyecto / Issue | MediFlow / [#59](https://github.com/No-Country-simulation/G10-MediFlow-Team11/issues/59) |
| Fecha de las verificaciones | 13 de octubre de 2026 |
| Instancia / plataforma | `MediFlow_Core_VM` / OCI Compute, Ubuntu 22.04 ARM64 |
| Revisión desplegada | `2d22d615f9d4004d7ad7bd2da95ad8f19f33aeab` |
| Orquestación / servicios | Docker Compose / Spring Boot Backend, FastAPI IA Core, PostgreSQL 17 |
| Entorno | Demostración del MVP |
| Dominio temporal | `mediflow-core.duckdns.org` |

Las verificaciones fueron realizadas y aportadas por el operador. La edición documental no las vuelve a ejecutar ni atribuye su ejecución a Codex. El SHA identifica la revisión desplegada, no el futuro commit documental. Los procedimientos reproducibles se mantienen en el [runbook operativo](./oci-compute-deployment.md).

Tipos utilizados en cada fila de verificación:

- `SALIDA DEL OPERADOR`: salida textual compartida del comando o herramienta; los bloques se identifican como extractos, no como transcripciones completas.
- `CAPTURA OCI`: configuración respaldada por una captura OCI accesible. No se adjuntó una captura a este registro; la revisión visual de la Security List se clasifica como reporte.
- `REPORTE DEL OPERADOR`: operación o configuración confirmada por el operador sin salida textual completa incorporada; las celdas son resúmenes.
- `SIN EVIDENCIA — PENDIENTE`: comprobación no ejecutada o sin evidencia suficiente para el alcance indicado.

No se incorporan credenciales, namespaces, IPs administrativas, contenido clínico ni información personal. Las salidas siguientes son únicamente los extractos proporcionados.

## 2. Servicios y conectividad interna

| Verificación | Resultado / límite | Tipo de evidencia |
| --- | --- | --- |
| VM y revisión desplegada | Ubuntu 22.04 ARM64 y SHA indicado; sin inventario de IDs/digests de imágenes adjunto. | REPORTE DEL OPERADOR |
| Servicios del Compose existente | Backend, IA Core y PostgreSQL 17 desplegados; se reutilizan las configuraciones de #13, #53 y #72. | REPORTE DEL OPERADOR |
| Salud de los tres contenedores tras reboot | Los tres aparecen `healthy`; extracto en §3. | SALIDA DEL OPERADOR |
| Salud local del Backend | `/actuator/health` devolvió `UP`. | REPORTE DEL OPERADOR |
| Salud local de IA Core | `/health` devolvió `ok`. | REPORTE DEL OPERADOR |
| Backend → PostgreSQL | `GET /api/v1/documents/audit` interno respondió HTTP `200`; PostgreSQL inició con su volumen persistente. | REPORTE DEL OPERADOR |
| Backend → IA Core | `http://ai-core:8000/health` respondió `ok` desde la red Docker del Backend; comprueba conectividad, no procesamiento. | REPORTE DEL OPERADOR |
| Puertos publicados | Backend `127.0.0.1:8080`, IA Core `127.0.0.1:8000`, PostgreSQL `127.0.0.1:5432`. | REPORTE DEL OPERADOR |
| Variables sensibles | Fuera del repositorio en `.env.oci` protegido; no se incorporan valores ni un volcado de variables/imágenes. | REPORTE DEL OPERADOR |

El Issue #59 menciona `AI_SERVICE_URL`; el repositorio conserva `MEDIFLOW_AI_SERVICE_URL=http://ai-core:8000`. No se renombra la propiedad para igualar el texto de la issue. No se ejecutó el procesamiento clínico completo desde el Backend desplegado utilizando `AiCoreClient`; queda pendiente en §7 junto con #56.

## 3. Recuperación después de reboot

| Verificación | Resultado / límite | Tipo de evidencia |
| --- | --- | --- |
| Reinicio completo de Ubuntu | Realizado; no se aportan tiempos exactos ni prueba de disponibilidad continua. | REPORTE DEL OPERADOR |
| Estado de SSH antes del reboot | `systemctl is-enabled ssh` devolvió `enabled`. Esta comprobación previa es distinta de la recuperación posterior. | REPORTE DEL OPERADOR |
| Recuperación de SSH después del reboot | Reconexión SSH exitosa después del reinicio. No se verificó esta recuperación mediante `systemctl is-active ssh`. | REPORTE DEL OPERADOR |
| Docker, Caddy y firewall persistente | `systemctl is-active docker caddy netfilter-persistent` devolvió tres líneas `active`. | SALIDA DEL OPERADOR |
| Recuperación de contenedores | Backend, IA Core y PostgreSQL volvieron a `healthy`. | SALIDA DEL OPERADOR |
| Persistencia de reglas INPUT | Permisos TCP 80 y 443 antes del rechazo final, después del reboot. Extracto sanitizado abajo. | SALIDA DEL OPERADOR |

Extracto de estado de contenedores aportado por el operador:

```text
g10-mediflow-team11-ai-core-1    Up About a minute (healthy)
g10-mediflow-team11-backend-1    Up About a minute (healthy)
g10-mediflow-team11-postgres-1   Up About a minute (healthy)
```

Comando real y salida proporcionados para los servicios del host:

```bash
systemctl is-active docker caddy netfilter-persistent
```

```text
active
active
active
```

Extracto **sanitizado**, no transcripción íntegra, de INPUT después del reboot:

```text
5 ACCEPT tcp ... tcp dpt:80
6 ACCEPT tcp ... tcp dpt:443
7 REJECT all ... reject-with icmp-host-prohibited
```

La expresión `Up About a minute` corresponde al estado mostrado por Docker; no mide el tiempo total de recuperación ni demuestra ausencia absoluta de fallos durante el arranque. Los diagnósticos futuros del runbook pueden incluir `ssh` en `systemctl`, sin alterar la procedencia de esta evidencia.

### Estabilidad de contenedores

| Verificación | Resultado / límite | Tipo de evidencia |
| --- | --- | --- |
| Tres mediciones UTC del 13 de octubre de 2026 | 17:32:50, 17:38:17 y 18:57:03. En las tres, Backend, IA Core y PostgreSQL permanecieron `healthy`, con `RestartCount=0` y sin cambios en `StartedAt`. | REPORTE DEL OPERADOR |
| Intervalo observado | 1 hora, 24 minutos y 13 segundos entre la primera y la tercera medición. | REPORTE DEL OPERADOR |

Son tres mediciones puntuales sobre la revisión desplegada `2d22d61`; no constituyen monitoreo continuo ni demuestran ausencia de eventos entre ellas. No se incorpora salida textual.

## 4. HTTPS, Caddy, DNS y seguridad de red

| Verificación | Resultado / límite | Tipo de evidencia |
| --- | --- | --- |
| Caddy v2 en Ubuntu | `/etc/caddy/Caddyfile` con la configuración reproducida en el runbook: proxy solo para `/actuator/health`, resto `404`. | REPORTE DEL OPERADOR |
| Health HTTPS posterior al reboot | Desde Windows PowerShell: HTTP `200`, `Via: 1.1 Caddy`, `status: UP`; validación TLS normal, sin `-k`. | SALIDA DEL OPERADOR |
| Ruta funcional pública | `/api/v1/documents/audit` por HTTPS devolvió `404`. | SALIDA DEL OPERADOR |
| Redirección HTTP → HTTPS | Devolvió `HTTP/1.1 308 Permanent Redirect` con `Location` hacia `https://mediflow-core.duckdns.org/actuator/health`; extracto textual abajo. | SALIDA DEL OPERADOR |
| Certificado público / dominio | Certificado TLS válido durante la consulta a `mediflow-core.duckdns.org`, dominio temporal de demostración; no prueba renovación futura. | SALIDA DEL OPERADOR |
| Security List OCI | Revisión visual reportada: TCP 80/443 permitidos, TCP 22 limitado a origen administrativo, sin exposición pública de 5432/8000/8080. No hay captura adjunta disponible. | REPORTE DEL OPERADOR |
| Acceso externo directo a servicios | Pruebas desde Windows, incluido `Test-NetConnection`, confirmaron que 5432, 8000 y 8080 no eran accesibles directamente. No se incorpora una salida textual literal. | REPORTE DEL OPERADOR |
| Token DuckDNS | El token expuesto anteriormente fue regenerado; no se registra el valor antiguo ni el nuevo. | REPORTE DEL OPERADOR |

Comando ejecutado desde Windows PowerShell y extracto textual relevante aportado:

```powershell
curl.exe -i --max-time 20 https://mediflow-core.duckdns.org/actuator/health
```

```text
HTTP/1.1 200 OK
Content-Type: application/vnd.spring-boot.actuator.v3+json
Via: 1.1 Caddy

{"groups":["liveness","readiness"],"status":"UP"}
```

Comando y resultado de la restricción de la ruta funcional:

```powershell
curl.exe -sS -o NUL -w "API: HTTP %{http_code}\n" https://mediflow-core.duckdns.org/api/v1/documents/audit
```

```text
API: HTTP 404
```

Comando ejecutado desde Windows PowerShell y extracto textual de la redirección HTTP → HTTPS aportado por el operador (extracto de las líneas relevantes, no transcripción completa de la respuesta):

```powershell
curl.exe -i --max-time 20 http://mediflow-core.duckdns.org/actuator/health
```

```text
HTTP/1.1 308 Permanent Redirect
Location: https://mediflow-core.duckdns.org/actuator/health
```

**La API funcional no está públicamente disponible.** El acceso interno de auditoría con HTTP `200` y la restricción pública con `404` corresponden a vías diferentes. El health público no autoriza ampliar rutas. Las decisiones de exposición segura de API/Frontend y la operación futura de DNS/TLS quedan en §7.

## 5. OCI Object Storage: CLI, prueba Java aislada y lectura por el Backend

Bucket privado `mediflow-documentos-clinicos`, región `us-ashburn-1`. No se publica su namespace.

| Verificación | Resultado / límite | Tipo de evidencia |
| --- | --- | --- |
| OCI CLI con Instance Principals | Contenedor temporal en la red Docker del Backend: autenticación correcta, listado de objetos y `NoPublicAccess`, sin claves privadas estáticas. | REPORTE DEL OPERADOR |
| Entorno aislado Java | Imagen `mediflow-backend-oci-it:temp`, PostgreSQL temporal `mediflow-oci-it-postgres`, red `g10-mediflow-team11_default`; Instance Principals y base independiente de producción. | REPORTE DEL OPERADOR |
| `ObjectStorageServiceIT` | Subida, lectura, comparación y eliminación de JSON sintético mediante el servicio de MediFlow y SDK Java; 1 prueba, 0 fallos, 0 errores, 0 omisiones, `BUILD SUCCESS`. | SALIDA DEL OPERADOR |
| Limpieza temporal | Eliminados el contenedor PostgreSQL y la imagen Java temporales; retirada la variable de contraseña temporal de la sesión. | REPORTE DEL OPERADOR |

Extracto textual proporcionado por el operador:

```text
Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

La secuencia de operaciones corresponde a [`ObjectStorageServiceIT.java`](../../backend/src/test/java/com/mediflow/backend/service/ObjectStorageServiceIT.java). La autenticación utiliza [`ObjectStorageConfig.java`](../../backend/src/main/java/com/mediflow/backend/config/ObjectStorageConfig.java). La salida acredita la ejecución de la prueba; el aislamiento y la configuración de su entorno se registran según el reporte del operador.

Esta prueba demuestra operaciones reales de Object Storage mediante el SDK Java de MediFlow en el entorno aislado. **No demuestra una petición a un endpoint del Backend de producción ni un flujo clínico completo.** La lectura desde el Backend desplegado se registra a continuación.

### Lectura por el Backend desplegado

Verificación del 13 de octubre de 2026 sobre el Backend ya desplegado en la VM, revisión `2d22d61`; no sobre commits posteriores de la rama Git.

| Verificación | Resultado / límite | Tipo de evidencia |
| --- | --- | --- |
| Objeto sintético | Creado con OCI CLI e Instance Principals, sin sobrescritura; 86 bytes. Identificador `issue59-oci-read-20261013`; clave `recibidos/issue59-oci-read-20261013/original.json`. OCI confirmó `content-length: 86` y `content-type: application/json`. La escritura no fue iniciada por el Backend. | REPORTE DEL OPERADOR |
| Fila en PostgreSQL | Una única fila válida insertada para ese identificador. Respaldo previo con `BACKUP_CATALOG=OK`. | REPORTE DEL OPERADOR |
| `GET /api/v1/documents/issue59-oci-read-20261013/content` | Mediante `localhost:8080`: HTTP `200`, `Content-Type: application/json`. SHA-256 original y recuperado coincidentes: `af46c1535cc7cab367fa4b5ec1d72b1a5757c9b0f76dc867e1b0da803840669a`. Resultado `PASS_BACKEND_POSTGRESQL_OCI`; extracto textual abajo. | SALIDA DEL OPERADOR |
| Limpieza | `DELETE 1` y cero referencias restantes en PostgreSQL; eliminada la versión específica del objeto en OCI, listado de versiones sin entradas y consulta HEAD posterior HTTP `404`. Limpieza local: `LOCAL_FIXTURE_CLEANED=OK`. | REPORTE DEL OPERADOR |

Extracto textual de la lectura aportado por el operador (no transcripción completa):

```text
CURL_EXIT_CODE=0
HTTP_STATUS=200
HTTP/1.1 200
Content-Type: application/json
RESULTADO=PASS_BACKEND_POSTGRESQL_OCI
```

Esta verificación acredita que el Backend desplegado leyó mediante Instance Principals un objeto del bucket cuya fila existía en PostgreSQL. **No acredita escritura iniciada por el Backend, la ejecución de `AiCoreClient.process()` desde el Backend desplegado ni la validación end-to-end de #56.** El acceso fue interno; no cambia la restricción pública de §4.

## 6. Persistencia PostgreSQL y respaldo

| Verificación | Resultado / límite | Tipo de evidencia |
| --- | --- | --- |
| Detención e inicio | Servicios detenidos e iniciados mediante Docker Compose. | REPORTE DEL OPERADOR |
| Persistencia tras stop/start | Registro sintético creado y conservado tras el ciclo. | REPORTE DEL OPERADOR |
| Persistencia tras recreación | Contenedor PostgreSQL recreado conservando el mismo volumen; registro sintético conservado. | REPORTE DEL OPERADOR |
| Respaldo | `pg_dump` generado en formato custom. | REPORTE DEL OPERADOR |
| Catálogo del respaldo | Inspeccionado mediante `pg_restore --list`; no se ensayó restauración. | REPORTE DEL OPERADOR |
| Limpieza sintética | Eliminado el esquema `mediflow_issue59_check`; una consulta posterior confirmó su ausencia. | REPORTE DEL OPERADOR |

No se incorporan sentencias SQL ni resultados exactos no aportados. El runbook conserva la creación segura de respaldos fuera del checkout, permisos restringidos y operaciones que preservan el volumen. La persistencia y la inspección del catálogo no demuestran recuperación desde un respaldo.

## 7. Pendientes, límites y relación con la aceptación

| Verificación / límite | Alcance / relación con #59 | Tipo de evidencia |
| --- | --- | --- |
| Flujo real de `AiCoreClient` desde Backend desplegado | Integración funcional posterior; el health de IA no ejecuta el cliente. | SIN EVIDENCIA — PENDIENTE |
| Validación clínica end-to-end | Corresponde a [#56](https://github.com/No-Country-simulation/G10-MediFlow-Team11/issues/56), fase posterior explícita de #59. | SIN EVIDENCIA — PENDIENTE |
| Lectura OCI por endpoint funcional del Backend desplegado | Registrada en §5: objeto escrito con OCI CLI y leído por el Backend en la revisión `2d22d61`. No acredita escritura iniciada por el Backend, `AiCoreClient` ni #56. Revisar su suficiencia al aceptar el criterio de acceso del Backend al bucket de #59. | REPORTE DEL OPERADOR |
| Ventana registrada sin reinicios inesperados | Registrada en §3: tres mediciones en 1 hora, 24 minutos y 13 segundos, con `RestartCount=0` y `StartedAt` sin cambios. Son mediciones puntuales, no monitoreo continuo; revisar su suficiencia frente al criterio de #59. | REPORTE DEL OPERADOR |
| Exposición segura de API y Frontend | Decisión de acceso y rutas antes de ampliar Caddy; health HTTPS no acredita acceso funcional público. Trabajo posterior, no apertura automática. | SIN EVIDENCIA — PENDIENTE |
| Timeouts, límites de carga y proxy en procesamiento funcional | Validación al habilitar ese consumo; no cubierta por health. | SIN EVIDENCIA — PENDIENTE |
| Renovación futura del certificado TLS | Evolución operativa; validez actual no demuestra renovación. | SIN EVIDENCIA — PENDIENTE |
| Estrategia de actualización DuckDNS | Documentar y comprobar operación sin publicar credenciales. | SIN EVIDENCIA — PENDIENTE |
| Restauración PostgreSQL aislada | Ensayar recuperación real del respaldo fuera de producción. | SIN EVIDENCIA — PENDIENTE |
| Diagnósticos complementarios del runbook | Sin salida aportada del preflight, índices/digests ARM64, IMDS HTTP, comparación de conexiones SQL o solicitud IA incompleta `400`; no se registran como ejecutados por estar documentados. | SIN EVIDENCIA — PENDIENTE |

Los resultados documentan un despliegue operativo y comprobaciones de red, almacenamiento y persistencia. No todos los pendientes son bloqueos automáticos de #59: #56 es posterior y la issue no exige publicar toda la API, probar renovación futura de TLS o restaurar un respaldo. Sus criterios sí requieren acceso del Backend al bucket, ausencia de reinicios inesperados, secretos protegidos y reproducción del despliegue; revisar la suficiencia de las fuentes y los límites indicados antes de dar aceptación final. Este registro no cierra la issue ni declara validación clínica end-to-end.

## 8. Historial de verificaciones

| Fecha | Revisión desplegada | Alcance verificado | Resultado | Fuente | Tipo de evidencia |
| --- | --- | --- | --- | --- | --- |
| 2026-10-13 | `2d22d61` | Despliegue OCI, HTTPS, recuperación, PostgreSQL y Object Storage | Verificaciones completadas con límites y pendientes documentados | Resumen del operador; extractos clasificados individualmente en este registro | REPORTE DEL OPERADOR |
| 2026-10-13 | `2d22d61` | Lectura por el Backend desplegado (Backend → PostgreSQL → OCI Object Storage) y estabilidad de contenedores | `PASS_BACKEND_POSTGRESQL_OCI`; tres mediciones con `RestartCount=0` | Resumen del operador; extracto textual de la lectura en §5 | REPORTE DEL OPERADOR |

Referencias: [runbook operativo](./oci-compute-deployment.md), [arquitectura](../ARCHITECTURE.md), [Compose](../../compose.yaml), [PostgreSQL](./postgresql-docker.md).
