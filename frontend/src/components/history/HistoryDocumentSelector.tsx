import { useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getDocumentList } from "../../services/documentListService";
import type { DocumentListItem } from "../../types/documentList";
import type { DocumentStatus } from "../../types/processing";
import { getDocumentTypeLabel, getStatusLabel } from "../../utils/historyLabels";
import { formatDocumentListDate } from "../../utils/formatDocumentListDate";
import {
  buildDocumentHistoryPath,
  filterDocuments,
} from "../../utils/historySelection";

const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: "RECEIVED", label: "Recibidos" },
  { value: "PROCESSING", label: "En procesamiento" },
  { value: "PROCESSED", label: "Procesados" },
  { value: "NEEDS_AUDIT", label: "Requieren revisión" },
  { value: "APPROVED", label: "Aprobados" },
  { value: "REJECTED", label: "Rechazados" },
  { value: "FAILED", label: "Fallidos" },
];

function isDocumentStatus(value: string): value is DocumentStatus {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

function getInputTypeLabel(inputType: DocumentListItem["inputType"]): string {
  return inputType === "TEXT" ? "Texto ingresado" : "Archivo";
}

function HistoryDocumentSelector() {
  const searchId = useId();
  const statusId = useId();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<DocumentStatus | "">("");
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
    () => filterDocuments(documents, query, status),
    [documents, query, status],
  );
  const hasActiveFilters = query.trim() !== "" || status !== "";

  return (
    <div className="history-page__selector">
      <div className="history-page__filters">
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
        <div className="history-page__status-filter">
          <label className="history-page__search-label" htmlFor={statusId}>
            Filtrar por estado
          </label>
          <select
            id={statusId}
            className="history-page__status-select"
            value={status}
            onChange={(event) => {
              const value = event.target.value;
              setStatus(isDocumentStatus(value) ? value : "");
            }}
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!loading && !error && (
        <div className="history-page__filter-summary">
          <p
            className="history-page__filter-count"
            aria-live="polite"
            aria-hidden={filteredDocuments.length === 0}
          >
            Mostrando {filteredDocuments.length} de {documents.length}{" "}
            {documents.length === 1 ? "documento" : "documentos"}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              className="history-page__clear-filters"
              onClick={() => {
                setQuery("");
                setStatus("");
              }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

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
          <p>No se encontraron documentos con los filtros aplicados.</p>
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
                      {formatDocumentListDate(document.createdAt)}
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
                  aria-label={`Consultar historial del documento ${document.documentId}`}
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
