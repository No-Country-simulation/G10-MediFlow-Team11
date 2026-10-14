import { env } from "../config/env";
import type { DocumentHistoryResponse } from "../types/history";
import { ApiError } from "./processingService";
import { historyMocks } from "../mocks/historyMocks";

export async function getDocumentHistory(
  documentId: string,
  signal?: AbortSignal,
): Promise<DocumentHistoryResponse | null> {
  if (env.useMocks) {
    const history = historyMocks[documentId];

    return history ? structuredClone(history) : null;
  }
  const endpoint = `/api/v1/documents/${encodeURIComponent(documentId)}/history`;

  const response = await fetch(`${env.apiBaseUrl}${endpoint}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "DOCUMENT_HISTORY_ERROR",
      "No fue posible consultar el historial del documento.",
    );
  }

  return (await response.json()) as DocumentHistoryResponse;
}
