import { useEffect, useId, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getDocumentResult } from "../services/resultService";
import type { ProcessingResponse } from "../types/processing";
import ResultIdentity from "../components/results/ResultIdentity";
import ProcessingSummary from "../components/results/ProcessingSummary";
import ReviewReasonsCard from "../components/results/ReviewReasonsCard";
import ExtractedDataCard from "../components/results/ExtractedDataCard";
import ValidationCard from "../components/results/ValidationCard";
import RoutingCard from "../components/results/RoutingCard";
import NotificationCard from "../components/results/NotificationCard";
import { getDocumentSourceLabels } from "../components/results/resultPresentation";
import DocumentViewer from "../components/DocumentViewer/DocumentViewer";
import type { DocumentViewerState } from "../components/DocumentViewer/types";
import { getDocumentContent } from "../services/documentService";
import "../styles/result-page.css";
import "../styles/result-cards.css";

interface ResultStateMessageProps {
  title: string;
  description?: string;
  onRetry?: () => void;
}

function ResultLoadingState() {
  return (
    <div className="result-state" role="status">
      <span className="result-state__spinner" aria-hidden="true" />
      <p className="result-state__title">Cargando resultado…</p>
    </div>
  );
}

function ResultMessageState({
  title,
  description,
  onRetry,
}: ResultStateMessageProps) {
  return (
    <div
      className={`result-state${onRetry ? " result-state--error" : ""}`}
      role={onRetry ? "alert" : "status"}
    >
      <p className="result-state__title">{title}</p>
      {description && <p className="result-state__description">{description}</p>}
      {onRetry && (
        <button type="button" className="result-state__retry" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

function ResultPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const resultTitleId = useId();
  const documentTitleId = useId();

  const [result, setResult] = useState<ProcessingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [viewerState, setViewerState] = useState<DocumentViewerState>({
    status: "loading",
    documentKey: documentId ?? "",
  });

  useEffect(() => {
    let active = true;

    async function loadResult() {
      setLoading(true);
      setResult(null);
      setError(null);

      try {
        const data = documentId ? await getDocumentResult(documentId) : null;

        if (active) {
          setResult(data);
        }
      } catch (error: unknown) {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : "Ocurrió un error al consultar el documento.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadResult();

    return () => {
      active = false;
    };
  }, [documentId, reloadCount]);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadDocument() {
      try {
        const content = await getDocumentContent(
          documentId!,
          controller.signal,
        );

        if (!active) return;

        if (!content) {
          setViewerState({
            status: "unavailable",
            documentKey: documentId!,
          });
          return;
        }

        if (content.kind === "text") {
          setViewerState({
            status: "text",
            documentKey: documentId!,
            text: content.text,
          });
          return;
        }

        setViewerState({
          status: "ready",
          documentKey: documentId!,
          blob: content.blob,
          mimeType: content.mimeType,
        });
      } catch (error: unknown) {
        if (!active || controller.signal.aborted) return;

        setViewerState({
          status: "error",
          documentKey: documentId!,
          message:
            error instanceof Error
              ? error.message
              : "No fue posible cargar el documento.",
        });
      }
    }

    void loadDocument();

    return () => {
      active = false;
      controller.abort();
    };
  }, [documentId]);

  const currentViewerState: DocumentViewerState | null = result
    ? viewerState.documentKey === result.document_id
      ? viewerState
      : { status: "loading", documentKey: result.document_id }
    : null;
  const isTextSource = currentViewerState?.status === "text";
  const sourceLabels = getDocumentSourceLabels(isTextSource);
  const sourceName = sourceLabels.subtitle ?? "Archivo original";

  return (
    <div className="result-page">
      <div className="result-page__content">
        <header className="result-page__header">
          <h1 className="result-page__title">Resultado del procesamiento</h1>
          <p className="result-page__description">
            Revise la clasificación, los datos extraídos y el destino asignado
            al documento.
          </p>
        </header>

        {loading ? (
          <ResultLoadingState />
        ) : error ? (
          <ResultMessageState
            title="No fue posible cargar el resultado."
            description={error}
            onRetry={() => setReloadCount((count) => count + 1)}
          />
        ) : !result || !currentViewerState ? (
          <ResultMessageState title="No se encontró el documento solicitado." />
        ) : (
          <div className="result-page__grid">
            <div className="result-page__column result-page__column--result">
              <section
                className="result-panel"
                aria-labelledby={resultTitleId}
              >
                <ResultIdentity documentId={result.document_id} status={result.status} storageState={result.storage.state} titleId={resultTitleId} />

                <div className="result-panel__body">
                  <ReviewReasonsCard
                    reasons={result.routing_decision.audit_reasons}
                    requiresHumanReview={
                      result.routing_decision.requires_human_review
                    }
                  />
                  <ProcessingSummary
                    classification={result.classification}
                    confidence={result.confidence}
                    auditReasons={result.routing_decision.audit_reasons}
                    destination={result.routing_decision.primary_destination}
                  />
                  <NotificationCard notification={result.notification} />
                  {result.extracted_data && (
                    <ExtractedDataCard data={result.extracted_data} />
                  )}
                  {result.validation && (
                    <ValidationCard validation={result.validation} />
                  )}
                  <RoutingCard
                    routing={result.routing_decision}
                  />
                  {result.status === "NEEDS_AUDIT" && (
                    <Link className="result-audit-link" to={`/audit/${encodeURIComponent(result.document_id)}/review`}>
                      Revisar documento
                    </Link>
                  )}
                </div>
              </section>
            </div>

            <div className="result-page__column result-page__column--document">
              <section
                className="result-panel"
                aria-labelledby={documentTitleId}
              >
                <div className="result-panel__header result-panel__header--document">
                  <h2
                    id={documentTitleId}
                    className="result-panel__title result-panel__title--document"
                  >
                    {sourceLabels.title}
                  </h2>
                  <span className="result-panel__subtitle">{sourceName}</span>
                </div>

                <div className="result-panel__viewer">
                  <DocumentViewer
                    className="result-page__viewer"
                    ariaLabel={`Vista previa del documento ${result.document_id}`}
                    document={currentViewerState}
                  />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultPage;
