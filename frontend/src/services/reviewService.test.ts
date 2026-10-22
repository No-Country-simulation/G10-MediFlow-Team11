import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitReview } from "./reviewService";
import { ApiError } from "./processingService";

vi.mock("../config/env", () => ({ env: { apiBaseUrl: "http://localhost:8080", useMocks: false } }));

describe("submitReview", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("sends PATCH with only the supplied allowed changes and decision", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      document_id: "DOC-22", status: "APPROVED", message: "OK",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await submitReview("DOC-22", { decision: "APPROVE", classification: { priority_level: "URGENT" } });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/v1/documents/DOC-22/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ decision: "APPROVE", classification: { priority_level: "URGENT" } }),
    });
  });

  it.each([[400, "REVIEW_VALIDATION_FAILED"], [409, "INVALID_REVIEW_STATE"]])("preserves Backend error %i/%s", async (status, code) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
        error: { code, message: "Backend review error" },
      }), { status, headers: { "Content-Type": "application/json" } })));
      await expect(submitReview("DOC-22", { decision: "REJECT" }))
        .rejects.toMatchObject({ status, code, message: "Backend review error" } satisfies Partial<ApiError>);
  });
});
