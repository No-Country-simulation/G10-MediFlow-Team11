# Backend & Cloud

Documentación de Backend, persistencia, infraestructura y Oracle Cloud Infrastructure (OCI).

Este documento resume la infraestructura OCI base del MVP de MediFlow y enlaza las guías técnicas del área. No incluye OCIDs, credenciales, claves ni direcciones IP públicas.

## Infraestructura OCI base

### Región

- US East (Ashburn)
- `us-ashburn-1`

### Compartment

- `MediFlow_Hackathon`

### IAM

- Dynamic Group: `MediFlow_VM_Group` (instancias Compute del compartment `MediFlow_Hackathon`)
- Policy: `MediFlow_ObjectStorage_Policy`
- Acceso a Object Storage mediante Instance Principals, sin credenciales OCI estáticas en las instancias.

### Red

- VCN: `MediFlow_VCN`
- CIDR: `10.0.0.0/16`
- Subred pública: `10.0.0.0/24`
- Subred privada: `10.0.1.0/24`
- Internet Gateway configurado para la subred pública.

| Puerto | Exposición | Uso |
| --- | --- | --- |
| `22/TCP` | Orígenes administrativos autorizados | SSH |
| `80/TCP` | Público | HTTP |
| `443/TCP` | Público | HTTPS |
| `5432/TCP` | No público | PostgreSQL |
| `8000/TCP` | No público | IA Core |
| `8080/TCP` | No público actualmente | Backend |

### Object Storage

- Bucket: `mediflow-documentos-clinicos`
- Visibility: Private
- Default storage tier: Standard
- Object versioning: disabled
- Encryption: Oracle-managed keys

Prefijos:

```text
recibidos/
procesados/urgentes/
procesados/rutina/
auditoria_humana/
```

El contrato completo de almacenamiento, la convención de nombres de objeto y el movimiento entre prefijos se definen en [`docs/ARCHITECTURE.md` — sección 11](../ARCHITECTURE.md#11-oci-object-storage).

### Compute

- Instancia: `MediFlow_Core_VM`
- Availability Domain: `AD-2`
- Imagen: Canonical Ubuntu 22.04 Minimal `aarch64`
- Shape: `VM.Standard.A1.Flex`
- Arquitectura: Ampere ARM (`aarch64`)
- 2 OCPU
- 12 GB RAM
- `Always Free-eligible`
- Acceso SSH restringido a orígenes administrativos autorizados
- Docker Engine y Docker Compose como entorno de ejecución de los servicios

#### Verificaciones realizadas

Estas verificaciones corresponden al aprovisionamiento de #12; no acreditan el estado actual de los servicios contenerizados ni se repiten al preparar #59.

- Arquitectura `aarch64` verificada.
- Ejecución correcta de `hello-world` con Docker.
- Acceso al bucket `mediflow-documentos-clinicos` mediante Instance Principals.
- Prueba de `put`, `list` y `delete` completada correctamente.
- Ausencia de `~/.oci`: sin credenciales OCI estáticas en la VM.

MediFlow utiliza OCI Compute, Docker Compose y Caddy para alojar sus servicios y el Frontend: Docker Compose ejecuta PostgreSQL, Backend e IA Core en la VM, y Caddy publica por HTTPS el Frontend y el health check del Backend. El despliegue y la operación se describen en las guías siguientes.

## Guías relacionadas

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md): arquitectura base y contratos de integración.
- [`./postgresql-docker.md`](./postgresql-docker.md): PostgreSQL con Docker Compose para desarrollo local.
- [Contenerización del Backend](../../backend/README.md#contenerización-del-backend-issue-53): ejecución del Backend con Docker para desarrollo local.
- [Despliegue en OCI Compute (#59)](./oci-compute-deployment.md): ARM64, variables protegidas, Instance Principals, HTTPS, operación y checklist de aceptación en la VM.
- [Despliegue del Frontend en OCI](./oci-frontend-deployment.md): build de React/Vite, publicación y activación de releases estáticos con Caddy, verificación y rollback.

## Seguridad

- No versionar credenciales OCI.
- No almacenar claves privadas en el repositorio.
- Usar Instance Principals para Object Storage.
- Mantener PostgreSQL e IA Core sin exposición directa a Internet.
- Mantener SSH restringido a orígenes administrativos autorizados.
