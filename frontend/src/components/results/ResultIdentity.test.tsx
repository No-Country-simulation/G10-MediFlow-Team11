import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { DocumentStatus, StorageState } from "../../types/processing";
import ResultIdentity from "./ResultIdentity";

function renderIdentity(status: DocumentStatus, storageState: StorageState, documentId = "DOC-2026-0001") {
  return renderToStaticMarkup(
    <MemoryRouter>
      <ResultIdentity documentId={documentId} status={status} storageState={storageState} titleId="result-title" />
    </MemoryRouter>,
  );
}

describe("ResultIdentity", () => {
  it.each([
    ["RECEIVED", "Recibido"],
    ["PROCESSED", "Procesado"],
    ["NEEDS_AUDIT", "Requiere revisión"],
    ["APPROVED", "Aprobado"],
    ["REJECTED", "Rechazado"],
    ["FAILED", "Fallido"],
  ] as const)("shows %s using its shared text label", (status, label) => {
    const markup = renderIdentity(status, "SUCCESS", "DOC-2026-VERY-LONG-IDENTIFIER-0001");
    expect(markup).toContain(`data-status="${status}"`);
    expect(markup).toContain(label);
    expect(markup).toContain("DOC-2026-VERY-LONG-IDENTIFIER-0001");
    expect(markup).toContain("Copiar ID");
    expect(markup).toContain("Ver historial");
    expect(markup).toContain("/history?documentId=DOC-2026-VERY-LONG-IDENTIFIER-0001");
    expect(markup).not.toContain("Guardado correctamente");
  });

  it.each([
    ["PENDING", "Almacenamiento pendiente"],
    ["ERROR", "Problema de almacenamiento"],
  ] as const)("shows %s storage separately from processing status", (storageState, label) => {
    const markup = renderIdentity("PROCESSED", storageState);
    expect(markup).toContain("Procesado");
    expect(markup).toContain(label);
    expect(markup).toContain(`result-meta__storage--${storageState.toLowerCase()}`);
    expect(markup).toContain('role="status"');
  });
});
