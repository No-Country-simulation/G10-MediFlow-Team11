import type { ExtractedData, Validation } from "../../types/processing";
import {
  cellOf,
  type FieldEntry,
  type FieldNode,
  type ListNode,
} from "../../utils/extractedFieldStructure";

export interface DataRow {
  label: string;
  value: string | string[];
}

export interface FieldTableColumn {
  key: string;
  heading: string;
}

export interface FieldTableRow {
  key: string;
  cells: FieldNode[];
}

export interface FieldTable {
  columns: FieldTableColumn[];
  rows: FieldTableRow[];
}

const LAB_RESULTS_KEY = "lab_results";

const LAB_RESULT_COLUMNS: ReadonlyArray<readonly [key: string, heading: string]> = [
  ["name", "Prueba"],
  ["value", "Resultado"],
  ["unit", "Unidad"],
  ["reference_range", "Rango de referencia"],
];

export function isLabResultsTable(entry: FieldEntry): entry is FieldEntry & { node: ListNode } {
  return (
    entry.canonicalKey === LAB_RESULTS_KEY &&
    entry.node.kind === "list" &&
    entry.node.listKind === "object"
  );
}

function buildColumns(list: ListNode, clinical: boolean): FieldTableColumn[] {
  if (!clinical) {
    return list.columns.map((column) => ({
      key: column.key,
      heading: column.displayLabel,
    }));
  }

  const used = new Set<string>();
  const columns: FieldTableColumn[] = LAB_RESULT_COLUMNS.map(([canonicalKey, heading]) => {
    const column = list.columns.find((candidate) => candidate.canonicalKey === canonicalKey);
    if (!column) return { key: canonicalKey, heading };

    used.add(column.key);
    return {
      key: column.key,
      heading: column.collides ? `${heading} (${column.key})` : heading,
    };
  });

  for (const column of list.columns) {
    if (!used.has(column.key)) {
      columns.push({ key: column.key, heading: column.displayLabel });
    }
  }

  return columns;
}

export function buildFieldTable(list: ListNode, clinical = false): FieldTable {
  const columns = buildColumns(list, clinical);
  const rows = list.items.map((row) => ({
    key: row.path.join("."),
    cells: columns.map((column) => cellOf(row, column.key)),
  }));

  return { columns, rows };
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

  return rows;
}
