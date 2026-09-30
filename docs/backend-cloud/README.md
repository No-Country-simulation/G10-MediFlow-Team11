# Backend & Cloud

Documentación de Backend, persistencia, infraestructura y Oracle Cloud Infrastructure (OCI).

Este documento resume la infraestructura OCI base del MVP de MediFlow y enlaza las guías técnicas del área. No incluye OCIDs, credenciales, claves ni direcciones IP públicas.

## Infraestructura OCI base

### Región

- Colombia Central (Bogotá)
- `sa-bogota-1`

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
| `22/TCP` | IP administrativa `/32` | SSH |
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

### Capacidad Compute verificada

- Shape: `VM.Standard.A1.Flex`
- Arquitectura: Ampere/ARM
- 2 OCPU
- 12 GB RAM
- `Always Free-eligible`

No se identificaron limitaciones que impidan continuar con el aprovisionamiento de `MediFlow_Core_VM`. La disponibilidad real de Compute puede variar al momento de crear la instancia.

## Guías relacionadas

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md): arquitectura base y contratos de integración.
- [`./postgresql-docker.md`](./postgresql-docker.md): PostgreSQL con Docker Compose para desarrollo local.

## Seguridad

- No versionar credenciales OCI.
- No almacenar claves privadas en el repositorio.
- Usar Instance Principals para Object Storage.
- Mantener PostgreSQL e IA Core sin exposición directa a Internet.
- Mantener SSH restringido a una fuente administrativa específica.
