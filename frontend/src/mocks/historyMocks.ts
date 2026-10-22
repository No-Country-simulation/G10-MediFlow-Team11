import {
  approvedResultMock,
  needsAuditResultMock,
  processedResultMock,
  rejectedResultMock,
} from "./resultMocks";
import type { DocumentHistoryApiResponse } from "../types/history";

export const historyMocks: Record<string, DocumentHistoryApiResponse> = {
  // RECEIVED: el primer resultado confirmado todavía no existe.
  "DOC-2026-0005": {
    document_id: "DOC-2026-0005",
    entries: [],
  },
  "DOC-2026-0001": {
    document_id: "DOC-2026-0001",
    entries: [
      {
        sequence: 1,
        event_type: "INITIAL_TRIAGE",
        decision: null,
        occurred_at: "2026-10-10T09:30:00Z",
        result: structuredClone(processedResultMock),
      },
    ],
  },

  "DOC-2026-0002": {
    document_id: "DOC-2026-0002",
    entries: [
      {
        sequence: 1,
        event_type: "INITIAL_TRIAGE",
        decision: null,
        occurred_at: "2026-10-10T10:15:00Z",
        result: structuredClone(needsAuditResultMock),
      },
    ],
  },

  "DOC-2026-0003": {
    document_id: "DOC-2026-0003",
    entries: [
      {
        sequence: 1,
        event_type: "INITIAL_TRIAGE",
        decision: null,
        occurred_at: "2026-10-11T08:20:00Z",
        result: {
          ...structuredClone(approvedResultMock),
          status: "NEEDS_AUDIT",
          routing_decision: {
            ...structuredClone(approvedResultMock.routing_decision),
            primary_destination: "HUMAN_REVIEW",
            requires_human_review: true,
            justification:
              "Documento derivado a revisión humana por baja confianza.",
          },
        },
      },
      {
        sequence: 2,
        event_type: "HUMAN_REVIEW",
        decision: "APPROVE",
        occurred_at: "2026-10-11T11:45:00Z",
        result: structuredClone(approvedResultMock),
      },
    ],
  },

  "DOC-2026-0004": {
    document_id: "DOC-2026-0004",
    entries: [
      {
        sequence: 1,
        event_type: "INITIAL_TRIAGE",
        decision: null,
        occurred_at: "2026-10-12T09:10:00Z",
        result: {
          ...structuredClone(rejectedResultMock),
          status: "NEEDS_AUDIT",
          routing_decision: {
            ...structuredClone(rejectedResultMock.routing_decision),
            primary_destination: "HUMAN_REVIEW",
            requires_human_review: true,
            justification:
              "Documento derivado a revisión humana por información incompleta.",
          },
        },
      },
      {
        sequence: 2,
        event_type: "HUMAN_REVIEW",
        decision: "REJECT",
        occurred_at: "2026-10-12T12:30:00Z",
        result: structuredClone(rejectedResultMock),
      },
    ],
  },
};
