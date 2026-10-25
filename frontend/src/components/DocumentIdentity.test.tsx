import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DocumentIdentity from "./DocumentIdentity";

describe("DocumentIdentity", () => {
  it.each([
    "585b7f42-99ba-44dd-9b0a-dea23e633207",
    "DOC-585b7f42-99ba-44dd-9b0a-dea23e633207",
    "DOC-2026-0001",
  ])("preserves the accessible original and an independent copy action for %s", (documentId) => {
    const markup = renderToStaticMarkup(<DocumentIdentity documentId={documentId} />);
    expect(markup).toContain(`Documento: ${documentId}</span>`);
    expect(markup).toContain(`aria-hidden="true" title="${documentId}"`);
    expect(markup).toContain('aria-label="Copiar ID del documento"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('role="status" aria-live="polite"');
    if (documentId.length > 12) {
      expect(markup).toContain(`document-identity__suffix">${documentId.slice(-7)}</span>`);
      expect(markup).toContain(`document-identity__prefix">${documentId.slice(0, -7)}</span>`);
    } else {
      expect(markup).toContain(`document-identity__prefix">${documentId}</span>`);
    }
  });
});
