import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentHistory } from "./historyService";
import { ApiError } from "./processingService";

vi.mock("../config/env", () => ({
  env: {
    apiBaseUrl: "http://localhost:8080",
    useMocks: false,
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getDocumentHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("adapts the existing history contract for a selected document", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        document_id: "DOC-2026-0001",
        entries: [
          {
            sequence: 1,
            event_type: "INITIAL_TRIAGE",
            decision: null,
            occurred_at: "2026-10-10T09:30:00Z",
            result: { status: "PROCESSED" },
          },
        ],
      }),
    );

    const result = await getDocumentHistory("DOC-2026-0001");

    expect(result).toEqual({
      documentId: "DOC-2026-0001",
      entries: [
        {
          sequence: 1,
          eventType: "INITIAL_TRIAGE",
          decision: null,
          occurredAt: "2026-10-10T09:30:00Z",
          result: { status: "PROCESSED" },
        },
      ],
    });
  });

  it("returns null when the document does not exist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 404));

    await expect(getDocumentHistory("missing")).resolves.toBeNull();
  });

  it("throws when the history request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({}, 500));

    await expect(getDocumentHistory("DOC-2026-0001")).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("encodes the document identifier in the existing history URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ document_id: "DOC/1", entries: [] }),
    );
    globalThis.fetch = fetchMock;

    await getDocumentHistory("DOC/1");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:8080/api/v1/documents/DOC%2F1/history",
    );
  });
});
