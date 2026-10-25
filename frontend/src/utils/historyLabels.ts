import { auditReasonLabel } from "../config/auditLabels";
import { missingFieldLabel } from "../config/missingFieldLabels";
import { getDocumentTypeName } from "../config/documentTypeLabels";

export function getDocumentTypeLabel(value: unknown): string {
  return typeof value === "string" ? getDocumentTypeName(value) : "No disponible";
}

export function getPriorityLabel(value: unknown): string {
  const labels: Record<string, string> = {
    ROUTINE: "Rutina",
    URGENT: "Urgente",
  };

  return typeof value === "string" ? (labels[value] ?? value) : "No disponible";
}

export function getRoutingDestinationLabel(value: unknown): string {
  const labels: Record<string, string> = {
    MEDICAL_EMERGENCY: "Emergencia médica",
    PHARMACY: "Farmacia",
    AUTHORIZATION_AUDIT: "Auditoría de autorizaciones",
    MEDICAL_RECORD: "Historia clínica",
    HUMAN_REVIEW: "Revisión humana",
  };

  return typeof value === "string" ? (labels[value] ?? value) : "No disponible";
}

export function getAuditReasonLabel(value: string): string {
  if (value === "LOW_CONFIDENCE") return auditReasonLabel(value);

  const labels: Record<string, string> = {
    ILLEGIBLE_DOCUMENT: "Documento ilegible",
    MISSING_CRITICAL_FIELDS: "Información crítica incompleta",
    INCONSISTENT_DATA: "Datos inconsistentes",
    INVALID_AI_RESPONSE: "Respuesta inválida de la IA",
    AI_TIMEOUT: "Tiempo de espera agotado de la IA",
    AI_UNAVAILABLE: "IA no disponible",
  };

  return labels[value] ?? value;
}

export function getMissingFieldLabel(field: string): string {
  return missingFieldLabel(field);
}

export function getStatusLabel(status: unknown): string {
  const labels: Record<string, string> = {
    RECEIVED: "Recibido",
    PROCESSING: "En procesamiento",
    PROCESSED: "Procesado",
    NEEDS_AUDIT: "Requiere revisión",
    APPROVED: "Aprobado",
    REJECTED: "Rechazado",
    FAILED: "Fallido",
  };

  return typeof status === "string"
    ? (labels[status] ?? status)
    : "No disponible";
}
