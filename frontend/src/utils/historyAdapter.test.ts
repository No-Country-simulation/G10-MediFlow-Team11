import { describe, expect, it } from "vitest";
import { adaptDocumentHistory } from "./historyAdapter";
import type { DocumentHistoryApiResponse } from "../types/history";

describe("adaptDocumentHistory", () => {
  it("converts the API history response from snake_case to camelCase", () => {
    const apiResponse: DocumentHistoryApiResponse = {
      document_id: "DOC-2026-0001",
      entries: [
        {
          sequence: 1,
          event_type: "INITIAL_TRIAGE",
          decision: null,
          occurred_at: "2026-10-10T09:30:00Z",
          result: {
            status: "NEEDS_AUDIT",
          },
        },
      ],
    };

    const result = adaptDocumentHistory(apiResponse);

    expect(result).toEqual({
      documentId: "DOC-2026-0001",
      entries: [
        {
          sequence: 1,
          eventType: "INITIAL_TRIAGE",
          decision: null,
          occurredAt: "2026-10-10T09:30:00Z",
          result: {
            status: "NEEDS_AUDIT",
          },
        },
      ],
    });
  });

  it("preserves multiple history events and their order", () => {
    const apiResponse: DocumentHistoryApiResponse = {
      document_id: "DOC-2026-0003",
      entries: [
        {
          sequence: 1,
          event_type: "INITIAL_TRIAGE",
          decision: null,
          occurred_at: "2026-10-10T09:30:00Z",
          result: { status: "NEEDS_AUDIT" },
        },
        {
          sequence: 2,
          event_type: "HUMAN_REVIEW",
          decision: "APPROVE",
          occurred_at: "2026-10-10T10:15:00Z",
          result: { status: "APPROVED" },
        },
      ],
    };

    const result = adaptDocumentHistory(apiResponse);

    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(result.entries.map((entry) => entry.eventType)).toEqual([
      "INITIAL_TRIAGE",
      "HUMAN_REVIEW",
    ]);
    expect(result.entries[1].decision).toBe("APPROVE");
    expect(result.entries[1].result).toEqual({ status: "APPROVED" });
  });

  it("handles an empty history", () => {
    const apiResponse: DocumentHistoryApiResponse = {
      document_id: "DOC-2026-0005",
      entries: [],
    };

    const result = adaptDocumentHistory(apiResponse);

    expect(result).toEqual({
      documentId: "DOC-2026-0005",
      entries: [],
    });
  });
});
