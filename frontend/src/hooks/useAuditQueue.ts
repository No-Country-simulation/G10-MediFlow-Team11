import { useCallback, useEffect, useState } from "react";
import { getAuditQueue } from "../services/auditService";
import type { AuditQueueItem } from "../types/audit";

export type AuditQueueState = "loading" | "error" | "ready";

export interface UseAuditQueueResult {
  state: AuditQueueState;
  items: AuditQueueItem[];
  error: string | null;
  reload: () => void;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export function useAuditQueue(): UseAuditQueueResult {
  const [state, setState] = useState<AuditQueueState>("loading");
  const [items, setItems] = useState<AuditQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const reload = useCallback(() => {
    setState("loading");
    setError(null);
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let isCurrentRequest = true;

    getAuditQueue(controller.signal)
      .then((queue) => {
        if (!isCurrentRequest) {
          return;
        }

        setItems(queue);
        setError(null);
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest || isAbortError(error)) {
          return;
        }

        setItems([]);
        setError(error instanceof Error ? error.message : "No fue posible consultar la cola de auditoría.");
        setState("error");
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [requestVersion]);

  return { state, items, error, reload };
}
