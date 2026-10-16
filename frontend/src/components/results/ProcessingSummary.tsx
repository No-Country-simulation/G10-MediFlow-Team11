import { useId, type CSSProperties } from "react";
import { documentTypeLabel } from "../../config/auditLabels";
import { priorityLabel } from "../../config/resultLabels";
import type {
  Confidence,
  DocumentClassification,
} from "../../types/processing";
import { clampPercent, toPercent } from "./resultPresentation";

interface ProcessingSummaryProps {
  classification: DocumentClassification | null;
  confidence: Confidence | null;
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

function ConfidenceRail({ percent }: { percent: number }) {
  const style = {
    "--result-rail-value": `${clampPercent(percent)}%`,
  } as CSSProperties;

  return (
    <div className="result-rail" style={style} aria-hidden="true">
      <span className="result-rail__line" />
      <span className="result-rail__tick result-rail__tick--25" />
      <span className="result-rail__tick result-rail__tick--50" />
      <span className="result-rail__tick result-rail__tick--75" />
      <span className="result-rail__stem" />
      <span className="result-rail__marker" />
    </div>
  );
}

function SecondaryConfidence({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const percent = toPercent(value);

  return (
    <div className="result-confidence__item">
      <div className="result-confidence__row">
        <span className="result-confidence__label">{label}</span>
        <span className="result-confidence__value">{percent}%</span>
      </div>
      <ConfidenceRail percent={percent} />
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
}: ProcessingSummaryProps) {
  const titleId = useId();

  if (!classification && !confidence) {
    return null;
  }

  const isUrgent = classification?.priority_level === "URGENT";
  const globalPercent = confidence ? toPercent(confidence.global) : 0;

  return (
    <section className="result-card" aria-labelledby={titleId}>
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
          </div>
        )}

        {confidence && (
          <div
            className={`result-confidence${classification ? " result-confidence--aside" : ""}`}
          >
            <div className="result-confidence__item">
              <div className="result-confidence__row result-confidence__row--global">
                <span className="result-confidence__label">
                  Confianza global
                </span>
                <span className="result-confidence__global">
                  {globalPercent}%
                </span>
              </div>
              <ConfidenceRail percent={globalPercent} />
            </div>

            <SecondaryConfidence
              label="Confianza de clasificación"
              value={confidence.classification}
            />
            <SecondaryConfidence
              label="Confianza de extracción"
              value={confidence.extraction}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default ProcessingSummary;
