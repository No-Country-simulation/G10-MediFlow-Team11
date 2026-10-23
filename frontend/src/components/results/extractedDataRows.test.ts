import { describe, expect, it } from "vitest";
import { buildExtractedDataRows } from "./extractedDataRows";
import type { ExtractedData } from "../../types/processing";

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

  it("incluye campos adicionales permitidos por el contrato", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      custom_field: "valor personalizado",
      another_number: 42,
      a_boolean: true,
    } as ExtractedData;

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Custom Field",
      value: "valor personalizado",
    });
    expect(rows).toContainEqual({
      label: "Another Number",
      value: "42",
    });
    expect(rows).toContainEqual({
      label: "A Boolean",
      value: "true",
    });
  });

  it("no incluye campos adicionales nulos", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      custom_null: null,
      custom_undefined: undefined,
    } as ExtractedData;

    const rows = buildExtractedDataRows(data);

    expect(
      rows.find((row) => row.label === "Custom Null"),
    ).toBeUndefined();
    expect(
      rows.find((row) => row.label === "Custom Undefined"),
    ).toBeUndefined();
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

  it("incluye campos adicionales de tipo objeto como pares legibles", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      measurements: { systolic: 120, diastolic: 80, unit: "mmHg" },
    } as ExtractedData;

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Mediciones",
      value: ["Presión sistólica: 120", "Presión diastólica: 80", "Unidad: mmHg"],
    });
  });

  it("incluye campos adicionales de tipo array de primitivos como lista", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      allergies: ["penicilina", "aspirina"],
    } as ExtractedData;

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Allergies",
      value: ["penicilina", "aspirina"],
    });
  });

  it("incluye campos adicionales de tipo array de objetos como lista legible", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      lab_results: [
        { test: "glucosa", value: 95 },
        { test: "colesterol", value: 180 },
      ],
    } as ExtractedData;

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Lab Results",
      value: ["Test: glucosa · Value: 95", "Test: colesterol · Value: 180"],
    });
  });

  it("omite propiedades nulas dentro de objetos y arrays adicionales", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      measurements: { systolic: 120, note: null },
      lab_results: [{ test: "glucosa", value: null }, null],
    } as ExtractedData;

    const rows = buildExtractedDataRows(data);

    expect(rows).toContainEqual({
      label: "Mediciones",
      value: ["Presión sistólica: 120"],
    });
    expect(rows).toContainEqual({
      label: "Lab Results",
      value: ["Test: glucosa"],
    });
  });

  it("no incluye campos adicionales de tipo array vacío", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      empty_list: [],
    } as ExtractedData;

    const rows = buildExtractedDataRows(data);

    expect(
      rows.find((row) => row.label === "Empty List"),
    ).toBeUndefined();
  });

  it("no incluye campos adicionales de tipo objeto vacío", () => {
    const data: ExtractedData = {
      patient: { name: "Ana López" },
      empty_object: {},
    } as ExtractedData;

    const rows = buildExtractedDataRows(data);

    expect(
      rows.find((row) => row.label === "Empty Object"),
    ).toBeUndefined();
  });
});
