import type { DocumentListApiItem } from "../types/documentList";

export const documentListMocks: DocumentListApiItem[] = [
  {
    document_id: "DOC-2026-0005",
    status: "PROCESSED",
    input_type: "TEXT",
    file_name: null,
    document_type: null,
    created_at: "2026-10-13T08:00:00Z",
    updated_at: "2026-10-13T08:05:00Z",
  },
  {
    document_id: "DOC-2026-0004",
    status: "REJECTED",
    input_type: "FILE",
    file_name: "certificado.jpg",
    document_type: "MEDICAL_CERTIFICATE",
    created_at: "2026-10-12T09:10:00Z",
    updated_at: "2026-10-12T12:30:00Z",
  },
  {
    document_id: "DOC-2026-0003",
    status: "APPROVED",
    input_type: "FILE",
    file_name: "receta.pdf",
    document_type: "PRESCRIPTION",
    created_at: "2026-10-11T08:20:00Z",
    updated_at: "2026-10-11T11:45:00Z",
  },
  {
    document_id: "DOC-2026-0002",
    status: "NEEDS_AUDIT",
    input_type: "FILE",
    file_name: "estudio.png",
    document_type: "STUDY_REPORT",
    created_at: "2026-10-10T10:15:00Z",
    updated_at: "2026-10-10T10:16:00Z",
  },
  {
    document_id: "DOC-2026-0001",
    status: "PROCESSED",
    input_type: "FILE",
    file_name: "informe-radiologia.pdf",
    document_type: "IMAGING_REPORT",
    created_at: "2026-10-10T09:30:00Z",
    updated_at: "2026-10-10T09:31:00Z",
  },
];
