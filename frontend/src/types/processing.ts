export type DocumentStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "PROCESSED"
  | "NEEDS_AUDIT"
  | "APPROVED"
  | "REJECTED"
  | "FAILED";

export type DocumentType =
  | "RECETA"
  | "INFORME_IMAGENES"
  | "INFORME_ESTUDIO"
  | "ORDEN_PROCEDIMIENTO"
  | "EPICRISIS"
  | "CERTIFICADO_MEDICO";

export type PriorityLevel = "RUTINA" | "URGENTE";

export type RoutingDestination =
  | "EMERGENCIA_MEDICA"
  | "FARMACIA"
  | "AUDITORIA_AUTORIZACIONES"
  | "HISTORIA_CLINICA"
  | "REVISION_HUMANA";

export type AuditReason =
  | "LOW_CONFIDENCE"
  | "ILLEGIBLE_DOCUMENT"
  | "MISSING_CRITICAL_FIELDS"
  | "INCONSISTENT_DATA"
  | "INVALID_AI_RESPONSE"
  | "AI_TIMEOUT"
  | "AI_UNAVAILABLE";

export interface DocumentClassification {
  tipo_documento: DocumentType;
  especialidad: string | null;
  nivel_prioridad: PriorityLevel;
}

export interface Confidence {
  clasificacion: number;
  extraccion: number;
  global: number;
}

export interface Confidence {
  clasificacion: number;
  extraccion: number;
  global: number;
}

export interface PatientData {
  nombre?: string | null;
  edad?: number | null;
}

export interface RequestingDoctor {
  nombre?: string | null;
  matricula?: string | null;
}

export interface Medication {
  nombre?: string | null;
  dosis?: string | null;
}

export interface ExtractedData {
  paciente?: PatientData | null;
  medico_solicitante?: RequestingDoctor | null;
  diagnostico_principal?: string | null;
  cie10_sugerido?: string | null;
  medicamentos?: Medication[];
  [key: string]: unknown;
}

export interface Validation {
  requiere_revision_humana: boolean;
  razones: string[];
}

export interface RoutingDecision {
  destino: RoutingDestination;
  requiere_revision_humana: boolean;
}

export interface Notification {
  enviada: boolean;
  canal: string | null;
}

export interface Storage {
  raw_documento: string | null;
  processed_json: string | null;
}

export interface ProcessingResponse {
  documento_id: string;
  status: DocumentStatus;
  clasificacion: DocumentClassification | null;
  confianza: Confidence | null;
  datos_extraidos: ExtractedData | null;
  validacion: Validation | null;
  decision_enrutamiento: RoutingDecision;
  audit_reasons: AuditReason[];
  notificacion: Notification;
  almacenamiento: Storage;
}

export interface ProcessTextRequest {
  texto: string;
  metadata?: Record<string, unknown>;
}