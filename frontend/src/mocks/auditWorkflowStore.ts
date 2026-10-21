import { historyMocks } from "./historyMocks";
import { needsAuditResultMock } from "./resultMocks";
import { ApiError } from "../services/processingService";
import type { ReviewRequest, ReviewResponse } from "../services/reviewService";
import type { AuditQueueItem } from "../types/audit";
import type { DocumentHistoryApiResponse } from "../types/history";
import type { ExtractedData, ProcessingResponse, Validation } from "../types/processing";

// One in-memory lifecycle for the explicitly enabled demo mode. Reloading resets fixtures.
const textDocumentId = "DOC-2026-0006";
const textContent = "REPORTE DE ESTUDIO\nPaciente: Sofía Ramírez\nMédico solicitante: Dr. Luis Vega\nEstudio: Ecografía abdominal\nObservación: El documento requiere validación clínica.";
const textResult: ProcessingResponse = {
  ...structuredClone(needsAuditResultMock),
  document_id: textDocumentId,
  classification: { document_type: "STUDY_REPORT", specialty: "Radiología", priority_level: "ROUTINE" },
  extracted_data: {
    patient: { name: "Sofía Ramírez", age: null },
    requesting_doctor: { name: "Dr. Luis Vega", license_number: null },
    requested_studies: [{ name: "Ecografía abdominal" }],
  },
  validation: {
    missing_fields: ["patient.age", "requesting_doctor.license_number"],
    inconsistencies: [],
    warnings: ["Confirme los datos extraídos del texto original."],
  },
};

const initialQueue: AuditQueueItem[] = [
  {
    document_id: needsAuditResultMock.document_id, status: "NEEDS_AUDIT", input_type: "FILE",
    mime_type: "image/jpeg", file_name: "document.jpg", document_type: "PRESCRIPTION",
    audit_reasons: [...needsAuditResultMock.routing_decision.audit_reasons],
    created_at: "2026-10-10T10:15:00Z", updated_at: "2026-10-10T10:15:00Z",
  },
  {
    document_id: textDocumentId, status: "NEEDS_AUDIT", input_type: "TEXT",
    mime_type: "application/json", file_name: null, document_type: "STUDY_REPORT",
    audit_reasons: [...textResult.routing_decision.audit_reasons],
    created_at: "2026-10-10T11:15:00Z", updated_at: "2026-10-10T11:15:00Z",
  },
];

const results = new Map<string, ProcessingResponse>([
  [needsAuditResultMock.document_id, structuredClone(needsAuditResultMock)],
  [textDocumentId, structuredClone(textResult)],
]);
const uploadedFiles = new Map<string, File>();
let nextFileId = 1;
const histories = new Map<string, DocumentHistoryApiResponse>([
  [needsAuditResultMock.document_id, structuredClone(historyMocks[needsAuditResultMock.document_id])],
  [textDocumentId, {
    document_id: textDocumentId,
    entries: [{ sequence: 1, event_type: "INITIAL_TRIAGE", decision: null,
      occurred_at: "2026-10-10T11:15:00Z", result: structuredClone(textResult) as unknown as Record<string, unknown> }],
  }],
]);

export function getMockAuditQueue(): AuditQueueItem[] {
  return initialQueue.filter((item) => results.get(item.document_id)?.status === "NEEDS_AUDIT")
    .map((item) => structuredClone(item));
}

export function getMockWorkflowResult(documentId: string): ProcessingResponse | null {
  const result = results.get(documentId);
  return result ? structuredClone(result) : null;
}

export function getMockWorkflowHistory(documentId: string): DocumentHistoryApiResponse | null {
  const history = histories.get(documentId);
  return history ? structuredClone(history) : null;
}

export function getMockTextContent(documentId: string): string | null {
  return documentId === textDocumentId ? textContent : null;
}

export function getMockUploadedFile(documentId: string): File | null {
  return uploadedFiles.get(documentId) ?? null;
}

export function registerMockFileReview(file: File): ProcessingResponse {
  const documentId = `DOC-MOCK-${String(nextFileId++).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const result: ProcessingResponse = {
    ...structuredClone(needsAuditResultMock), document_id: documentId,
    classification: null, confidence: null, extracted_data: null,
    validation: { missing_fields: [], inconsistencies: [], warnings: ["Complete y confirme la revisión del archivo de prueba."] },
    routing_decision: {
      primary_destination: "HUMAN_REVIEW", requires_human_review: true,
      audit_reasons: ["LOW_CONFIDENCE"], justification: "Archivo de prueba pendiente de revisión humana.",
    },
  };
  results.set(documentId, result);
  uploadedFiles.set(documentId, file);
  initialQueue.push({ document_id: documentId, status: "NEEDS_AUDIT", input_type: "FILE",
    mime_type: file.type, file_name: file.name || null, document_type: null,
    audit_reasons: ["LOW_CONFIDENCE"], created_at: now, updated_at: now });
  histories.set(documentId, { document_id: documentId, entries: [
    { sequence: 1, event_type: "INITIAL_TRIAGE", decision: null, occurred_at: now,
      result: structuredClone(result) as unknown as Record<string, unknown> },
  ] });
  return structuredClone(result);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeObject<T extends object>(existing: T | null, patch: unknown): T | null {
  if (patch === null) return null;
  if (!isObject(patch)) throw invalidReview();
  const merged: Record<string, unknown> = existing ? structuredClone(existing) as Record<string, unknown> : {};
  for (const [key, value] of Object.entries(patch)) {
    merged[key] = isObject(value) && isObject(merged[key])
      ? mergeObject(merged[key] as Record<string, unknown>, value)
      : structuredClone(value);
  }
  return merged as T;
}

function invalidReview(): ApiError {
  return new ApiError(400, "REVIEW_VALIDATION_FAILED", "La revisión no cumple el contrato requerido.");
}

function validValidation(value: Validation | null): boolean {
  return !!value && Object.keys(value).length === 3
    && (["missing_fields", "inconsistencies", "warnings"] as const).every((key) =>
      Array.isArray(value[key]) && value[key].every((item) => typeof item === "string"));
}

function validExtraction(value: ExtractedData | null): boolean {
  if (!value) return false;
  const patient = value.patient;
  const age = patient && patient.age;
  return (age == null || (Number.isInteger(age) && age >= 0))
    && (!value.medications || (Array.isArray(value.medications) && value.medications.every((item) =>
      isObject(item) && (item.name == null || typeof item.name === "string")
      && (item.dosage == null || typeof item.dosage === "string"))))
    && (!value.requested_studies || (Array.isArray(value.requested_studies) && value.requested_studies.every((item) =>
      isObject(item) && (item.name == null || typeof item.name === "string"))));
}

export function applyMockReview(documentId: string, request: ReviewRequest): ReviewResponse {
  const current = results.get(documentId);
  if (!current) throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Documento no encontrado.");
  if (current.status !== "NEEDS_AUDIT") {
    throw new ApiError(409, "INVALID_REVIEW_STATE", "El documento ya no está pendiente de revisión.");
  }
  if (!request || (request.decision !== "APPROVE" && request.decision !== "REJECT")
    || Object.keys(request).some((key) => !["decision", "classification", "extracted_data", "validation", "routing_decision"].includes(key))
    || (request.routing_decision && Object.keys(request.routing_decision).some((key) => key !== "primary_destination"))
    || (request.classification && Object.keys(request.classification).some((key) => !["document_type", "specialty", "priority_level"].includes(key)))) {
    throw invalidReview();
  }
  const classification = request.classification === undefined ? current.classification
    : mergeObject(current.classification, request.classification);
  const extracted = request.extracted_data === undefined ? current.extracted_data
    : mergeObject(current.extracted_data, request.extracted_data);
  const validation = request.validation === undefined ? current.validation
    : mergeObject(current.validation, request.validation);
  const destination = request.routing_decision?.primary_destination ?? current.routing_decision.primary_destination;
  const contentChanged = JSON.stringify(classification) !== JSON.stringify(current.classification)
    || JSON.stringify(extracted) !== JSON.stringify(current.extracted_data)
    || destination !== current.routing_decision.primary_destination;
  if ((request.validation !== undefined && !validValidation(validation))
    || (extracted && (request.decision === "APPROVE" || request.extracted_data !== undefined) && !validExtraction(extracted))
    || (request.decision === "APPROVE" && (!classification?.document_type || !classification.priority_level
      || !extracted || !validValidation(validation) || destination === "HUMAN_REVIEW"
      || (contentChanged && request.validation === undefined)))) {
    throw invalidReview();
  }
  const status = request.decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const updated: ProcessingResponse = {
    ...structuredClone(current), status, classification, extracted_data: extracted, validation,
    confidence: contentChanged ? null : current.confidence,
    routing_decision: {
      ...current.routing_decision, primary_destination: destination, requires_human_review: false,
      justification: request.decision === "APPROVE"
        ? `Destino ${destination} confirmado por revisión humana`
        : "Documento rechazado en revisión humana; no se ejecuta enrutamiento",
    },
    notification: request.decision === "APPROVE" && classification?.priority_level === "URGENT" && destination === "MEDICAL_EMERGENCY"
      ? { generated: true, type: "MEDICAL_EMERGENCY", message: `ALERTA URGENTE: el documento ${documentId} requiere atención inmediata.` }
      : { generated: false },
  };
  results.set(documentId, updated);
  const history = histories.get(documentId)!;
  history.entries.push({ sequence: history.entries.length + 1, event_type: "HUMAN_REVIEW",
    decision: request.decision, occurred_at: new Date().toISOString(), result: structuredClone(updated) as unknown as Record<string, unknown> });
  return { document_id: documentId, status, message: "Revisión humana registrada correctamente" };
}
