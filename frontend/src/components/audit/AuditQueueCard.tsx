import { Link } from "react-router-dom";
import { auditReasonLabel, documentTypeLabel } from "../../config/auditLabels";
import type { AuditQueueItem } from "../../types/audit";

interface AuditQueueCardProps {
  item: AuditQueueItem;
  formatDate: (iso: string) => string;
}

function getAuditReviewPath(documentId: string): string {
  // Ruta acordada con el responsable de #22: /audit/:documentId/review. La registra #22 en AppRoutes.tsx.
  return `/audit/${encodeURIComponent(documentId)}/review`;
}

function FileIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="17" y1="10" x2="3" y2="10" />
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="14" x2="3" y2="14" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function AuditReason({ reason }: { reason: string }) {
  return (
    <span className="audit-queue__reason">
      <span className="audit-queue__reason-dot" aria-hidden="true" />
      <span>{auditReasonLabel(reason)}</span>
    </span>
  );
}

function AuditQueueCard({ item, formatDate }: AuditQueueCardProps) {
  return (
    <Link
      to={getAuditReviewPath(item.document_id)}
      className="audit-queue__card"
      aria-label={`Revisar documento ${item.document_id}`}
    >
      <span className="audit-queue__type-icon">
        {item.input_type === "FILE" ? <FileIcon /> : <TextIcon />}
      </span>

      <span className="audit-queue__card-content">
        <span className="audit-queue__card-top">
          <span className="audit-queue__identity">
            <span className="audit-queue__document-id">
              {item.document_id}
            </span>
            {item.input_type === "TEXT" ? (
              <span className="audit-queue__file-name">Texto</span>
            ) : item.file_name ? (
              <span className="audit-queue__file-name">{item.file_name}</span>
            ) : (
              <span className="audit-queue__file-name">Archivo sin nombre</span>
            )}
          </span>

          <span className="audit-queue__action-group">
            <time className="audit-queue__date" dateTime={item.created_at}>
              {formatDate(item.created_at)}
            </time>
            <span className="audit-queue__action">
              Revisar documento
              <ChevronRight />
            </span>
          </span>
        </span>

        <span className="audit-queue__metadata">
          <span className="audit-queue__document-type">
            {documentTypeLabel(item.document_type)}
          </span>
          {item.audit_reasons.map((reason) => (
            <AuditReason key={reason} reason={reason} />
          ))}
        </span>
      </span>
    </Link>
  );
}

export default AuditQueueCard;
