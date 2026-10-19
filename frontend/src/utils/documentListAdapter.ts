import type { DocumentStatus, DocumentType } from "../types/processing";
import type {
  DocumentInputType,
  DocumentListItem,
} from "../types/documentList";

const DOCUMENT_STATUSES = new Set<DocumentStatus>([
  "RECEIVED",
  "PROCESSING",
  "PROCESSED",
  "NEEDS_AUDIT",
  "APPROVED",
  "REJECTED",
  "FAILED",
]);

const DOCUMENT_TYPES = new Set<DocumentType>([
  "PRESCRIPTION",
  "IMAGING_REPORT",
  "STUDY_REPORT",
  "PROCEDURE_ORDER",
  "DISCHARGE_SUMMARY",
  "MEDICAL_CERTIFICATE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStatus(value: unknown): DocumentStatus | null {
  return typeof value === "string" && DOCUMENT_STATUSES.has(value as DocumentStatus)
    ? (value as DocumentStatus)
    : null;
}

function asInputType(value: unknown): DocumentInputType | null {
  return value === "FILE" || value === "TEXT" ? value : null;
}

function asDocumentType(value: unknown): DocumentType | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" && DOCUMENT_TYPES.has(value as DocumentType)
    ? (value as DocumentType)
    : null;
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : null;
}

export function adaptDocumentListItem(value: unknown): DocumentListItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const documentId =
    typeof value.document_id === "string" ? value.document_id.trim() : "";
  const status = asStatus(value.status);
  const inputType = asInputType(value.input_type);
  const createdAt =
    typeof value.created_at === "string" ? value.created_at : "";
  const updatedAt =
    typeof value.updated_at === "string" ? value.updated_at : "";

  if (!documentId || !status || !inputType || !createdAt || !updatedAt) {
    return null;
  }

  return {
    documentId,
    status,
    inputType,
    fileName: asNullableString(value.file_name),
    documentType: asDocumentType(value.document_type),
    createdAt,
    updatedAt,
  };
}

export function adaptDocumentList(payload: unknown): DocumentListItem[] {
  if (!Array.isArray(payload)) {
    throw new Error("INVALID_DOCUMENT_LIST");
  }

  return payload
    .map((item) => adaptDocumentListItem(item))
    .filter((item): item is DocumentListItem => item !== null);
}
