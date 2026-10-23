import { auditReasonLabel } from "../config/auditLabels";

export function getDocumentTypeLabel(value: unknown): string {
  const labels: Record<string, string> = {
    PRESCRIPTION: "Receta médica",
    IMAGING_REPORT: "Informe de imágenes",
    STUDY_REPORT: "Informe de estudio",
    PROCEDURE_ORDER: "Orden de procedimiento",
    DISCHARGE_SUMMARY: "Epicrisis",
    MEDICAL_CERTIFICATE: "Certificado médico",
  };

  return typeof value === "string" ? (labels[value] ?? value) : "No disponible";
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
    MISSING_CRITICAL_FIELDS: "Faltan campos críticos",
    INCONSISTENT_DATA: "Datos inconsistentes",
    INVALID_AI_RESPONSE: "Respuesta inválida de la IA",
    AI_TIMEOUT: "Tiempo de espera agotado de la IA",
    AI_UNAVAILABLE: "IA no disponible",
  };

  return labels[value] ?? value;
}

export function getMissingFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    "patient.name": "Nombre del paciente",
    "patient.age": "Edad del paciente",
    "requesting_doctor.name": "Médico solicitante",
    "requesting_doctor.license_number": "N.º de colegiado / matrícula profesional",
    primary_diagnosis: "Diagnóstico principal",
    suggested_icd10: "Código CIE-10 sugerido",
    medications: "Medicamentos",
    requested_studies: "Estudios solicitados",
  };

  const normalizedField = field.replace(/\[\d+\]/g, "");

  const medicationMatch = normalizedField.match(
    /^medications(?:\.\d+)?\.(name|dosage)$/,
  );

  if (medicationMatch) {
    return medicationMatch[1] === "name"
      ? "Nombre del medicamento"
      : "Dosis del medicamento";
  }

  const studyMatch = normalizedField.match(
    /^requested_studies(?:\.\d+)?\.name$/,
  );

  if (studyMatch) {
    return "Nombre del estudio solicitado";
  }

  return labels[field] ?? field;
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
