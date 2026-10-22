import type { DocumentHistoryResponse } from "../types/history";
import type { ProcessingResponse } from "../types/processing";

export const HISTORY_LOAD_ERROR_MESSAGE =
  "No fue posible cargar el historial del documento.";

export type DocumentHistoryViewCallbacks = {
  onHistory: (history: DocumentHistoryResponse | null) => void;
  onResult: (result: ProcessingResponse | null) => void;
  onHistoryError: (message: string) => void;
  onHistorySettled: () => void;
};

export async function loadDocumentHistoryView(
  documentId: string,
  deps: {
    getHistory: (
      id: string,
      signal?: AbortSignal,
    ) => Promise<DocumentHistoryResponse | null>;
    getResult: (id: string) => Promise<ProcessingResponse | null>;
    signal: AbortSignal;
  },
  callbacks: DocumentHistoryViewCallbacks,
): Promise<void> {
  const historyPromise = deps
    .getHistory(documentId, deps.signal)
    .then((history) => {
      if (deps.signal.aborted) {
        return;
      }

      callbacks.onHistory(history);
    })
    .catch(() => {
      if (deps.signal.aborted) {
        return;
      }

      callbacks.onHistoryError(HISTORY_LOAD_ERROR_MESSAGE);
    })
    .finally(() => {
      if (!deps.signal.aborted) {
        callbacks.onHistorySettled();
      }
    });

  const resultPromise = deps
    .getResult(documentId)
    .then((result) => {
      if (deps.signal.aborted) {
        return;
      }

      callbacks.onResult(result);
    })
    .catch(() => {
      return;
    });

  await Promise.allSettled([historyPromise, resultPromise]);
}
