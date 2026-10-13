import type { ExtractedData } from "../../types/processing";

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

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildExtractedDataRows(data: ExtractedData): DataRow[] {
  const rows: DataRow[] = [];

  if (data.patient?.name) {
    rows.push({
      label: "Paciente",
      value: data.patient.name,
    });
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
      label: "Cédula profesional",
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
    if (value == null) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      rows.push({
        label: humanizeKey(key),
        value: String(value),
      });
    }
  }

  return rows;
}
