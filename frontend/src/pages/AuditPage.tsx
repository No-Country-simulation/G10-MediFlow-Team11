import { formatDocumentListDate } from "../utils/formatDocumentListDate";
import {
  AuditQueueEmptyState,
  AuditQueueErrorState,
  AuditQueueLoadingState,
} from "../components/audit/AuditQueueStates";
import AuditQueueCard from "../components/audit/AuditQueueCard";
import { useAuditQueue } from "../hooks/useAuditQueue";
import "../styles/audit-queue.css";

function AuditPage() {
  const { state, items, error, reload } = useAuditQueue();

  return (
    <div className="audit-queue">
      <div className="audit-queue__container">
        <header className="audit-queue__header">
          <h1 className="audit-queue__title">Auditoría de documentos</h1>
          <p className="audit-queue__description">
            Revise los documentos pendientes, compárelos con el original y registre una decisión.
          </p>
        </header>

        {state === "loading" ? (
          <AuditQueueLoadingState />
        ) : state === "error" ? (
          <AuditQueueErrorState onRetry={reload} description={error} />
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
                    formatDate={formatDocumentListDate}
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
