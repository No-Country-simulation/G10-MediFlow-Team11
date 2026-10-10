import { env } from "../config/env";
import {
  auditRequiredProcessingResponse,
  successfulProcessingResponse,
} from "../mocks/processingMocks";
import type { ProcessingResponse } from "../types/processing";
import { ApiError } from "./processingService";

const mockResults: ProcessingResponse[] = [
  successfulProcessingResponse,
  auditRequiredProcessingResponse,
  {
    ...auditRequiredProcessingResponse,
    document_id: "DOC-2026-0003",
    status: "APPROVED",
  },
  {
    ...auditRequiredProcessingResponse,
    document_id: "DOC-2026-0004",
    status: "REJECTED",
  },
  {
    ...successfulProcessingResponse,
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
      ...successfulProcessingResponse.routing_decision,
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
