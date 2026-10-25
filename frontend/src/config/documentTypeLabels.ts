import type { DocumentType } from "../types/processing";

const DOCUMENT_TYPE_LABELS: Readonly<Record<DocumentType, string>> = {
  PRESCRIPTION: "Receta médica",
  IMAGING_REPORT: "Informe de imágenes",
  STUDY_REPORT: "Informe de estudio",
  PROCEDURE_ORDER: "Orden de procedimiento",
  DISCHARGE_SUMMARY: "Resumen de alta",
  MEDICAL_CERTIFICATE: "Certificado médico",
};

export function getDocumentTypeName(value: string): string {
  return DOCUMENT_TYPE_LABELS[value as DocumentType] ?? value;
}
