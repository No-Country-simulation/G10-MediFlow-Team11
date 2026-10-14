import type {
  DocumentStatus,
  PriorityLevel,
  RoutingDestination,
  StorageState,
} from "../types/processing";

const STATUS_LABELS: Record<DocumentStatus, string> = {
  RECEIVED: "Recibido",
  PROCESSING: "Procesando",
  PROCESSED: "Procesado",
  NEEDS_AUDIT: "Requiere revisión",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
};

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  ROUTINE: "Rutinaria",
  URGENT: "Urgente",
};

const DESTINATION_LABELS: Record<RoutingDestination, string> = {
  MEDICAL_EMERGENCY: "Urgencias Médicas",
  PHARMACY: "Farmacia",
  AUTHORIZATION_AUDIT: "Auditoría de Autorización",
  MEDICAL_RECORD: "Expediente Clínico",
  HUMAN_REVIEW: "Revisión Humana",
};

const STORAGE_LABELS: Record<StorageState, string> = {
  SUCCESS: "Guardado correctamente",
  PENDING: "Almacenamiento pendiente",
  ERROR: "Problema de almacenamiento",
};

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  MEDICAL_EMERGENCY: "Urgencia Médica",
};

export function statusLabel(status: DocumentStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function priorityLabel(priority: PriorityLevel): string {
  return PRIORITY_LABELS[priority] ?? priority;
}

export function destinationLabel(destination: RoutingDestination): string {
  return DESTINATION_LABELS[destination] ?? destination;
}

export function storageStateLabel(state: StorageState): string {
  return STORAGE_LABELS[state] ?? state;
}

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}
