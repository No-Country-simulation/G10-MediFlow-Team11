import { useId } from "react";
import { Link } from "react-router-dom";
import { auditReasonLabel } from "../../config/auditLabels";
import { missingFieldLabel } from "../../config/missingFieldLabels";
import type { AuditReason } from "../../types/processing";

interface ReviewReasonsCardProps {
  reasons: AuditReason[];
  requiresHumanReview: boolean;
  documentId?: string;
  missingFields?: string[];
}

function WarningIcon() {
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
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function ReviewReasonsCard({
  reasons,
  requiresHumanReview,
  documentId,
  missingFields = [],
}: ReviewReasonsCardProps) {
  const titleId = useId();

  if (reasons.length === 0 && !requiresHumanReview) {
    return null;
  }

  return (
    <section
      className="result-card result-card--attention result-card--dense"
      aria-labelledby={titleId}
    >
      <div className="result-card__header result-card__header--icon">
        <WarningIcon />
        <h3 id={titleId} className="result-card__title">
          Motivos de revisión
        </h3>
      </div>

      <div className="result-card__body result-card__body--stack">
        {requiresHumanReview && (
          <p className="result-card__note">
            Este documento ha sido derivado a revisión manual. La información
            disponible puede ser parcial o no verificada.
          </p>
        )}
        {missingFields.length > 0 && <p className="result-card__note">Datos no identificados: {[...new Set(missingFields.filter(Boolean).map(missingFieldLabel))].join(", ")}.</p>}
        {reasons.length === 0 && <p className="result-card__note">Consulte los detalles en Validación.</p>}
        <ul className="result-reason-list">
          {reasons.map((reason) => (
            <li key={reason} className="result-reason-list__item">
              <span className="result-reason-list__dot" aria-hidden="true" />
              <span>{auditReasonLabel(reason)}</span>
            </li>
          ))}
        </ul>
        {requiresHumanReview && documentId && <Link className="result-audit-link" to={`/audit/${encodeURIComponent(documentId)}/review`}>Revisar documento</Link>}
      </div>
    </section>
  );
}

export default ReviewReasonsCard;
