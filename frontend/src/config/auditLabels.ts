import type { AuditReason, DocumentType } from "../types/processing";

const AUDIT_REASON_LABELS: Record<AuditReason, string> = {
  LOW_CONFIDENCE: "El sistema tuvo dudas al analizar este documento",
  ILLEGIBLE_DOCUMENT: "Documento ilegible",
  MISSING_CRITICAL_FIELDS: "Información crítica incompleta",
  INCONSISTENT_DATA: "Datos inconsistentes",
  INVALID_AI_RESPONSE:
    "No se obtuvo una respuesta válida del servicio de análisis",
  AI_TIMEOUT: "Tiempo de espera agotado",
  AI_UNAVAILABLE: "Servicio de análisis no disponible",
};

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  PRESCRIPTION: "Receta médica",
  IMAGING_REPORT: "Informe de imagen",
  STUDY_REPORT: "Informe de estudio",
  PROCEDURE_ORDER: "Orden de procedimiento",
  DISCHARGE_SUMMARY: "Resumen de alta",
  MEDICAL_CERTIFICATE: "Certificado médico",
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

  return DOCUMENT_TYPE_LABELS[documentType as DocumentType] ?? documentType;
}
