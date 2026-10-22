import { env } from "../config/env";
import {
  approvedResultMock,
  needsAuditResultMock,
  processedResultMock,
  rejectedResultMock,
} from "../mocks/resultMocks";
import type { ProcessingResponse } from "../types/processing";
import { ApiError } from "./processingService";
import { getMockWorkflowResult } from "../mocks/auditWorkflowStore";

const mockResults: ProcessingResponse[] = [
  processedResultMock,
  needsAuditResultMock,
  approvedResultMock,
  rejectedResultMock,
  // DOC-2026-0005 cubre resultado sin original asociado al visor.
  {
    ...processedResultMock,
    document_id: "DOC-2026-0005",
    classification: null,
    confidence: null,
    extracted_data: null,
    validation: {
      missing_fields: [],
      inconsistencies: [],
      warnings: [],
    },
    routing_decision: {
      ...processedResultMock.routing_decision,
      justification: "",
      audit_reasons: [],
    },
    notification: {
      generated: false,
    },
  },
];

export async function getDocumentResult(
  documentId: string,
): Promise<ProcessingResponse | null> {
  if (env.useMocks) {
    const workflowResult = getMockWorkflowResult(documentId);
    if (workflowResult) return workflowResult;
    const result = mockResults.find(
      (document) => document.document_id === documentId,
    );

    return result ?? null;
  }

  const endpoint = `/api/v1/documents/${encodeURIComponent(documentId)}`;

  const response = await fetch(`${env.apiBaseUrl}${endpoint}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "DOCUMENT_FETCH_ERROR",
      "No fue posible consultar el resultado del documento.",
    );
  }

  return (await response.json()) as ProcessingResponse;
}
