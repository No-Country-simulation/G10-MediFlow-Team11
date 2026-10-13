import { env } from "../config/env";
import type { ViewerMimeType } from "../components/DocumentViewer/types";
import { ApiError } from "./processingService";

export type DocumentContent =
  | { kind: "file"; blob: Blob; mimeType: ViewerMimeType }
  | { kind: "text"; text: string };

export const mockDocumentFiles: Record<string, string> = {
  "DOC-2026-0001": "document.pdf",
  "DOC-2026-0002": "document.jpg",
  "DOC-2026-0003": "document.png",
  "DOC-2026-0004": "document.jpg",
};

const supportedMimeTypes: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

function isViewerMimeType(mimeType: string): mimeType is ViewerMimeType {
  return supportedMimeTypes.includes(mimeType);
}

interface TextDocumentPayload {
  document_text?: unknown;
}

function isTextDocumentPayload(value: unknown): value is TextDocumentPayload {
  return typeof value === "object" && value !== null;
}

export async function getDocumentContent(
  documentId: string,
  signal?: AbortSignal,
): Promise<DocumentContent | null> {
  if (env.useMocks) {
    const fileName = mockDocumentFiles[documentId];

    if (!fileName) {
      return null;
    }

    const response = await fetch(
      `${import.meta.env.BASE_URL}mocks/${fileName}`,
      { signal },
    );

    if (!response.ok) {
      throw new ApiError(
        response.status,
        "MOCK_DOCUMENT_ERROR",
        "No fue posible cargar el documento de prueba.",
      );
    }

    const mimeType: ViewerMimeType = fileName.endsWith(".pdf")
      ? "application/pdf"
      : fileName.endsWith(".png")
        ? "image/png"
        : "image/jpeg";

    return {
      kind: "file",
      blob: await response.blob(),
      mimeType,
    };
  }

  const endpoint = `/api/v1/documents/${encodeURIComponent(documentId)}/content`;

  const response = await fetch(`${env.apiBaseUrl}${endpoint}`, {
    method: "GET",
    headers: {
      Accept: "application/pdf, image/jpeg, image/png, application/json",
    },
    signal,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "DOCUMENT_CONTENT_ERROR",
      "No fue posible obtener el contenido del documento.",
    );
  }

  const mimeType = response.headers
    .get("Content-Type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (mimeType === "application/json") {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError(
        415,
        "INVALID_TEXT_DOCUMENT",
        "El contenido del documento de texto no es un JSON válido.",
      );
    }

    if (!isTextDocumentPayload(payload)) {
      throw new ApiError(
        415,
        "INVALID_TEXT_DOCUMENT",
        "El contenido del documento de texto no tiene la estructura esperada.",
      );
    }

    const documentText = payload.document_text;

    if (typeof documentText !== "string") {
      throw new ApiError(
        415,
        "INVALID_TEXT_DOCUMENT",
        "El contenido del documento de texto no incluye el campo document_text.",
      );
    }

    return {
      kind: "text",
      text: documentText,
    };
  }

  if (!mimeType || !isViewerMimeType(mimeType)) {
    throw new ApiError(
      415,
      "UNSUPPORTED_DOCUMENT_TYPE",
      "El formato del documento no es compatible con el visor.",
    );
  }

  const blob = await response.blob();

  return {
    kind: "file",
    blob,
    mimeType,
  };
}
