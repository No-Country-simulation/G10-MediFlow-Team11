import { env } from "../config/env";
import type {
  ApiErrorResponse,
  ProcessFileRequest,
  ProcessTextRequest,
  ProcessingResponse,
} from "../types/processing";

const PROCESS_TEXT_ENDPOINT = "/api/v1/documents/process-text";
const PROCESS_FILE_ENDPOINT = "/api/v1/documents/process-file";

export async function processText(
  request: ProcessTextRequest,
): Promise<ProcessingResponse> {
  const response = await fetch(`${env.apiBaseUrl}${PROCESS_TEXT_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  return response.json() as Promise<ProcessingResponse>;
}

export async function processFile(
  request: ProcessFileRequest,
): Promise<ProcessingResponse> {
  const formData = new FormData();

  formData.append("file", request.file);
  formData.append("origin_channel", request.origin_channel);

  if (request.document_id) {
    formData.append("document_id", request.document_id);
  }

  const response = await fetch(`${env.apiBaseUrl}${PROCESS_FILE_ENDPOINT}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    await handleApiError(response);
  }

  return response.json() as Promise<ProcessingResponse>;
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function handleApiError(response: Response): Promise<never> {
  let errorResponse: ApiErrorResponse;

  try {
    errorResponse = (await response.json()) as ApiErrorResponse;
  } catch {
    throw new ApiError(
      response.status,
      "UNKNOWN_ERROR",
      "An unexpected API error occurred",
    );
  }

  throw new ApiError(
    response.status,
    errorResponse.error.code,
    errorResponse.error.message,
  );
}
