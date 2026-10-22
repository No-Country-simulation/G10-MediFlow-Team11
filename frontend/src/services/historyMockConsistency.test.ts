import { describe, expect, it, vi } from "vitest";
import { getDocumentList } from "./documentListService";
import { getDocumentHistory } from "./historyService";
import { getDocumentResult } from "./resultService";

vi.mock("../config/env", () => ({
  env: { apiBaseUrl: "http://localhost:8080", useMocks: true },
}));

describe("document history mocks", () => {
  it("keeps the empty-history document in RECEIVED before initial triage", async () => {
    const documentId = "DOC-2026-0005";
    const [list, history, result] = await Promise.all([
      getDocumentList(),
      getDocumentHistory(documentId),
      getDocumentResult(documentId),
    ]);

    expect(list.find((document) => document.documentId === documentId)?.status).toBe("RECEIVED");
    expect(history).toEqual({ documentId, entries: [] });
    expect(result).toMatchObject({
      document_id: documentId,
      status: "RECEIVED",
      classification: null,
      confidence: null,
      extracted_data: null,
      validation: null,
      routing_decision: {
        primary_destination: "HUMAN_REVIEW",
        requires_human_review: false,
        audit_reasons: [],
        justification: "Procesamiento pendiente",
      },
      notification: { generated: false },
      storage: { state: "PENDING" },
    });
  });

  it("retains initial triage for processed documents", async () => {
    const history = await getDocumentHistory("DOC-2026-0001");

    expect(history?.entries[0]).toMatchObject({
      sequence: 1,
      eventType: "INITIAL_TRIAGE",
      result: { status: "PROCESSED" },
    });
  });
});
