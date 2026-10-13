import { useCallback, useEffect, useState } from "react";
import { getAuditQueue } from "../services/auditService";
import type { AuditQueueItem } from "../types/audit";

export type AuditQueueState = "loading" | "error" | "ready";

export interface UseAuditQueueResult {
  state: AuditQueueState;
  items: AuditQueueItem[];
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
  const [requestVersion, setRequestVersion] = useState(0);

  const reload = useCallback(() => {
    setState("loading");
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
        setState("ready");
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest || isAbortError(error)) {
          return;
        }

        setItems([]);
        setState("error");
      });

    return () => {
      isCurrentRequest = false;
      controller.abort();
    };
  }, [requestVersion]);

  return { state, items, reload };
}
