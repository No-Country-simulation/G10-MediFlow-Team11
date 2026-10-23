import { useId } from "react";
import { documentTypeLabel } from "../../config/auditLabels";
import { destinationLabel, priorityLabel } from "../../config/resultLabels";
import ConfidenceDisplay from "../confidence/ConfidenceDisplay";
import type {
  AuditReason,
  Confidence,
  DocumentClassification,
  RoutingDestination,
} from "../../types/processing";

interface ProcessingSummaryProps {
  classification: DocumentClassification | null;
  confidence: Confidence | null;
  auditReasons: readonly AuditReason[];
  destination?: RoutingDestination;
}

interface SummaryRowProps {
  label: string;
  value: string;
}

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className="result-summary__row">
      <span className="result-summary__row-label">{label}</span>
      <span className="result-summary__row-value">{value}</span>
    </div>
  );
}

function BoltIcon() {
  return (
    <svg
      aria-hidden="true"
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ProcessingSummary({
  classification,
  confidence,
  auditReasons,
  destination,
}: ProcessingSummaryProps) {
  const titleId = useId();

  if (!classification && !confidence) {
    return null;
  }

  const isUrgent = classification?.priority_level === "URGENT";

  return (
    <section className="result-card result-card--summary" aria-labelledby={titleId}>
      <div className="result-card__header">
        <h3 id={titleId} className="result-card__title">
          Resumen del procesamiento
        </h3>
      </div>

      <div className="result-summary">
        {classification && (
          <div className="result-summary__classification">
            <SummaryRow
              label="Tipo de documento"
              value={documentTypeLabel(classification.document_type)}
            />
            {classification.specialty && (
              <SummaryRow
                label="Especialidad"
                value={classification.specialty}
              />
            )}
            <div className="result-summary__row result-summary__row--center">
              <span className="result-summary__row-label">Prioridad</span>
              <span
                className={`result-priority${isUrgent ? " result-priority--urgent" : ""}`}
              >
                {isUrgent && <BoltIcon />}
                {priorityLabel(classification.priority_level)}
              </span>
            </div>
            {destination && (
              <SummaryRow label="Destino principal" value={destinationLabel(destination)} />
            )}
          </div>
        )}

        {confidence && (
          <div
            className={`result-confidence${classification ? " result-confidence--aside" : ""}`}
          >
            <ConfidenceDisplay
              confidence={confidence}
              auditReasons={auditReasons}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default ProcessingSummary;
