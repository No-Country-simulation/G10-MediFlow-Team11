import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDocumentList } from "../../services/documentListService";
import type { DocumentListItem } from "../../types/documentList";
import { getDocumentTypeLabel, getStatusLabel } from "../../utils/historyLabels";
import {
  buildDocumentHistoryPath,
  filterDocumentsBySearch,
} from "../../utils/historySelection";

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function getInputTypeLabel(inputType: DocumentListItem["inputType"]): string {
  return inputType === "TEXT" ? "Texto" : "Archivo";
}

function formatDocumentDate(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function HistoryDocumentSelector() {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getDocumentList(controller.signal)
      .then((items) => {
        if (!active) {
          return;
        }

        setDocuments(items);
      })
      .catch((caught: unknown) => {
        if (!active || isAbortError(caught)) {
          return;
        }

        setError("No fue posible cargar los documentos.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reloadCount]);

  const filteredDocuments = useMemo(
    () => filterDocumentsBySearch(documents, query),
    [documents, query],
  );

  return (
    <div className="history-page__selector">
      <div className="history-page__search">
        <label className="history-page__search-label" htmlFor={searchId}>
          Buscar documento
        </label>
        <input
          id={searchId}
          type="search"
          className="history-page__search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Identificador o nombre de archivo"
          autoComplete="off"
        />
      </div>

      {loading ? (
        <div className="history-page__loading" role="status" aria-live="polite">
          <span className="history-page__spinner" aria-hidden="true" />
          <p>Cargando documentos...</p>
        </div>
      ) : error ? (
        <div
          className="history-page__state history-page__state--error"
          role="alert"
        >
          <p>{error}</p>
          <button
            type="button"
            className="history-page__retry"
            onClick={() => {
              setLoading(true);
              setError(null);
              setDocuments([]);
              setReloadCount((count) => count + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div
          className="history-page__state history-page__state--info"
          role="status"
        >
          <p>No hay documentos disponibles para consultar su historial.</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div
          className="history-page__state history-page__state--info"
          role="status"
        >
          <p>No se encontraron documentos que coincidan con la búsqueda.</p>
        </div>
      ) : (
        <ul className="history-page__document-list" aria-label="Documentos">
          {filteredDocuments.map((document) => (
            <li key={document.documentId} className="history-page__document-item">
              <div className="history-page__document-card">
                <div className="history-page__document-identity">
                  <span className="history-page__document-id">
                    {document.documentId}
                  </span>
                  {document.fileName ? (
                    <span className="history-page__document-name">
                      {document.fileName}
                    </span>
                  ) : null}
                  <span className="history-page__document-meta">
                    {getInputTypeLabel(document.inputType)}
                    {document.documentType
                      ? ` · ${getDocumentTypeLabel(document.documentType)}`
                      : ""}
                    {" · "}
                    <time dateTime={document.createdAt}>
                      {formatDocumentDate(document.createdAt)}
                    </time>
                  </span>
                </div>
                <span
                  className={`history-page__status ${
                    document.status === "APPROVED" ||
                    document.status === "PROCESSED"
                      ? "history-page__status--success"
                      : document.status === "REJECTED" ||
                          document.status === "FAILED"
                        ? "history-page__status--error"
                        : document.status === "NEEDS_AUDIT"
                          ? "history-page__status--warning"
                          : "history-page__status--default"
                  }`}
                >
                  <span
                    className="history-page__status-dot"
                    aria-hidden="true"
                  />
                  {getStatusLabel(document.status)}
                </span>
                <Link
                  className="history-page__document-action"
                  to={buildDocumentHistoryPath(document.documentId)}
                >
                  Consultar historial
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HistoryDocumentSelector;
