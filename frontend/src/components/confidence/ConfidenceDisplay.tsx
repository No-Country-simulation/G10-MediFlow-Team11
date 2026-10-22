import type { Confidence } from "../../types/processing";
import { clampPercent, toPercent } from "../results/resultPresentation";
import "../../styles/confidence-display.css";

interface ConfidenceDisplayProps {
  confidence: Partial<Confidence> | null;
  auditReasons?: readonly string[];
  headingAs?: "h3" | "h4";
}

const confidenceItems = [
  { key: "global", label: "Confianza general" },
  { key: "classification", label: "Tipo de documento" },
  { key: "extraction", label: "Datos leídos" },
] as const;

function ConfidenceDisplay({
  confidence,
  auditReasons = [],
  headingAs: Heading = "h4",
}: ConfidenceDisplayProps) {
  if (!confidence) return null;

  const lowConfidence = auditReasons.includes("LOW_CONFIDENCE");

  return (
    <div className="confidence-display">
      <div className="confidence-display__header">
        <Heading className="confidence-display__title">
          Confianza del análisis
        </Heading>
      </div>
      {confidenceItems.map(({ key, label }) => {
        const value = confidence[key];
        if (typeof value !== "number") return null;

        const percent = clampPercent(toPercent(value));
        const isLowGlobal = key === "global" && lowConfidence;

        return (
          <div
            key={key}
            className={`confidence-display__item${key === "global" ? " confidence-display__item--global" : ""}${isLowGlobal ? " confidence-display__item--warning" : ""}`}
          >
            <div className="confidence-display__row">
              <div className="confidence-display__label-group">
                <span className="confidence-display__label">{label}</span>
                {isLowGlobal && (
                  <span className="confidence-display__warning">
                    Confianza insuficiente
                  </span>
                )}
              </div>
              <span className="confidence-display__value">{percent}%</span>
            </div>
            <div className="confidence-display__track" aria-hidden="true">
              <span
                className="confidence-display__fill"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="confidence-display__note">Es una estimación, no una garantía.</p>
    </div>
  );
}

export default ConfidenceDisplay;
