import type { DocumentStatus, DocumentType } from "./processing";

export type DocumentInputType = "FILE" | "TEXT";

export interface DocumentListApiItem {
  document_id: string;
  status: DocumentStatus;
  input_type: DocumentInputType;
  file_name: string | null;
  document_type: DocumentType | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListItem {
  documentId: string;
  status: DocumentStatus;
  inputType: DocumentInputType;
  fileName: string | null;
  documentType: DocumentType | null;
  createdAt: string;
  updatedAt: string;
}
