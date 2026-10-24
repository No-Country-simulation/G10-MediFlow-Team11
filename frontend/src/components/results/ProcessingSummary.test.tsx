import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  approvedResultMock,
  needsAuditResultMock,
  rejectedResultMock,
} from "../../mocks/resultMocks";
import ProcessingSummary from "./ProcessingSummary";
import ResultStatus from "./ResultStatus";
import ReviewReasonsCard from "./ReviewReasonsCard";

describe("ProcessingSummary", () => {
  it("keeps classification and uses shared confidence bars", () => {
    const result = needsAuditResultMock;
    const markup = renderToStaticMarkup(
      <ProcessingSummary
        classification={result.classification}
        confidence={result.confidence}
        auditReasons={result.routing_decision.audit_reasons}
        status={result.status}
      />,
    );

    expect(markup).toContain("Resumen del procesamiento");
    expect(markup).toContain("Receta médica");
    expect(markup).toContain("Rutinaria");
    expect(markup).toContain("71%");
    expect(markup).toContain("Confianza general");
    expect(markup).toContain("Tipo de documento");
    expect(markup).toContain("Datos leídos");
    expect(markup.match(/Confianza del análisis/g)).toHaveLength(1);
    expect(markup).not.toContain("Triaje inicial");
    expect(markup).toContain(
      "Es una estimación, no una garantía.",
    );
    expect(markup).toContain("Confianza insuficiente");
    expect(markup).toContain('style="width:71%"');
    expect(markup).not.toContain("result-rail");
  });

  it.each([
    [approvedResultMock, "Aprobado"],
    [rejectedResultMock, "Rechazado"],
  ] as const)("keeps historical confidence separate from final state %s", (result, label) => {
    const markup = renderToStaticMarkup(
      <>
        <ResultStatus status={result.status} />
        <ReviewReasonsCard
          reasons={result.routing_decision.audit_reasons}
          requiresHumanReview={result.routing_decision.requires_human_review}
        />
        <ProcessingSummary
          classification={result.classification}
          confidence={result.confidence}
          auditReasons={result.routing_decision.audit_reasons}
          status={result.status}
        />
      </>,
    );

    expect(markup).toContain(label);
    expect(markup).toContain("Confianza insuficiente");
    expect(markup).toContain("Baja confianza del análisis");
    expect(markup).not.toContain("Requiere revisión");
    expect(markup).not.toContain("Este documento ha sido derivado a revisión manual.");
  });
});
