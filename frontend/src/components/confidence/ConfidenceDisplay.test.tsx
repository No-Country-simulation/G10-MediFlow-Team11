import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ConfidenceDisplay from "./ConfidenceDisplay";

describe("ConfidenceDisplay", () => {
  it("converts existing values to percentages and proportional bars in order", () => {
    const markup = renderToStaticMarkup(
      <ConfidenceDisplay
        confidence={{ global: 0.635, classification: 0, extraction: 1 }}
      />,
    );

    expect(markup).toContain("Confianza general");
    expect(markup).toContain("Tipo de documento");
    expect(markup).toContain("Datos leídos");
    expect(markup.indexOf("Confianza general")).toBeLessThan(
      markup.indexOf("Tipo de documento"),
    );
    expect(markup.indexOf("Tipo de documento")).toBeLessThan(
      markup.indexOf("Datos leídos"),
    );
    expect(
      markup.match(/Es una estimación, no una garantía\./g),
    ).toHaveLength(1);
    expect(markup.match(/Confianza del análisis/g)).toHaveLength(1);
    expect(markup).not.toContain("Triaje inicial");
    expect(markup).toContain("64%");
    expect(markup).toContain("0%");
    expect(markup).toContain("100%");
    expect(markup).toContain('style="width:64%"');
    expect(markup).toContain('style="width:0%"');
    expect(markup).toContain('style="width:100%"');
    expect(markup.match(/aria-hidden="true"/g)).toHaveLength(3);
  });

  it("warns only when LOW_CONFIDENCE is recorded, regardless of the numeric value", () => {
    const confidence = { global: 0.92, classification: 0.4, extraction: 0.3 };
    const withReason = renderToStaticMarkup(
      <ConfidenceDisplay
        confidence={confidence}
        auditReasons={["LOW_CONFIDENCE"]}
      />,
    );
    const withoutReason = renderToStaticMarkup(
      <ConfidenceDisplay
        confidence={{ ...confidence, global: 0.2 }}
        auditReasons={[]}
      />,
    );

    expect(withReason).toContain("Confianza insuficiente");
    expect(withReason).toContain(
      'Confianza general</span><span class="confidence-display__warning">Confianza insuficiente</span></div>',
    );
    expect(withReason.indexOf("Confianza insuficiente")).toBeLessThan(
      withReason.indexOf('class="confidence-display__track"'),
    );
    expect(withReason.match(/confidence-display__item--warning/g)).toHaveLength(1);
    expect(withoutReason).not.toContain("Confianza insuficiente");
    expect(withoutReason).not.toContain("confidence-display__item--warning");
  });

  it("renders nothing when confidence is null", () => {
    expect(renderToStaticMarkup(<ConfidenceDisplay confidence={null} />)).toBe(
      "",
    );
  });
});
