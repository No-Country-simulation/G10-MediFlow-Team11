import type { ProcessingResponse } from "../types/processing";
import {
  successfulProcessingResponse,
  auditRequiredProcessingResponse,
} from "../mocks/processingMocks";

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
];

export async function getDocumentResult(
  documentId: string,
): Promise<ProcessingResponse | null> {
  const result = mockResults.find(
    (document) => document.document_id === documentId,
  );

  return result ?? null;
}
