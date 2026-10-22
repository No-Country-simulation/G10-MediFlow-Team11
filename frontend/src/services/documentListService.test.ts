import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDocumentList } from "./documentListService";
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

describe("getDocumentList", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads selectable documents from GET /api/v1/documents", async () => {
    const payload = [
      {
        document_id: "DOC-2026-0001",
        status: "APPROVED",
        input_type: "FILE",
        file_name: "informe.pdf",
        document_type: "IMAGING_REPORT",
        created_at: "2026-10-10T09:30:00Z",
        updated_at: "2026-10-10T09:31:00Z",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    globalThis.fetch = fetchMock;

    const result = await getDocumentList();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/documents",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual([
      {
        documentId: "DOC-2026-0001",
        status: "APPROVED",
        inputType: "FILE",
        fileName: "informe.pdf",
        documentType: "IMAGING_REPORT",
        createdAt: "2026-10-10T09:30:00Z",
        updatedAt: "2026-10-10T09:31:00Z",
      },
    ]);
  });

  it("returns an empty list when there are no documents", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse([]));

    await expect(getDocumentList()).resolves.toEqual([]);
  });

  it("throws a recoverable error when the list request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 500));

    await expect(getDocumentList()).rejects.toBeInstanceOf(ApiError);
  });

  it("forwards AbortSignal to fetch", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    globalThis.fetch = fetchMock;

    await getDocumentList(controller.signal);

    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(
      controller.signal,
    );
  });
});
