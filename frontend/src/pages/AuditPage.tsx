import {
  AuditQueueEmptyState,
  AuditQueueErrorState,
  AuditQueueLoadingState,
} from "../components/audit/AuditQueueStates";
import AuditQueueCard from "../components/audit/AuditQueueCard";
import { useAuditQueue } from "../hooks/useAuditQueue";
import "../styles/audit-queue.css";

function formatQueueDate(iso: string): string {
  const date = new Date(iso);
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const dateParts = new Intl.DateTimeFormat("es-CO", {
    ...dateOptions,
  }).formatToParts(date);
  const timeParts = new Intl.DateTimeFormat("es-CO", {
    ...timeOptions,
  }).formatToParts(date);
  const partValue = (
    parts: Intl.DateTimeFormatPart[],
    type: Intl.DateTimeFormatPartTypes,
  ): string | undefined => {
    return parts.find((part) => part.type === type)?.value;
  };
  const day = partValue(dateParts, "day");
  const month = partValue(dateParts, "month");
  const year = partValue(dateParts, "year");
  const hour = partValue(timeParts, "hour");
  const minute = partValue(timeParts, "minute");
  const rawDayPeriod = partValue(timeParts, "dayPeriod");

  if (
    day === undefined ||
    month === undefined ||
    year === undefined ||
    hour === undefined ||
    minute === undefined ||
    rawDayPeriod === undefined
  ) {
    return date.toLocaleString("es-CO", { ...dateOptions, ...timeOptions });
  }

  const dayPeriod = rawDayPeriod.replace(/[\u00a0\u202f]/g, " ");

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
}

function AuditPage() {
  const { state, items, reload } = useAuditQueue();

  return (
    <div className="audit-queue">
      <div className="audit-queue__container">
        <header className="audit-queue__header">
          <h1 className="audit-queue__title">Auditoría de documentos</h1>
          <p className="audit-queue__description">
            Revise los documentos derivados a revisión humana por baja confianza,
            ambigüedad, inconsistencias o condiciones técnicas.
          </p>
        </header>

        {state === "loading" ? (
          <AuditQueueLoadingState />
        ) : state === "error" ? (
          <AuditQueueErrorState onRetry={reload} />
        ) : (
          <>
            {items.length > 0 && <div className="audit-queue__count" aria-live="polite">
              <span className="audit-queue__count-dot" aria-hidden="true" />
              <span>
                {items.length}{" "}
                {items.length === 0
                  ? "documentos pendientes"
                  : items.length === 1
                  ? "documento pendiente"
                  : "documentos pendientes"}
              </span>
            </div>}
            {items.length === 0 ? (
              <AuditQueueEmptyState />
            ) : (
              <div className="audit-queue__list" aria-label="Cola de auditoría">
                {items.map((item) => (
                  <AuditQueueCard
                    key={item.document_id}
                    item={item}
                    formatDate={formatQueueDate}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AuditPage;
