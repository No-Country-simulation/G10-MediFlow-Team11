import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterDocuments } from "../utils/historySelection";
import { adaptDocumentList } from "../utils/documentListAdapter";
import { documentListMocks } from "../mocks/documentListMocks";

vi.mock("../config/env", () => ({
  env: { apiBaseUrl: "http://localhost:8080", useMocks: true },
}));

async function loadWorkflow() {
  const [list, result, history, review, processing, audit] = await Promise.all([
    import("./documentListService"),
    import("./resultService"),
    import("./historyService"),
    import("./reviewService"),
    import("./processingService"),
    import("./auditService"),
  ]);
  return { ...list, ...result, ...history, ...review, ...processing, ...audit };
}

describe("document list integration with the mock review workflow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("lists pending workflow documents once, with metadata from their original source", async () => {
    const api = await loadWorkflow();
    const list = await api.getDocumentList();
    const queue = await api.getAuditQueue();
    expect(list).toHaveLength(6);
    expect(new Set(list.map((item) => item.documentId)).size).toBe(list.length);
    for (const item of queue) {
      expect(list.find((document) => document.documentId === item.document_id)).toMatchObject({
        status: "NEEDS_AUDIT",
        inputType: item.input_type,
        fileName: item.file_name,
        documentType: (await api.getDocumentResult(item.document_id))?.classification?.document_type,
        createdAt: item.created_at,
        updatedAt: (await api.getDocumentHistory(item.document_id))?.entries.at(-1)?.occurredAt,
      });
    }
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each(["APPROVE", "REJECT"] as const)(
    "%s keeps current result, history, metadata and status filters consistent without changing the initial snapshot",
    async (decision) => {
      const api = await loadWorkflow();
      const id = "DOC-2026-0002";
      const before = (await api.getDocumentList()).find((item) => item.documentId === id)!;
      const initialHistory = await api.getDocumentHistory(id);
      expect(before.status).toBe("NEEDS_AUDIT");
      expect(filterDocuments(await api.getDocumentList(), id, "NEEDS_AUDIT")).toHaveLength(1);

      await api.submitReview(id, {
        decision,
        classification: { document_type: "STUDY_REPORT" },
        routing_decision: { primary_destination: "PHARMACY" },
        validation: { missing_fields: [], inconsistencies: [], warnings: [] },
      });

      const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const list = await api.getDocumentList();
      const current = list.find((item) => item.documentId === id);
      const history = await api.getDocumentHistory(id);
      expect(current).toEqual({
        ...before, status, documentType: "STUDY_REPORT", updatedAt: "2026-10-22T12:00:00.000Z",
      });
      expect((await api.getDocumentResult(id))?.status).toBe(status);
      expect(history?.entries).toHaveLength(2);
      expect(history?.entries[0]).toEqual(initialHistory?.entries[0]);
      expect(history?.entries.at(-1)).toMatchObject({
        decision, occurredAt: current?.updatedAt,
        result: { status, classification: { document_type: current?.documentType } },
      });
      expect(filterDocuments(list, id, status)).toEqual([current]);
      expect(filterDocuments(list, id, "NEEDS_AUDIT")).toEqual([]);
      expect((await api.getAuditQueue()).some((item) => item.document_id === id)).toBe(false);
    },
  );

  it("includes files added during the session once and preserves their original metadata after review", async () => {
    const api = await loadWorkflow();
    const file = new File(["synthetic test file"], "orden.pdf", { type: "application/pdf" });
    const registered = await api.processFile({ file, origin_channel: "WEB" });
    const id = registered.document_id;
    const createdAt = new Date().toISOString();
    for (let read = 0; read < 2; read++) {
      const list = await api.getDocumentList();
      expect(list).toHaveLength(7);
      expect(list.filter((item) => item.documentId === id)).toEqual([{
        documentId: id, status: "NEEDS_AUDIT", inputType: "FILE", fileName: "orden.pdf",
        documentType: null, createdAt, updatedAt: createdAt,
      }]);
      expect(list[0].documentId).toBe(id);
    }
    vi.setSystemTime(new Date("2026-10-22T12:05:00Z"));
    await api.submitReview(id, { decision: "REJECT" });
    expect((await api.getDocumentList()).find((item) => item.documentId === id)).toEqual({
      documentId: id, status: "REJECTED", inputType: "FILE", fileName: "orden.pdf",
      documentType: null, createdAt, updatedAt: "2026-10-22T12:05:00.000Z",
    });
  });

  it("preserves static documents and the RECEIVED document with no history events", async () => {
    const api = await loadWorkflow();
    const staticDocuments = adaptDocumentList(documentListMocks)
      .filter((item) => item.documentId !== "DOC-2026-0002");
    const list = await api.getDocumentList();
    expect(list.filter((item) => staticDocuments.some((original) => original.documentId === item.documentId)))
      .toEqual(staticDocuments);
    expect(await api.getDocumentHistory("DOC-2026-0005"))
      .toEqual({ documentId: "DOC-2026-0005", entries: [] });
    expect((await api.getDocumentResult("DOC-2026-0005"))?.status).toBe("RECEIVED");
    list[0].status = "FAILED";
    expect((await api.getDocumentList())[0].status).toBe("RECEIVED");
  });

  it("resets reviews and session uploads when modules reload, without mutating static fixtures", async () => {
    const originalFixtures = structuredClone(documentListMocks);
    const api = await loadWorkflow();
    await api.submitReview("DOC-2026-0002", { decision: "REJECT" });
    const uploaded = await api.processFile({
      file: new File(["synthetic"], "sesion.pdf", { type: "application/pdf" }), origin_channel: "WEB",
    });
    expect((await api.getDocumentList()).find((item) => item.documentId === "DOC-2026-0002")?.status)
      .toBe("REJECTED");
    expect((await api.getDocumentList()).some((item) => item.documentId === uploaded.document_id)).toBe(true);

    vi.resetModules();
    const reloaded = await loadWorkflow();
    const list = await reloaded.getDocumentList();
    expect(list).toHaveLength(6);
    expect(list.find((item) => item.documentId === "DOC-2026-0002")?.status).toBe("NEEDS_AUDIT");
    expect(list.some((item) => item.documentId === uploaded.document_id)).toBe(false);
    expect((await reloaded.getDocumentResult("DOC-2026-0002"))?.status).toBe("NEEDS_AUDIT");
    expect((await reloaded.getDocumentHistory("DOC-2026-0002"))?.entries).toHaveLength(1);
    expect(await reloaded.getDocumentHistory(uploaded.document_id)).toBeNull();
    expect(documentListMocks).toEqual(originalFixtures);
  });
});
