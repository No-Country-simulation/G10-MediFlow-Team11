import { useId } from "react";
import { Check } from "lucide-react";
import type { Validation } from "../../types/processing";
import {
  getValidationSections,
  hasValidationFindings,
} from "./resultPresentation";

interface ValidationCardProps {
  validation: Validation;
}

function ValidationCard({ validation }: ValidationCardProps) {
  const titleId = useId();
  const sections = getValidationSections(validation);

  return (
    <section className="result-card" aria-labelledby={titleId}>
      <div className="result-card__header">
        <h3 id={titleId} className="result-card__title">
          Hallazgos de validación
        </h3>
      </div>

      <div className="result-card__body">
        {!hasValidationFindings(validation) ? (
          <p className="result-validation__clear">
            <Check aria-hidden="true" size={15} strokeWidth={2.5} />
            Sin hallazgos de validación
          </p>
        ) : (
          <div className="result-validation">
            {sections.map((section) => (
              <div key={section.key} className="result-validation__section">
                <div
                  className={`result-validation__heading result-validation__heading--${section.tone}`}
                >
                  <span className="result-validation__dot" aria-hidden="true" />
                  <span>{section.title}</span>
                </div>
                <ul className="result-validation__list">
                  {section.items.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="result-validation__item"
                    >
                      <span
                        className="result-validation__dash"
                        aria-hidden="true"
                      >
                        —
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default ValidationCard;
