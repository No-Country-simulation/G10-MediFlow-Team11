import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AuditQueueCard from "./AuditQueueCard";
import type { AuditQueueItem } from "../../types/audit";

const item: AuditQueueItem = {
  document_id: "DOC-585b7f42-99ba-44dd-9b0a-dea23e633207",
  status: "NEEDS_AUDIT", input_type: "TEXT", mime_type: "application/json",
  file_name: null, document_type: null,
  audit_reasons: ["LOW_CONFIDENCE", "MISSING_CRITICAL_FIELDS", "INVALID_AI_RESPONSE"],
  created_at: "2026-10-24T12:00:00Z", updated_at: "2026-10-24T12:00:00Z",
};

describe("AuditQueueCard", () => {
  it.each([
    ["TEXT", null, "Texto ingresado"],
    ["FILE", "informe original.pdf", "informe original.pdf"],
    ["FILE", null, "Archivo sin nombre"],
  ] as const)("keeps one accessible review link for %s / %s", (input_type, file_name, label) => {
    const markup = renderToStaticMarkup(<MemoryRouter><AuditQueueCard
      item={{ ...item, input_type, file_name }} formatDate={() => "24 oct 2026"} /> </MemoryRouter>);
    expect(markup.match(/<a\b/g)).toHaveLength(1);
    expect(markup).not.toMatch(/<button\b/);
    expect(markup).toContain(`href="/audit/${item.document_id}/review"`);
    expect(markup).toContain(`aria-label="Revisar documento ${item.document_id}: Sin clasificar"`);
    expect(markup).toContain(`title="${item.document_id}"`);
    expect(markup).toContain(`document-identity__suffix">${item.document_id.slice(-7)}</span>`);
    expect(markup).toContain(label);
    expect(markup).toContain("Baja confianza del análisis");
    expect(markup).toContain("Información crítica incompleta");
    expect(markup).toContain("No se obtuvo una respuesta válida del servicio de análisis");
    expect(markup.indexOf("Sin clasificar</span>")).toBeLessThan(markup.indexOf(label));
    expect(markup.indexOf(label)).toBeLessThan(markup.indexOf('class="audit-queue__document-id"'));
    expect(markup.indexOf("Baja confianza del análisis")).toBeLessThan(markup.indexOf('class="audit-queue__action"'));
  });
});
