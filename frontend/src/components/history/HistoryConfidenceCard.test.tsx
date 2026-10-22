import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HistoryConfidenceCard from "./HistoryConfidenceCard";
import { approvedResultMock, rejectedResultMock } from "../../mocks/resultMocks";
import { getDocumentHistory } from "../../services/historyService";
import { getDocumentResult } from "../../services/resultService";
import { loadDocumentHistoryView } from "../../utils/loadDocumentHistoryView";
import type { DocumentHistoryResponse } from "../../types/history";
import type { ProcessingResponse } from "../../types/processing";
import ResultStatus from "../results/ResultStatus";
import ReviewReasonsCard from "../results/ReviewReasonsCard";

vi.mock("../../config/env", () => ({
  env: { apiBaseUrl: "http://localhost:8080", useMocks: true },
}));

describe("HistoryConfidenceCard", () => {
  it("keeps DOC-2026-0003 approved while its initial snapshot shows insufficient confidence", async () => {
    const onHistory = vi.fn<(value: DocumentHistoryResponse | null) => void>();
    const onResult = vi.fn<(value: ProcessingResponse | null) => void>();

    await loadDocumentHistoryView(
      "DOC-2026-0003",
      {
        getHistory: getDocumentHistory,
        getResult: getDocumentResult,
        signal: new AbortController().signal,
      },
      {
        onHistory,
        onResult,
        onHistoryError: vi.fn(),
        onHistorySettled: vi.fn(),
      },
    );

    const history = onHistory.mock.calls[0]?.[0];
    const current = onResult.mock.calls[0]?.[0];
    const initial = history?.entries.find(
      (entry) => entry.eventType === "INITIAL_TRIAGE",
    );
    if (!history || !current || !initial) {
      throw new Error("Expected the existing approved document and initial snapshot");
    }

    expect(history.documentId).toBe(current.document_id);
    expect(current.status).toBe("APPROVED");
    expect(current.routing_decision.audit_reasons).toContain("LOW_CONFIDENCE");
    expect(current.routing_decision.requires_human_review).toBe(false);
    expect(initial).toMatchObject({
      sequence: 1,
      eventType: "INITIAL_TRIAGE",
      result: {
        status: "NEEDS_AUDIT",
        confidence: { global: 0.84 },
        routing_decision: {
          audit_reasons: ["LOW_CONFIDENCE"],
          requires_human_review: true,
        },
      },
    });

    const before = structuredClone({ history, current });
    const historicalMarkup = renderToStaticMarkup(
      <HistoryConfidenceCard snapshot={initial.result} />,
    );
    const currentMarkup = renderToStaticMarkup(
      <>
        <ResultStatus status={current.status} />
        <ReviewReasonsCard
          reasons={current.routing_decision.audit_reasons}
          requiresHumanReview={current.routing_decision.requires_human_review}
        />
      </>,
    );

    expect(historicalMarkup).toContain("84%");
    expect(historicalMarkup).toContain("Confianza insuficiente");
    expect(historicalMarkup).not.toContain("Triaje inicial");
    expect(currentMarkup).toContain("Aprobado");
    expect(currentMarkup).not.toContain("Requiere revisión");
    expect(currentMarkup).not.toContain("Este documento ha sido derivado a revisión manual.");
    expect({ history, current }).toEqual(before);
  });

  it("uses each event snapshot instead of the current document result", () => {
    const initialSnapshot = {
      status: "NEEDS_AUDIT",
      confidence: { global: 0.71, classification: 0.82, extraction: 0.65 },
      routing_decision: { audit_reasons: ["LOW_CONFIDENCE"] },
    };
    const laterSnapshot = {
      status: "NEEDS_AUDIT",
      confidence: { global: 0.93, classification: 0.8, extraction: 0.88 },
      routing_decision: { audit_reasons: [] },
    };

    const initialMarkup = renderToStaticMarkup(
      <HistoryConfidenceCard snapshot={initialSnapshot} />,
    );
    const laterMarkup = renderToStaticMarkup(
      <HistoryConfidenceCard snapshot={laterSnapshot} />,
    );

    expect(initialMarkup).toContain("71%");
    expect(initialMarkup).toContain("Confianza insuficiente");
    expect(initialMarkup).not.toContain("Triaje inicial");
    expect(laterMarkup).toContain("93%");
    expect(laterMarkup).not.toContain("Confianza insuficiente");
    expect(laterMarkup).not.toContain("Triaje inicial");
  });

  it("shows rejected snapshot confidence without changing its final state", () => {
    const snapshot = structuredClone(rejectedResultMock);
    const before = structuredClone(snapshot);
    const markup = renderToStaticMarkup(
      <HistoryConfidenceCard snapshot={snapshot} />,
    );

    expect(markup).toContain("Confianza general");
    expect(markup).toContain("Tipo de documento");
    expect(markup).toContain("Datos leídos");
    expect(markup.match(/Confianza del análisis/g)).toHaveLength(1);
    expect(markup).not.toContain("Triaje inicial");
    expect(markup).toContain("Es una estimación, no una garantía.");
    expect(markup).toContain("55%");
    expect(markup).toContain("76%");
    expect(markup).toContain("42%");
    expect(markup).toContain("Confianza insuficiente");
    expect(markup).not.toContain("Requiere revisión");
    expect(snapshot).toEqual(before);
    expect(snapshot.status).toBe("REJECTED");
    expect(snapshot.routing_decision.requires_human_review).toBe(false);
  });

  it("keeps the card hidden for null confidence and approved snapshots with historical LOW_CONFIDENCE", () => {
    expect(
      renderToStaticMarkup(
        <HistoryConfidenceCard
          snapshot={{ status: "NEEDS_AUDIT", confidence: null }}
        />,
      ),
    ).toBe("");
    expect(approvedResultMock.status).toBe("APPROVED");
    expect(approvedResultMock.routing_decision.audit_reasons).toContain("LOW_CONFIDENCE");
    expect(
      renderToStaticMarkup(
        <HistoryConfidenceCard snapshot={approvedResultMock} />,
      ),
    ).toBe("");
  });
});
