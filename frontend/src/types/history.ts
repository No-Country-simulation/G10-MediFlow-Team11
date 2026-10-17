export type HistoryEventType = "INITIAL_TRIAGE" | "HUMAN_REVIEW";

export type HumanDecision = "APPROVE" | "REJECT";

export interface HistoryEntry {
  sequence: number;
  eventType: HistoryEventType;
  decision: HumanDecision | null;
  occurredAt: string;
  result: Record<string, unknown>;
}

export interface DocumentHistoryResponse {
  documentId: string;
  entries: HistoryEntry[];
}

export interface HistoryEntryApi {
  sequence: number;
  event_type: HistoryEventType;
  decision: HumanDecision | null;
  occurred_at: string;
  result: Record<string, unknown>;
}

export interface DocumentHistoryApiResponse {
  document_id: string;
  entries: HistoryEntryApi[];
}
