import { describe, expect, it } from "vitest";
import { destinationPresentation } from "./destinationPresentation";
import type { DocumentStatus } from "../types/processing";

describe("destination presentation", () => {
  it.each([
    ["NEEDS_AUDIT", "Destino propuesto", "Pendiente de confirmación en revisión clínica"],
    ["PROCESSED", "Destino confirmado", null], ["APPROVED", "Destino confirmado", null],
    ["REJECTED", "Destino registrado", "No se aplicó un destino final"],
    ["FAILED", "Destino registrado", "No se aplicó un destino final"],
    ["RECEIVED", "Destino pendiente", "Procesamiento pendiente"],
    ["PROCESSING", "Destino pendiente", "Procesamiento pendiente"],
  ] as const)("labels %s without claiming an external dispatch", (status, label, note) => {
    expect(destinationPresentation(status as DocumentStatus)).toEqual({ label, note });
  });
});
