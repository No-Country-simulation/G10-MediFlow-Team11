import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({ env: { apiBaseUrl: "http://localhost:8080", useMocks: false } }));

describe("real audit queue integration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("reads the Backend snake_case queue and keeps only NEEDS_AUDIT", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { document_id: "DOC-A", status: "NEEDS_AUDIT", input_type: "TEXT", mime_type: "application/json",
        file_name: null, document_type: null, audit_reasons: [], created_at: "2026-10-10T10:00:00Z", updated_at: "2026-10-10T10:00:00Z" },
      { document_id: "DOC-B", status: "APPROVED" },
    ]), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { getAuditQueue } = await import("./auditService");
    expect((await getAuditQueue()).map((item) => item.document_id)).toEqual(["DOC-A"]);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/documents/audit", {
      method: "GET", signal: undefined,
    });
  });

  it("surfaces Backend errors and never substitutes mock documents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: "PERSISTENCE_ERROR", message: "No se pudieron consultar los documentos." },
    }), { status: 500, headers: { "Content-Type": "application/json" } })));
    const { getAuditQueue } = await import("./auditService");
    await expect(getAuditQueue()).rejects.toMatchObject({
      status: 500, code: "PERSISTENCE_ERROR", message: "No se pudieron consultar los documentos.",
    });
  });

  it("reports a failed network request without mock fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const { getAuditQueue } = await import("./auditService");
    await expect(getAuditQueue()).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });
});
