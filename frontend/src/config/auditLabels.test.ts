import { describe, expect, it } from "vitest";
import { auditReasonLabel } from "./auditLabels";

describe("auditReasonLabel", () => {
  it("explains LOW_CONFIDENCE in plain language", () => {
    expect(auditReasonLabel("LOW_CONFIDENCE")).toBe(
      "El sistema tuvo dudas al analizar este documento",
    );
  });

  it.each([
    ["ILLEGIBLE_DOCUMENT", "Documento ilegible"],
    ["MISSING_CRITICAL_FIELDS", "Campos obligatorios no detectados"],
    ["INCONSISTENT_DATA", "Datos inconsistentes"],
    ["INVALID_AI_RESPONSE", "No se obtuvo una respuesta válida del servicio de análisis"],
    ["AI_TIMEOUT", "Tiempo de espera agotado"],
    ["AI_UNAVAILABLE", "Servicio de análisis no disponible"],
  ])("preserves the existing label for %s", (reason, label) => {
    expect(auditReasonLabel(reason)).toBe(label);
  });
});
