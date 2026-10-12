import { env } from "../config/env";
import { ApiError } from "./processingService";
import type { ApiErrorResponse } from "../types/processing";
import type { AuditQueueItem } from "../types/audit";

const AUDIT_QUEUE_ENDPOINT = "/api/v1/documents/audit";

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }

  const error = value.error;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
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
}

export async function getAuditQueue(
  signal?: AbortSignal,
): Promise<AuditQueueItem[]> {
  const response = await fetch(`${env.apiBaseUrl}${AUDIT_QUEUE_ENDPOINT}`, {
    method: "GET",
    signal,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      throw new ApiError(
        response.status,
        payload.error.code,
        payload.error.message,
      );
    }

    throw new ApiError(
      response.status,
      "UNKNOWN_ERROR",
      "No fue posible cargar la cola de auditoría.",
    );
  }

  if (!Array.isArray(payload)) {
    throw new ApiError(
      response.status,
      "INVALID_RESPONSE",
      "El servidor devolvió una respuesta inválida.",
    );
  }

  return (payload as AuditQueueItem[]).filter(
    (item) => item.status === "NEEDS_AUDIT",
  );
}
