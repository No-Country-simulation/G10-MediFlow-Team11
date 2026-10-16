import type { DocumentStatus, Validation } from "../../types/processing";
import type { DataRow } from "./extractedDataRows";

export type StatusTone = "success" | "attention" | "danger" | "neutral";

export type DataRowLayout = "inline" | "block";

export interface ValidationSection {
  key: "missing_fields" | "inconsistencies" | "warnings";
  title: string;
  tone: "attention" | "danger";
  items: string[];
}

const BLOCK_VALUE_MIN_LENGTH = 56;

const MISSING_FIELD_LABELS: Record<string, string> = {
  "patient.name": "Nombre del paciente",
  "patient.age": "Edad del paciente",
  "requesting_doctor.name": "Nombre del médico responsable",
  "requesting_doctor.license_number":
    "Cédula profesional del médico responsable",
  primary_diagnosis: "Diagnóstico principal",
  suggested_icd10: "Código CIE-10 sugerido",
};

export function getStatusTone(status: DocumentStatus): StatusTone {
  switch (status) {
    case "PROCESSED":
    case "APPROVED":
      return "success";
    case "NEEDS_AUDIT":
      return "attention";
    case "REJECTED":
    case "FAILED":
      return "danger";
    default:
      return "neutral";
  }
}

export function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function clampPercent(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

export function formatMissingField(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? field;
}

export function getDataRowLayout(row: DataRow): DataRowLayout {
  if (Array.isArray(row.value)) return "block";
  return row.value.length >= BLOCK_VALUE_MIN_LENGTH ? "block" : "inline";
}

export function hasValidationFindings(validation: Validation): boolean {
  return (
    validation.missing_fields.length > 0 ||
    validation.inconsistencies.length > 0 ||
    validation.warnings.length > 0
  );
}

export function getValidationSections(
  validation: Validation,
): ValidationSection[] {
  const sections: ValidationSection[] = [
    {
      key: "missing_fields",
      title: "Campos faltantes",
      tone: "attention",
      items: validation.missing_fields.map(formatMissingField),
    },
    {
      key: "inconsistencies",
      title: "Inconsistencias",
      tone: "danger",
      items: validation.inconsistencies,
    },
    {
      key: "warnings",
      title: "Advertencias",
      tone: "attention",
      items: validation.warnings,
    },
  ];

  return sections.filter((section) => section.items.length > 0);
}

export function getDocumentSourceLabels(isTextSource: boolean): {
  title: string;
  subtitle: string | null;
} {
  return isTextSource
    ? { title: "Texto original", subtitle: "Entrada de texto" }
    : { title: "Documento", subtitle: null };
}
