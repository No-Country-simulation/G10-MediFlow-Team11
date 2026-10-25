import { describe, expect, it } from "vitest";
import {
  clampPercent,
  formatMissingField,
  getDataRowLayout,
  getDocumentSourceLabels,
  getFieldRowLayout,
  getStatusTone,
  getValidationSections,
  hasValidationFindings,
  toPercent,
} from "./resultPresentation";
import type { Validation } from "../../types/processing";
import { buildFieldNode } from "../../utils/extractedFieldStructure";

const emptyValidation: Validation = {
  missing_fields: [],
  inconsistencies: [],
  warnings: [],
};

describe("getStatusTone", () => {
  it("asigna un tono por estado del documento", () => {
    expect(getStatusTone("PROCESSED")).toBe("success");
    expect(getStatusTone("APPROVED")).toBe("success");
    expect(getStatusTone("NEEDS_AUDIT")).toBe("attention");
    expect(getStatusTone("REJECTED")).toBe("danger");
    expect(getStatusTone("FAILED")).toBe("danger");
    expect(getStatusTone("RECEIVED")).toBe("neutral");
    expect(getStatusTone("PROCESSING")).toBe("neutral");
  });
});

describe("porcentajes", () => {
  it("redondea la confianza al entero más cercano", () => {
    expect(toPercent(0.634)).toBe(63);
    expect(toPercent(0.635)).toBe(64);
    expect(toPercent(1)).toBe(100);
  });

  it("trata valores no finitos como cero", () => {
    expect(toPercent(Number.NaN)).toBe(0);
    expect(toPercent(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("limita el porcentaje al rango 0-100", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(42)).toBe(42);
    expect(clampPercent(140)).toBe(100);
  });
});

describe("getDataRowLayout", () => {
  it("usa bloque para listas", () => {
    expect(getDataRowLayout({ label: "Medicamentos", value: ["A", "B"] })).toBe(
      "block",
    );
  });

  it("usa línea para valores cortos", () => {
    expect(getDataRowLayout({ label: "Paciente", value: "Juan Pérez" })).toBe(
      "inline",
    );
  });

  it("usa bloque desde 56 caracteres", () => {
    expect(
      getDataRowLayout({ label: "Notas", value: "x".repeat(55) }),
    ).toBe("inline");
    expect(
      getDataRowLayout({ label: "Notas", value: "x".repeat(56) }),
    ).toBe("block");
  });
});

describe("getFieldRowLayout", () => {
  it("usa línea para escalares cortos y para valores sin dato", () => {
    expect(getFieldRowLayout(buildFieldNode("Juan Pérez"))).toBe("inline");
    expect(getFieldRowLayout(buildFieldNode(42))).toBe("inline");
    expect(getFieldRowLayout(buildFieldNode(true))).toBe("inline");
    expect(getFieldRowLayout(buildFieldNode(null))).toBe("inline");
    expect(getFieldRowLayout(buildFieldNode("  "))).toBe("inline");
    expect(getFieldRowLayout(buildFieldNode([]))).toBe("inline");
    expect(getFieldRowLayout(buildFieldNode({}))).toBe("inline");
  });

  it("usa bloque para escalares largos, listas y objetos", () => {
    expect(getFieldRowLayout(buildFieldNode("x".repeat(55)))).toBe("inline");
    expect(getFieldRowLayout(buildFieldNode("x".repeat(56)))).toBe("block");
    expect(getFieldRowLayout(buildFieldNode(["a"]))).toBe("block");
    expect(getFieldRowLayout(buildFieldNode([{ a: 1 }]))).toBe("block");
    expect(getFieldRowLayout(buildFieldNode({ a: 1 }))).toBe("block");
  });
});

describe("validación", () => {
  it("detecta una validación sin hallazgos", () => {
    expect(hasValidationFindings(emptyValidation)).toBe(false);
    expect(getValidationSections(emptyValidation)).toEqual([]);
  });

  it("detecta hallazgos en cualquier categoría", () => {
    expect(
      hasValidationFindings({ ...emptyValidation, warnings: ["Aviso"] }),
    ).toBe(true);
  });

  it("devuelve solo las secciones con elementos y sus etiquetas", () => {
    const sections = getValidationSections({
      missing_fields: ["patient.name", "campo_desconocido"],
      inconsistencies: [],
      warnings: ["Cédula ilegible"],
    });

    expect(sections.map((section) => section.key)).toEqual([
      "missing_fields",
      "warnings",
    ]);
    expect(sections[0].items).toEqual([
      "Nombre del paciente",
      "Campo desconocido",
    ]);
    expect(sections[0].tone).toBe("attention");
  });

  it("marca las inconsistencias con tono de peligro", () => {
    const [section] = getValidationSections({
      ...emptyValidation,
      inconsistencies: ["Fechas incoherentes"],
    });

    expect(section.title).toBe("Inconsistencias");
    expect(section.tone).toBe("danger");
  });

  it("conserva el identificador cuando no hay etiqueta conocida", () => {
    expect(formatMissingField("primary_diagnosis")).toBe(
      "Diagnóstico principal",
    );
    expect(formatMissingField("otro.campo")).toBe("Campo");
  });
});

describe("getDocumentSourceLabels", () => {
  it("etiqueta el panel de una entrada de texto", () => {
    expect(getDocumentSourceLabels(true)).toEqual({
      title: "Texto original",
      subtitle: "Entrada de texto",
    });
  });

  it("etiqueta el panel de un documento", () => {
    expect(getDocumentSourceLabels(false)).toEqual({
      title: "Documento",
      subtitle: null,
    });
  });
});
