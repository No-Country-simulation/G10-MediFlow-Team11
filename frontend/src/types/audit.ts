import type {
  AuditReason,
  DocumentStatus,
  DocumentType,
} from "./processing";

export type AuditInputType = "FILE" | "TEXT";

export interface AuditQueueItem {
  document_id: string;
  status: DocumentStatus;
  input_type: AuditInputType;
  mime_type: string;
  file_name: string | null;
  document_type: DocumentType | null;
  audit_reasons: AuditReason[];
  created_at: string;
  updated_at: string;
}
