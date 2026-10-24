import type { DocumentStatus } from "../types/processing";

export function destinationPresentation(status: DocumentStatus): { label: string; note: string | null } {
  switch (status) {
    case "NEEDS_AUDIT": return { label: "Destino propuesto", note: "Pendiente de confirmación en revisión clínica" };
    case "PROCESSED":
    case "APPROVED": return { label: "Destino confirmado", note: null };
    case "REJECTED":
    case "FAILED": return { label: "Destino registrado", note: "No se aplicó un destino final" };
    default: return { label: "Destino pendiente", note: "Procesamiento pendiente" };
  }
}
