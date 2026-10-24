import { describe, expect, it } from "vitest";
import { getDocumentTypeName } from "./documentTypeLabels";
import { documentTypeLabel } from "./auditLabels";
import { getDocumentTypeLabel } from "../utils/historyLabels";
import type { DocumentType } from "../types/processing";

const expected: Record<DocumentType, string> = {
  PRESCRIPTION: "Receta médica", IMAGING_REPORT: "Informe de imágenes",
  STUDY_REPORT: "Informe de estudio", PROCEDURE_ORDER: "Orden de procedimiento",
  DISCHARGE_SUMMARY: "Resumen de alta", MEDICAL_CERTIFICATE: "Certificado médico",
};

describe("shared document type labels", () => {
  it.each(Object.entries(expected))("uses the approved label for %s in all public helpers", (type, label) => {
    expect(getDocumentTypeName(type)).toBe(label);
    expect(documentTypeLabel(type)).toBe(label);
    expect(getDocumentTypeLabel(type)).toBe(label);
  });
  it("preserves the contextual null and unavailable fallbacks", () => {
    expect(documentTypeLabel(null)).toBe("Sin clasificar");
    for (const value of [null, undefined, 42]) expect(getDocumentTypeLabel(value)).toBe("No disponible");
    for (const type of ["UNKNOWN_TYPE", ""]) {
      expect(documentTypeLabel(type)).toBe(type);
      expect(getDocumentTypeLabel(type)).toBe(type);
    }
  });
});
