import { env } from "../config/env";
import { documentListMocks } from "../mocks/documentListMocks";
import { getMockWorkflowDocuments } from "../mocks/auditWorkflowStore";
import { ApiError } from "./processingService";
import type { DocumentListItem } from "../types/documentList";
import { adaptDocumentList } from "../utils/documentListAdapter";

const DOCUMENT_LIST_ENDPOINT = "/api/v1/documents";

export async function getDocumentList(
  signal?: AbortSignal,
): Promise<DocumentListItem[]> {
  if (env.useMocks) {
    const documents = new Map(
      [...documentListMocks, ...getMockWorkflowDocuments()].map((document) => [
        document.document_id,
        document,
      ]),
    );
    return adaptDocumentList([...documents.values()]).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
        || a.documentId.localeCompare(b.documentId),
    );
  }

  const response = await fetch(`${env.apiBaseUrl}${DOCUMENT_LIST_ENDPOINT}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(
        response.status,
        "INVALID_RESPONSE",
        "El servidor devolvió una respuesta inválida.",
      );
    }

    throw error;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "DOCUMENT_LIST_ERROR",
      "No fue posible cargar los documentos.",
    );
  }

  try {
    return adaptDocumentList(payload);
  } catch {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "El servidor devolvió una respuesta inválida.",
    );
  }
}
