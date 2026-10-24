import { afterAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { UseAuditQueueResult } from "../hooks/useAuditQueue";
import type { AuditQueueItem } from "../types/audit";

let queue: UseAuditQueueResult;
vi.doMock("../hooks/useAuditQueue", () => ({ useAuditQueue: () => queue }));
const { default: AuditPage } = await import("./AuditPage");
afterAll(() => { vi.doUnmock("../hooks/useAuditQueue"); vi.resetModules(); });
const item: AuditQueueItem = {
  document_id: "DOC-1", status: "NEEDS_AUDIT", input_type: "TEXT", mime_type: "application/json",
  file_name: null, document_type: "PRESCRIPTION", audit_reasons: ["LOW_CONFIDENCE"],
  created_at: "2026-10-24T12:00:00Z", updated_at: "2026-10-24T12:00:00Z",
};
function render(state: UseAuditQueueResult["state"], items: AuditQueueItem[] = []) {
  queue = { state, items, error: "Error de prueba", reload: vi.fn() };
  return renderToStaticMarkup(<MemoryRouter><AuditPage /></MemoryRouter>);
}
describe("AuditPage", () => {
  it("keeps empty, singular and plural states and API order", () => {
    expect(render("ready")).toContain("No hay documentos pendientes");
    expect(render("ready", [item])).toContain("1 documento pendiente");
    const markup = render("ready", [item, { ...item, document_id: "DOC-2" }]);
    expect(markup).toContain("2 documentos pendientes");
    expect(markup.indexOf('href="/audit/DOC-1/review"')).toBeLessThan(markup.indexOf('href="/audit/DOC-2/review"'));
    expect(markup).toContain("Revise los documentos pendientes, compárelos con el original y registre una decisión.");
  });
  it("preserves loading and error feedback with retry", () => {
    expect(render("loading")).toContain('aria-busy="true" role="status"');
    const markup = render("error");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Error de prueba");
    expect(markup).toContain("Reintentar</button>");
  });
});
