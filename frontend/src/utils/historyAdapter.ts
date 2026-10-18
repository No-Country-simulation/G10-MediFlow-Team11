import type {
  DocumentHistoryApiResponse,
  DocumentHistoryResponse,
} from "../types/history";

export function adaptDocumentHistory(
  response: DocumentHistoryApiResponse,
): DocumentHistoryResponse {
  return {
    documentId: response.document_id,
    entries: response.entries.map((entry) => ({
      sequence: entry.sequence,
      eventType: entry.event_type,
      decision: entry.decision,
      occurredAt: entry.occurred_at,
      result: entry.result,
    })),
  };
}
