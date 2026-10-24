import type { ExtractedData, Validation } from "../../types/processing";

export interface DataRow {
  label: string;
  value: string | string[];
}

const KNOWN_KEYS = new Set([
  "patient",
  "requesting_doctor",
  "primary_diagnosis",
  "suggested_icd10",
  "medications",
  "requested_studies",
]);

const ADDITIONAL_LABELS: Record<string, string> = {
  measurements: "Mediciones",
  systolic: "Presión sistólica",
  diastolic: "Presión diastólica",
  unit: "Unidad",
};

function humanizeKey(key: string): string {
  return ADDITIONAL_LABELS[key] ?? key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function formatScalar(value: unknown): string | null {
  if (value == null) return null;

  if (isPrimitive(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.every(isPrimitive)) {
      return value.map((item) => String(item)).join(", ");
    }

    const items = value
      .map((item) => formatScalar(item))
      .filter((item): item is string => item != null);

    return items.length > 0 ? items.join("; ") : null;
  }

  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const formatted = formatScalar(nested);
        return formatted == null ? null : `${humanizeKey(key)}: ${formatted}`;
      })
      .filter((part): part is string => part != null);

    return parts.length > 0 ? parts.join(" · ") : null;
  }

  return null;
}

function formatAdditionalValue(value: unknown): string | string[] | null {
  if (value == null) return null;

  if (isPrimitive(value)) {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.every(isPrimitive)) {
      return value.map((item) => String(item));
    }

    const items = value
      .map((item) => formatScalar(item))
      .filter((item): item is string => item != null);

    return items.length > 0 ? items : null;
  }

  if (typeof value === "object") {
    const items = Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const formatted = formatScalar(nested);
        return formatted == null ? null : `${humanizeKey(key)}: ${formatted}`;
      })
      .filter((item): item is string => item != null);

    return items.length > 0 ? items : null;
  }

  return null;
}

export function buildExtractedDataRows(data: ExtractedData, missingFields: Validation["missing_fields"] = []): DataRow[] {
  const rows: DataRow[] = [];

  if (data.patient?.name) {
    rows.push({
      label: "Paciente",
      value: data.patient.name,
    });
  }
  else if (missingFields.includes("patient.name") || missingFields.includes("patient")) {
    rows.push({ label: "Paciente", value: "No identificado" });
  }

  if (data.patient?.age != null) {
    rows.push({
      label: "Edad",
      value: `${data.patient.age} años`,
    });
  }

  if (data.requesting_doctor?.name) {
    rows.push({
      label: "Médico responsable",
      value: data.requesting_doctor.name,
    });
  }

  if (data.requesting_doctor?.license_number) {
    rows.push({
      label: "N.º de colegiado / matrícula profesional",
      value: data.requesting_doctor.license_number,
    });
  }

  if (data.primary_diagnosis) {
    rows.push({
      label: "Diagnóstico principal",
      value: data.primary_diagnosis,
    });
  }

  if (data.suggested_icd10) {
    rows.push({
      label: "Código CIE-10 sugerido",
      value: data.suggested_icd10,
    });
  }

  if (data.medications?.length) {
    const medications = data.medications
      .map((medication) =>
        [medication.name, medication.dosage].filter(Boolean).join(" "),
      )
      .filter((medication) => medication.length > 0);

    if (medications.length > 0) {
      rows.push({
        label: "Medicamentos",
        value: medications,
      });
    }
  }

  if (data.requested_studies?.length) {
    const studies = data.requested_studies
      .map((study) => study.name)
      .filter((name): name is string => Boolean(name));

    if (studies.length > 0) {
      rows.push({
        label: "Estudios solicitados",
        value: studies,
      });
    }
  }

  for (const [key, value] of Object.entries(data)) {
    if (KNOWN_KEYS.has(key)) continue;

    const formatted = formatAdditionalValue(value);
    if (formatted == null) continue;

    rows.push({
      label: humanizeKey(key),
      value: formatted,
    });
  }

  return rows;
}
