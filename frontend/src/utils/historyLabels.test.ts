import { describe, expect, it } from "vitest";
import { auditReasonLabel } from "../config/auditLabels";
import { getAuditReasonLabel } from "./historyLabels";

describe("getAuditReasonLabel", () => {
  it("uses the shared LOW_CONFIDENCE label without a trailing period", () => {
    const label = getAuditReasonLabel("LOW_CONFIDENCE");

    expect(label).toBe("El sistema tuvo dudas al analizar este documento");
    expect(label).toBe(auditReasonLabel("LOW_CONFIDENCE"));
  });

  it.each([
    ["ILLEGIBLE_DOCUMENT", "Documento ilegible"],
    ["MISSING_CRITICAL_FIELDS", "Información crítica incompleta"],
    ["INCONSISTENT_DATA", "Datos inconsistentes"],
    ["INVALID_AI_RESPONSE", "Respuesta inválida de la IA"],
    ["AI_TIMEOUT", "Tiempo de espera agotado de la IA"],
    ["AI_UNAVAILABLE", "IA no disponible"],
    ["UNKNOWN_REASON", "UNKNOWN_REASON"],
  ])("preserves the existing history label for %s", (reason, label) => {
    expect(getAuditReasonLabel(reason)).toBe(label);
  });
});
