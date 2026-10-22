import { describe, expect, it, vi } from "vitest";
import {
  HISTORY_LOAD_ERROR_MESSAGE,
  loadDocumentHistoryView,
} from "./loadDocumentHistoryView";
import type { DocumentHistoryResponse } from "../types/history";
import type { ProcessingResponse } from "../types/processing";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("loadDocumentHistoryView", () => {
  it("shows history even when the secondary result query fails", async () => {
    const onHistory = vi.fn();
    const onResult = vi.fn();
    const onHistoryError = vi.fn();
    const onHistorySettled = vi.fn();
    const history: DocumentHistoryResponse = {
      documentId: "DOC-A",
      entries: [],
    };

    await loadDocumentHistoryView(
      "DOC-A",
      {
        getHistory: async () => history,
        getResult: async () => {
          throw new Error("result failed");
        },
        signal: new AbortController().signal,
      },
      { onHistory, onResult, onHistoryError, onHistorySettled },
    );

    expect(onHistory).toHaveBeenCalledWith(history);
    expect(onResult).not.toHaveBeenCalled();
    expect(onHistoryError).not.toHaveBeenCalled();
    expect(onHistorySettled).toHaveBeenCalled();
  });

  it("distinguishes a missing document from a history error", async () => {
    const onHistory = vi.fn();
    const onHistoryError = vi.fn();

    await loadDocumentHistoryView(
      "missing",
      {
        getHistory: async () => null,
        getResult: async () => null,
        signal: new AbortController().signal,
      },
      {
        onHistory,
        onResult: vi.fn(),
        onHistoryError,
        onHistorySettled: vi.fn(),
      },
    );

    expect(onHistory).toHaveBeenCalledWith(null);
    expect(onHistoryError).not.toHaveBeenCalled();
  });

  it("reports a history error without waiting on the secondary query", async () => {
    const onHistoryError = vi.fn();
    const onHistory = vi.fn();
    const result = deferred<ProcessingResponse | null>();

    const load = loadDocumentHistoryView(
      "DOC-A",
      {
        getHistory: async () => {
          throw new Error("history failed");
        },
        getResult: async () => result.promise,
        signal: new AbortController().signal,
      },
      {
        onHistory,
        onResult: vi.fn(),
        onHistoryError,
        onHistorySettled: vi.fn(),
      },
    );

    await vi.waitFor(() => {
      expect(onHistoryError).toHaveBeenCalledWith(HISTORY_LOAD_ERROR_MESSAGE);
    });
    expect(onHistory).not.toHaveBeenCalled();

    result.resolve(null);
    await load;
  });

  it("ignores a stale response after the selection changes", async () => {
    const firstHistory = deferred<DocumentHistoryResponse | null>();
    const secondHistory: DocumentHistoryResponse = {
      documentId: "DOC-B",
      entries: [{ sequence: 1, eventType: "INITIAL_TRIAGE", decision: null, occurredAt: "2026-10-10T09:30:00Z", result: {} }],
    };
    const firstController = new AbortController();
    const firstCallbacks = {
      onHistory: vi.fn(),
      onResult: vi.fn(),
      onHistoryError: vi.fn(),
      onHistorySettled: vi.fn(),
    };
    const secondCallbacks = {
      onHistory: vi.fn(),
      onResult: vi.fn(),
      onHistoryError: vi.fn(),
      onHistorySettled: vi.fn(),
    };

    const firstLoad = loadDocumentHistoryView(
      "DOC-A",
      {
        getHistory: async () => firstHistory.promise,
        getResult: async () => null,
        signal: firstController.signal,
      },
      firstCallbacks,
    );

    firstController.abort();

    await loadDocumentHistoryView(
      "DOC-B",
      {
        getHistory: async () => secondHistory,
        getResult: async () => null,
        signal: new AbortController().signal,
      },
      secondCallbacks,
    );

    firstHistory.resolve({ documentId: "DOC-A", entries: [] });
    await firstLoad;

    expect(firstCallbacks.onHistory).not.toHaveBeenCalled();
    expect(firstCallbacks.onHistorySettled).not.toHaveBeenCalled();
    expect(secondCallbacks.onHistory).toHaveBeenCalledWith(secondHistory);
  });
});
