import { describe, expect, it } from "vitest";
import {
  buildExtractedDataRows,
  buildFieldTable,
  isLabResultsTable,
  type FieldTable,
} from "./extractedDataRows";
import type { ExtractedData } from "../../types/processing";
import {
  buildAdditionalFields,
  buildFieldNode,
  type FieldNode,
  type ListNode,
} from "../../utils/extractedFieldStructure";

describe("buildExtractedDataRows", () => {
  it("incluye paciente con nombre y edad", () => {
    const data: ExtractedData = {
      patient: { name: "Juan Pérez", age: 45 },
    };

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({ label: "Paciente", value: "Juan Pérez" });
    expect(rows).toContainEqual({ label: "Edad", value: "45 años" });
  });

  it("incluye médico responsable y número de colegiado", () => {
    const data: ExtractedData = {
      requesting_doctor: { name: "Dra. Gómez", license_number: "MP-123" },
    };

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Médico responsable",
      value: "Dra. Gómez",
    });
    expect(rows).toContainEqual({
      label: "N.º de colegiado / matrícula profesional",
      value: "MP-123",
    });
  });

  it("incluye diagnóstico y código CIE-10", () => {
    const data: ExtractedData = {
      primary_diagnosis: "Neumonía",
      suggested_icd10: "J18.9",
    };

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Diagnóstico principal",
      value: "Neumonía",
    });
    expect(rows).toContainEqual({
      label: "Código CIE-10 sugerido",
      value: "J18.9",
    });
  });

  it("incluye medicamentos con nombre y dosis", () => {
    const data: ExtractedData = {
      medications: [
        { name: "Amoxicilina", dosage: "875 mg" },
        { name: "Paracetamol", dosage: "500 mg" },
      ],
    };

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Medicamentos",
      value: ["Amoxicilina 875 mg", "Paracetamol 500 mg"],
    });
  });

  it("incluye medicamentos con nombre pero sin dosis", () => {
    const data: ExtractedData = {
      medications: [{ name: "Ibuprofeno", dosage: null }],
    };

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Medicamentos",
      value: ["Ibuprofeno"],
    });
  });

  it("incluye medicamentos con dosis pero sin nombre (no se descartan)", () => {
    const data: ExtractedData = {
      medications: [{ name: null, dosage: "875 mg" }],
    };

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Medicamentos",
      value: ["875 mg"],
    });
  });

  it("no incluye la fila de medicamentos si todos los elementos son vacíos", () => {
    const data: ExtractedData = {
      medications: [
        { name: null, dosage: null },
        { name: undefined, dosage: undefined },
      ],
    };

    const rows = buildExtractedDataRows(data);

    expect(rows.find((row) => row.label === "Medicamentos")).toBeUndefined();
  });

  it("incluye estudios solicitados válidos", () => {
    const data: ExtractedData = {
      requested_studies: [
        { name: "Radiografía de tórax" },
        { name: "Hemograma completo" },
      ],
    };

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Estudios solicitados",
      value: ["Radiografía de tórax", "Hemograma completo"],
    });
  });

  it("no incluye estudios sin nombre", () => {
    const data: ExtractedData = {
      requested_studies: [{ name: null }, { name: undefined }],
    };

    const rows = buildExtractedDataRows(data);

    expect(
      rows.find((row) => row.label === "Estudios solicitados"),
    ).toBeUndefined();
  });

  it("no incluye campos nulos o vacíos", () => {
    const data: ExtractedData = {
      patient: { name: null, age: null },
      requesting_doctor: { name: null, license_number: null },
      primary_diagnosis: null,
      suggested_icd10: null,
      medications: [],
      requested_studies: [],
    };

    const rows = buildExtractedDataRows(data);

    expect(rows).toEqual([]);
  });

  it("devuelve array vacío cuando no hay datos", () => {
    const rows = buildExtractedDataRows({});

    expect(rows).toEqual([]);
  });

  it("no duplica filas para campos conocidos al iterar campos adicionales", () => {
    const data: ExtractedData = {
      patient: { name: "Juan" },
      primary_diagnosis: "Gripe",
    };

    const rows = buildExtractedDataRows(data);
    const patientRows = rows.filter((row) => row.label === "Paciente");
    const diagnosisRows = rows.filter(
      (row) => row.label === "Diagnóstico principal",
    );

    expect(patientRows).toHaveLength(1);
    expect(diagnosisRows).toHaveLength(1);
  });

  it("no incluye campos adicionales entre las filas centrales", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      custom_field: "valor personalizado",
      lab_results: [{ name: "Glucosa", value: "174" }],
    } as ExtractedData;

    expect(buildExtractedDataRows(data)).toEqual([
      { label: "Paciente", value: "Ana López" },
    ]);
  });
});

function additionalEntry(data: ExtractedData, key: string) {
  const entry = buildAdditionalFields(data).entries.find((item) => item.key === key);
  if (!entry) throw new Error(`Falta el campo adicional ${key}`);
  return entry;
}

function tableFor(data: ExtractedData, key: string, clinical: boolean): FieldTable {
  return buildFieldTable(additionalEntry(data, key).node as ListNode, clinical);
}

function cellText(cell: FieldNode): string {
  if (cell.kind === "scalar") return cell.text;
  if (cell.kind === "null") return "—";
  return `[${cell.kind}]`;
}

function tableText(table: FieldTable): string[][] {
  return table.rows.map((row) => row.cells.map(cellText));
}

const receivedLabResults = [
  { name: "Glucosa en sangre", unit: "mg/dL", value: "174", reference_range: "70–99 mg/dL" },
  { name: "Hemoglobina glucosilada (HbA1c)", unit: "%", value: "8.2", reference_range: "inferior a 5.7 %" },
  { name: "Creatinina sérica", unit: "mg/dL", value: "0.86", reference_range: "0.6–1.1 mg/dL" },
];

describe("campos adicionales estructurados", () => {
  it("incluye campos adicionales permitidos por el contrato", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      custom_field: "valor personalizado",
      another_number: 42,
      a_boolean: true,
    } as ExtractedData;

    const { entries } = buildAdditionalFields(data);

    expect(entries.map((entry) => [entry.displayLabel, cellText(entry.node)])).toEqual([
      ["Custom field", "valor personalizado"],
      ["Another number", "42"],
      ["A boolean", "Sí"],
    ]);
    expect(entries.map((entry) => entry.node.raw)).toEqual(["valor personalizado", 42, true]);
  });

  it("conserva de forma explícita los campos adicionales nulos o ausentes", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      custom_null: null,
      custom_undefined: undefined,
      custom_blank: "  ",
    } as ExtractedData;

    const { entries } = buildAdditionalFields(data);

    expect(entries.map((entry) => entry.displayLabel)).toEqual([
      "Custom null",
      "Custom undefined",
      "Custom blank",
    ]);
    expect(entries[0].node).toMatchObject({ kind: "null", absent: false });
    expect(entries[1].node).toMatchObject({ kind: "null", absent: true });
    expect(entries[2].node).toMatchObject({ kind: "scalar", blank: true, raw: "  " });
  });

  it("incluye campos adicionales de tipo objeto como etiquetas y valores", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      measurements: { systolic: 120, diastolic: 80, unit: "mmHg" },
    } as ExtractedData;

    const entry = additionalEntry(data, "measurements");

    expect(entry.displayLabel).toBe("Mediciones");
    expect(entry.node.kind).toBe("object");
    if (entry.node.kind !== "object") return;
    expect(entry.node.entries.map((field) => [field.displayLabel, field.node.raw])).toEqual([
      ["Presión sistólica", 120],
      ["Presión diastólica", 80],
      ["Unidad", "mmHg"],
    ]);
  });

  it("incluye campos adicionales de tipo array de textos como lista", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      allergies: ["penicilina", "aspirina"],
    } as ExtractedData;

    const entry = additionalEntry(data, "allergies");

    expect(entry.displayLabel).toBe("Allergies");
    expect(entry.node).toMatchObject({ kind: "list", listKind: "text" });
    expect((entry.node as ListNode).items.map(cellText)).toEqual(["penicilina", "aspirina"]);
  });

  it("incluye campos adicionales de tipo array de objetos como tabla", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      lab_results: [
        { test: "glucosa", value: 95 },
        { test: "colesterol", value: 180 },
      ],
    } as ExtractedData;

    const table = tableFor(data, "lab_results", true);

    expect(additionalEntry(data, "lab_results").displayLabel).toBe("Resultados de laboratorio");
    expect(table.columns.map((column) => column.heading)).toEqual([
      "Prueba",
      "Resultado",
      "Unidad",
      "Rango de referencia",
      "Test",
    ]);
    expect(tableText(table)).toEqual([
      ["—", "95", "—", "—", "glucosa"],
      ["—", "180", "—", "—", "colesterol"],
    ]);
  });

  it("conserva propiedades nulas dentro de objetos y arrays adicionales", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      measurements: { systolic: 120, note: null },
      lab_results: [{ test: "glucosa", value: null }, null],
    } as ExtractedData;

    const measurements = additionalEntry(data, "measurements").node;
    expect(measurements.kind).toBe("object");
    if (measurements.kind !== "object") return;
    expect(measurements.entries.map((field) => [field.displayLabel, cellText(field.node)])).toEqual([
      ["Presión sistólica", "120"],
      ["Note", "—"],
    ]);

    const labs = additionalEntry(data, "lab_results").node as ListNode;
    expect(labs.listKind).toBe("mixed");
    expect(labs.items.map((item) => item.kind)).toEqual(["object", "null"]);
    expect(isLabResultsTable(additionalEntry(data, "lab_results"))).toBe(false);
  });

  it("representa colecciones vacías como nodos explícitos", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      empty_list: [],
      empty_object: {},
    } as ExtractedData;

    const { entries } = buildAdditionalFields(data);

    expect(entries.map((entry) => [entry.displayLabel, entry.node.kind])).toEqual([
      ["Empty list", "empty"],
      ["Empty object", "empty"],
    ]);
    expect(entries.map((entry) => (entry.node.kind === "empty" ? entry.node.shape : null))).toEqual([
      "list",
      "object",
    ]);
  });

  it("no genera campos para claves centrales que nunca fueron informadas", () => {
    const data: ExtractedData = {
      patient: { name: null, age: null },
      primary_diagnosis: null,
      medications: [],
      requested_studies: [],
    };

    expect(buildAdditionalFields(data).entries).toEqual([]);
    expect(buildExtractedDataRows(data)).toEqual([]);
  });
});

describe("buildFieldTable", () => {
  it("muestra lab_results con columnas clínicas y los valores recibidos", () => {
    const data = { lab_results: receivedLabResults } as ExtractedData;
    const entry = additionalEntry(data, "lab_results");

    expect(isLabResultsTable(entry)).toBe(true);

    const table = buildFieldTable(entry.node as ListNode, true);

    expect(table.columns.map((column) => column.heading)).toEqual([
      "Prueba",
      "Resultado",
      "Unidad",
      "Rango de referencia",
    ]);
    expect(table.columns.map((column) => column.key)).toEqual([
      "name",
      "value",
      "unit",
      "reference_range",
    ]);
    expect(tableText(table)).toEqual([
      ["Glucosa en sangre", "174", "mg/dL", "70–99 mg/dL"],
      ["Hemoglobina glucosilada (HbA1c)", "8.2", "%", "inferior a 5.7 %"],
      ["Creatinina sérica", "0.86", "mg/dL", "0.6–1.1 mg/dL"],
    ]);
    expect(table.rows.flatMap((row) => row.cells.map((cell) => cell.raw))).toEqual(
      receivedLabResults.flatMap((row) => [row.name, row.value, row.unit, row.reference_range]),
    );
  });

  it("conserva 174, 8.2 y 0.86 cuando llegan como números", () => {
    const numeric = receivedLabResults.map((row) => ({ ...row, value: Number(row.value) }));
    const table = tableFor({ lab_results: numeric } as ExtractedData, "lab_results", true);

    expect(table.rows.map((row) => cellText(row.cells[1]))).toEqual(["174", "8.2", "0.86"]);
    expect(table.rows.map((row) => row.cells[1].raw)).toEqual([174, 8.2, 0.86]);
  });

  it("reconoce alias de lab_results y de sus columnas", () => {
    const data = {
      labResults: [
        { nombre: "TSH", valor: "2.4", unidad: "mUI/L", referenceRange: "0.4–4.0 mUI/L" },
      ],
    } as ExtractedData;
    const entry = additionalEntry(data, "labResults");

    expect(isLabResultsTable(entry)).toBe(true);
    expect(entry.displayLabel).toBe("Resultados de laboratorio");
    expect(tableText(buildFieldTable(entry.node as ListNode, true))).toEqual([
      ["TSH", "2.4", "mUI/L", "0.4–4.0 mUI/L"],
    ]);
  });

  it("completa con — las columnas clínicas que no vienen informadas", () => {
    const table = tableFor(
      { lab_results: [{ name: "Glucosa", value: "174" }, { name: "TSH", value: null, unit: null }] } as ExtractedData,
      "lab_results",
      true,
    );

    expect(tableText(table)).toEqual([
      ["Glucosa", "174", "—", "—"],
      ["TSH", "—", "—", "—"],
    ]);
    expect(table.rows[0].cells[2]).toMatchObject({ kind: "null", absent: true });
    expect(table.rows[1].cells[2]).toMatchObject({ kind: "null", absent: false });
  });

  it("agrega las propiedades desconocidas como columnas adicionales", () => {
    const table = tableFor(
      {
        lab_results: [
          { name: "Glucosa", value: "174", unit: "mg/dL", reference_range: "70–99", flag: "alto", labCode: 12 },
        ],
      } as ExtractedData,
      "lab_results",
      true,
    );

    expect(table.columns.map((column) => column.heading)).toEqual([
      "Prueba",
      "Resultado",
      "Unidad",
      "Rango de referencia",
      "Flag",
      "Lab code",
    ]);
    expect(tableText(table)).toEqual([["Glucosa", "174", "mg/dL", "70–99", "alto", "12"]]);
  });

  it("conserva ambas propiedades cuando dos claves comparten alias", () => {
    const table = tableFor(
      { lab_results: [{ name: "Glucosa", unit: "mg/dL", unidad: "mmol/L", value: "174" }] } as ExtractedData,
      "lab_results",
      true,
    );

    expect(table.columns.map((column) => [column.key, column.heading])).toEqual([
      ["name", "Prueba"],
      ["value", "Resultado"],
      ["unit", "Unidad (unit)"],
      ["reference_range", "Rango de referencia"],
      ["unidad", "Unidad (unidad)"],
    ]);
    expect(tableText(table)).toEqual([["Glucosa", "174", "mg/dL", "—", "mmol/L"]]);
  });

  it("incluye filas vacías de la lista como filas con —", () => {
    const table = tableFor(
      { lab_results: [{ name: "Glucosa", value: "174" }, {}] } as ExtractedData,
      "lab_results",
      true,
    );

    expect(tableText(table)).toEqual([
      ["Glucosa", "174", "—", "—"],
      ["—", "—", "—", "—"],
    ]);
  });

  it("usa una tabla genérica con todas las propiedades de otros arrays de objetos", () => {
    const data = {
      procedures: [
        { procedure_name: "Biopsia", done: true, notes: null },
        { procedure_name: "Ecografía", site: "Abdomen", done: false },
      ],
    } as ExtractedData;
    const entry = additionalEntry(data, "procedures");

    expect(isLabResultsTable(entry)).toBe(false);

    const table = buildFieldTable(entry.node as ListNode);

    expect(entry.displayLabel).toBe("Procedures");
    expect(table.columns.map((column) => column.heading)).toEqual([
      "Procedure name",
      "Done",
      "Notes",
      "Site",
    ]);
    expect(tableText(table)).toEqual([
      ["Biopsia", "Sí", "—", "—"],
      ["Ecografía", "No", "—", "Abdomen"],
    ]);
    expect(table.rows.map((row) => row.key)).toEqual(["procedures.0", "procedures.1"]);
  });

  it("califica las columnas genéricas que colisionan sin perder ninguna", () => {
    const table = buildFieldTable(
      buildFieldNode([{ unit: "mg/dL" }, { unidad: "mmol/L" }]) as ListNode,
    );

    expect(table.columns.map((column) => column.heading)).toEqual([
      "Unidad (unit)",
      "Unidad (unidad)",
    ]);
    expect(tableText(table)).toEqual([
      ["mg/dL", "—"],
      ["—", "mmol/L"],
    ]);
  });

  it("no usa la tabla clínica cuando lab_results no es una lista de objetos", () => {
    expect(isLabResultsTable(additionalEntry({ lab_results: ["174", "8.2"] } as ExtractedData, "lab_results"))).toBe(false);
    expect(isLabResultsTable(additionalEntry({ lab_results: [] } as ExtractedData, "lab_results"))).toBe(false);
    expect(isLabResultsTable(additionalEntry({ lab_results: null } as ExtractedData, "lab_results"))).toBe(false);
    expect(isLabResultsTable(additionalEntry({ measurements: [{ name: "x" }] } as ExtractedData, "measurements"))).toBe(false);
  });
});
