import type { AuditReason } from "../types/processing";
import { getDocumentTypeName } from "./documentTypeLabels";

const AUDIT_REASON_LABELS: Record<AuditReason, string> = {
  LOW_CONFIDENCE: "Baja confianza del análisis",
  ILLEGIBLE_DOCUMENT: "Documento ilegible",
  MISSING_CRITICAL_FIELDS: "Información crítica incompleta",
  INCONSISTENT_DATA: "Datos inconsistentes",
  INVALID_AI_RESPONSE:
    "No se obtuvo una respuesta válida del servicio de análisis",
  AI_TIMEOUT: "Tiempo de espera agotado",
  AI_UNAVAILABLE: "Servicio de análisis no disponible",
};

export function auditReasonLabel(reason: string): string {
  return AUDIT_REASON_LABELS[reason as AuditReason] ?? reason;
}

export function documentTypeLabel(
  documentType: string | null,
): string {
  if (documentType === null) {
    return "Sin clasificar";
  }

  return getDocumentTypeName(documentType);
}
