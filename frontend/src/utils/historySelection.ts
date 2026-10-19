import type { DocumentListItem } from "../types/documentList";

export function buildDocumentHistoryPath(documentId: string): string {
  return `/history?documentId=${encodeURIComponent(documentId)}`;
}

export function filterDocumentsBySearch(
  documents: DocumentListItem[],
  query: string,
): DocumentListItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return documents;
  }

  return documents.filter((document) => {
    const matchesId = document.documentId.toLowerCase().includes(normalizedQuery);
    const matchesFileName =
      document.fileName !== null &&
      document.fileName.toLowerCase().includes(normalizedQuery);

    return matchesId || matchesFileName;
  });
}
