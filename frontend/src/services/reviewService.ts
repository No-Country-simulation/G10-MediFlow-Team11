import { env } from "../config/env";
import { ApiError } from "./processingService";
import { applyMockReview } from "../mocks/auditWorkflowStore";
import type {
  DocumentClassification,
  ExtractedData,
  RoutingDestination,
  Validation,
} from "../types/processing";

export type ReviewDecision = "APPROVE" | "REJECT";

export interface ReviewRequest {
  decision: ReviewDecision;
  classification?: Partial<DocumentClassification>;
  extracted_data?: ExtractedData;
  validation?: Validation;
  routing_decision?: { primary_destination: RoutingDestination };
}

export interface ReviewResponse {
  document_id: string;
  status: "APPROVED" | "REJECTED";
  message: string;
}

export async function submitReview(
  documentId: string,
  request: ReviewRequest,
): Promise<ReviewResponse> {
  if (env.useMocks) {
    return applyMockReview(documentId, request);
  }

  const response = await fetch(
    `${env.apiBaseUrl}/api/v1/documents/${encodeURIComponent(documentId)}/review`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
    },
  );

  if (!response.ok) {
    let code = "REVIEW_ERROR";
    let message = "No se pudo registrar la revisión. Inténtelo de nuevo.";
    try {
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "error" in payload) {
        const error = payload.error;
        if (typeof error === "object" && error !== null) {
          if ("code" in error && typeof error.code === "string") code = error.code;
          if ("message" in error && typeof error.message === "string") message = error.message;
        }
      }
    } catch {
      // Keep the fallback for non-JSON error bodies.
    }
    throw new ApiError(response.status, code, message);
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("document_id" in payload) ||
    payload.document_id !== documentId ||
    !("status" in payload) ||
    (payload.status !== "APPROVED" && payload.status !== "REJECTED") ||
    !("message" in payload) ||
    typeof payload.message !== "string"
  ) {
    throw new ApiError(200, "INVALID_RESPONSE", "El Backend devolvió una respuesta de revisión inválida.");
  }
  return payload as ReviewResponse;
}
