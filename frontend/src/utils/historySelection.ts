import type { DocumentListItem } from "../types/documentList";
import type { DocumentStatus } from "../types/processing";

export function buildDocumentHistoryPath(documentId: string): string {
  return `/history?documentId=${encodeURIComponent(documentId)}`;
}

export function filterDocuments(
  documents: DocumentListItem[],
  query: string,
  status: DocumentStatus | "",
): DocumentListItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return documents.filter((document) => {
    if (status && document.status !== status) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const matchesId = document.documentId.toLowerCase().includes(normalizedQuery);
    const matchesFileName =
      document.fileName !== null &&
      document.fileName.toLowerCase().includes(normalizedQuery);

    return matchesId || matchesFileName;
  });
}
