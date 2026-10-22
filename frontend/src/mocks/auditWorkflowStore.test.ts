import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env", () => ({ env: { apiBaseUrl: "http://localhost:8080", useMocks: true } }));

describe("explicit mock audit workflow", () => {
  beforeEach(() => vi.resetModules());

  it("serves matching FILE and TEXT queue, result, content and history without API requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(["fixture"]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getAuditQueue } = await import("../services/auditService");
    const { getDocumentResult } = await import("../services/resultService");
    const { getDocumentContent } = await import("../services/documentService");
    const { getDocumentHistory } = await import("../services/historyService");
    const queue = await getAuditQueue();
    expect(queue.map((item) => [item.document_id, item.input_type])).toEqual([
      ["DOC-2026-0002", "FILE"], ["DOC-2026-0006", "TEXT"],
    ]);
    for (const item of queue) {
      expect((await getDocumentResult(item.document_id))?.status).toBe("NEEDS_AUDIT");
      expect((await getDocumentHistory(item.document_id))?.entries).toHaveLength(1);
    }
    expect((await getDocumentContent("DOC-2026-0006"))?.kind).toBe("text");
    expect((await getDocumentContent("DOC-2026-0002"))?.kind).toBe("file");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("mocks/document.jpg");
  });

  it("approves with recursive PATCH merge and removes the item from Audit", async () => {
    const { getAuditQueue } = await import("../services/auditService");
    const { getDocumentResult } = await import("../services/resultService");
    const { getDocumentHistory } = await import("../services/historyService");
    const { submitReview } = await import("../services/reviewService");
    const id = "DOC-2026-0002";
    await expect(submitReview(id, { decision: "APPROVE", routing_decision: { primary_destination: "PHARMACY" } }))
      .rejects.toMatchObject({ status: 400, code: "REVIEW_VALIDATION_FAILED" });
    const response = await submitReview(id, {
      decision: "APPROVE", routing_decision: { primary_destination: "PHARMACY" },
      extracted_data: { patient: { age: 54 } },
      validation: { missing_fields: [], inconsistencies: [], warnings: [] },
    });
    expect(response.status).toBe("APPROVED");
    expect((await getDocumentResult(id))?.extracted_data?.patient).toEqual({ name: "Elena Rodríguez Torres", age: 54 });
    expect((await getDocumentResult(id))?.confidence).toBeNull();
    expect((await getDocumentHistory(id))?.entries.at(-1)?.decision).toBe("APPROVE");
    expect((await getDocumentHistory(id))?.entries.at(-1)?.result.status).toBe("APPROVED");
    expect((await getAuditQueue()).some((item) => item.document_id === id)).toBe(false);
    await expect(submitReview(id, { decision: "REJECT" })).rejects.toMatchObject({ status: 409, code: "INVALID_REVIEW_STATE" });
  });

  it("rejects TEXT without approval requirements and keeps original content available", async () => {
    const { getAuditQueue } = await import("../services/auditService");
    const { getDocumentResult } = await import("../services/resultService");
    const { getDocumentContent } = await import("../services/documentService");
    const { getDocumentHistory } = await import("../services/historyService");
    const { submitReview } = await import("../services/reviewService");
    const id = "DOC-2026-0006";
    expect((await submitReview(id, { decision: "REJECT" })).status).toBe("REJECTED");
    expect((await getDocumentResult(id))?.status).toBe("REJECTED");
    expect((await getDocumentContent(id))?.kind).toBe("text");
    expect((await getDocumentHistory(id))?.entries.at(-1)?.decision).toBe("REJECT");
    expect((await getAuditQueue()).some((item) => item.document_id === id)).toBe(false);
  });

  it("adds an uploaded mock file to the same queue, result and original viewer", async () => {
    const { processFile } = await import("../services/processingService");
    const { getAuditQueue } = await import("../services/auditService");
    const { getDocumentResult } = await import("../services/resultService");
    const { getDocumentContent } = await import("../services/documentService");
    const file = new File(["mock pdf"], "orden.pdf", { type: "application/pdf" });
    const result = await processFile({ file, origin_channel: "WEB" });
    expect(result.status).toBe("NEEDS_AUDIT");
    expect((await getAuditQueue()).find((item) => item.document_id === result.document_id)?.file_name).toBe("orden.pdf");
    expect(await getDocumentResult(result.document_id)).toEqual(result);
    const content = await getDocumentContent(result.document_id);
    expect(content).toMatchObject({ kind: "file", mimeType: "application/pdf", blob: file });
  });
});
