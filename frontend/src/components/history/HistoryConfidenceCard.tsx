import ConfidenceDisplay from "../confidence/ConfidenceDisplay";
import type { Confidence } from "../../types/processing";

interface HistoryConfidenceCardProps {
  snapshot: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function HistoryConfidenceCard({ snapshot }: HistoryConfidenceCardProps) {
  if (!isRecord(snapshot.confidence) || snapshot.status === "APPROVED") {
    return null;
  }

  const confidence: Partial<Confidence> = {
    global: numberOrUndefined(snapshot.confidence.global),
    classification: numberOrUndefined(snapshot.confidence.classification),
    extraction: numberOrUndefined(snapshot.confidence.extraction),
  };
  const routingDecision = isRecord(snapshot.routing_decision)
    ? snapshot.routing_decision
    : null;
  const auditReasons = Array.isArray(routingDecision?.audit_reasons)
    ? routingDecision.audit_reasons.filter(
        (reason): reason is string => typeof reason === "string",
      )
    : [];

  return (
    <section className="history-page__detail-card">
      <div className="history-page__detail-card-content">
        <ConfidenceDisplay
          confidence={confidence}
          auditReasons={auditReasons}
          headingAs="h3"
        />
      </div>
    </section>
  );
}

export default HistoryConfidenceCard;
