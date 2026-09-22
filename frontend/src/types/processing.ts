export type DocumentStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "NEEDS_AUDIT"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

export type DocumentType =
  | "PRESCRIPTION"
  | "IMAGING_REPORT"
  | "STUDY_REPORT"
  | "PROCEDURE_ORDER"
  | "DISCHARGE_SUMMARY"
  | "MEDICAL_CERTIFICATE";

export type PriorityLevel = "ROUTINE" | "URGENT";

export type RoutingDestination =
  | "MEDICAL_EMERGENCY"
  | "PHARMACY"
  | "AUTHORIZATION_AUDIT"
  | "MEDICAL_RECORD"
  | "HUMAN_REVIEW";

export type AuditReason =
  | "LOW_CONFIDENCE"
  | "ILLEGIBLE_DOCUMENT"
  | "MISSING_CRITICAL_FIELDS"
  | "INCONSISTENT_DATA"
  | "INVALID_AI_RESPONSE"
  | "AI_TIMEOUT"
  | "AI_UNAVAILABLE";

export type StorageState = "PENDING" | "SUCCESS" | "ERROR";

export interface DocumentClassification {
  document_type: DocumentType;
  specialty: string | null;
  priority_level: PriorityLevel;
}

export interface Confidence {
  classification: number;
  extraction: number;
  global: number;
}

export interface PatientData {
  name?: string | null;
  age?: number | null;
}

export interface RequestingDoctor {
  name?: string | null;
  license_number?: string | null;
}

export interface Medication {
  name?: string | null;
  dosage?: string | null;
}

export interface ExtractedData {
  patient?: PatientData | null;
  requesting_doctor?: RequestingDoctor | null;
  primary_diagnosis?: string | null;
  suggested_icd10?: string | null;
  medications?: Medication[];
  [key: string]: unknown;
}

export interface Validation {
  missing_fields: string[];
  inconsistencies: string[];
  warnings: string[];
}

export interface RoutingDecision {
  primary_destination: RoutingDestination;
  requires_human_review: boolean;
  audit_reasons: AuditReason[];
  justification: string;
}

export interface GeneratedNotification {
  generated: true;
  type: string;
  message: string;
}

export interface NoNotification {
  generated: false;
}

export type Notification = GeneratedNotification | NoNotification;

export interface Storage {
  provider: "OCI_OBJECT_STORAGE";
  state: StorageState;
}

export interface ProcessingResponse {
  document_id: string;
  status: DocumentStatus;
  classification: DocumentClassification | null;
  confidence: Confidence | null;
  extracted_data: ExtractedData | null;
  validation: Validation | null;
  routing_decision: RoutingDecision;
  notification: Notification;
  storage: Storage;
}

export interface ProcessTextRequest {
  document_id?: string;
  document_text: string;
  origin_channel: string;
}

export interface ProcessFileRequest {
  file: File;
  origin_channel: string;
  document_id?: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}