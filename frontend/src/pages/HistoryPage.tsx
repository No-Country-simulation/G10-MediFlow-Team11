import { useEffect, useState } from "react";
import { getDocumentHistory } from "../services/historyService";
import type { DocumentHistoryResponse } from "../types/history";
import {
  ArrowLeft,
  ChevronDown,
  CircleCheck,
  CircleAlert,
  Clock3,
} from "lucide-react";
import { useSearchParams, Link } from "react-router-dom";
import { getDocumentResult } from "../services/resultService";
import type { ProcessingResponse } from "../types/processing";
import {
  getDocumentTypeLabel,
  getPriorityLabel,
  getRoutingDestinationLabel,
  getAuditReasonLabel,
  getMissingFieldLabel,
  getStatusLabel,
} from "../utils/historyLabels";
import "../styles/history-page.css";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function HistoryPage() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("documentId");
  const [history, setHistory] = useState<DocumentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "json">("summary");
  const [currentResult, setCurrentResult] = useState<ProcessingResponse | null>(
    null,
  );

  useEffect(() => {
    if (!documentId) {
      return;
    }

    const controller = new AbortController();

    async function loadHistory() {
      setLoading(true);
      setError(null);
      setHistory(null);
      setCurrentResult(null);

      try {
        const [historyResult, documentResult] = await Promise.allSettled([
          getDocumentHistory(documentId!, controller.signal),
          getDocumentResult(documentId!),
        ]);

        if (!controller.signal.aborted) {
          if (historyResult.status === "fulfilled") {
            setHistory(historyResult.value);

            if (documentResult.status === "fulfilled") {
              setCurrentResult(documentResult.value);
            }
          } else {
            setError("No fue posible cargar el historial del documento.");
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("No fue posible cargar el historial del documento.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => controller.abort();
  }, [documentId]);

  const sortedEntries = [...(history?.entries ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  );

  const [selectedEvent, setSelectedEvent] = useState<{
    documentId: string;
    sequence: number;
  } | null>(null);

  const latestSequence = sortedEntries.at(-1)?.sequence ?? null;

  const expandedSequence =
    selectedEvent?.documentId === documentId
      ? selectedEvent.sequence
      : latestSequence;

  return (
    <div className="history-page">
      <div className="history-page__content">
        <header className="history-page__header">
          <h1 className="history-page__title">Historial de documentos</h1>
          <p className="history-page__description">
            Consulte los estados registrados durante el procesamiento y las
            revisiones realizadas sobre este documento.
          </p>
        </header>
        <section
          className="history-page__body"
          aria-label="Historial del documento"
        >
          {!documentId ? (
            <div
              className="history-page__state history-page__state--warning"
              role="status"
            >
              <p>No se especificó un documento para consultar su historial.</p>
            </div>
          ) : loading ? (
            <div
              className="history-page__loading"
              role="status"
              aria-live="polite"
            >
              <span className="history-page__spinner" aria-hidden="true" />
              <p>Cargando historial del documento...</p>
            </div>
          ) : error ? (
            <div
              className="history-page__state history-page__state--error"
              role="alert"
            >
              <p>{error}</p>
            </div>
          ) : !history ? (
            <div
              className="history-page__state history-page__state--info"
              role="status"
            >
              <p>No se encontró el historial del documento {documentId}.</p>
            </div>
          ) : history.entries.length === 0 ? (
            <div
              className="history-page__state history-page__state--info"
              role="status"
            >
              <p>
                El documento {documentId} todavía no tiene eventos registrados.
              </p>
            </div>
          ) : (
            <div className="history-page__records">
              <section
                className="history-page__summary"
                aria-label="Información general del documento"
              >
                <div className="history-page__summary-card">
                  <div className="history-page__summary-item">
                    <span className="history-page__summary-label">
                      Documento
                    </span>
                    <span className="history-page__summary-value">
                      {history.documentId}
                    </span>
                  </div>
                  {currentResult && (
                    <div className="history-page__summary-item">
                      <span className="history-page__summary-label">
                        Estado actual
                      </span>
                      <div className="history-page__summary-value">
                        <span
                          className={`history-page__status ${
                            currentResult.status === "APPROVED"
                              ? "history-page__status--success"
                              : currentResult.status === "REJECTED"
                                ? "history-page__status--error"
                                : currentResult.status === "NEEDS_AUDIT"
                                  ? "history-page__status--warning"
                                  : "history-page__status--default"
                          }`}
                        >
                          <span
                            className="history-page__status-dot"
                            aria-hidden="true"
                          />
                          {getStatusLabel(currentResult.status)}
                        </span>
                      </div>
                    </div>
                  )}

                  {sortedEntries.length > 0 && (
                    <div className="history-page__summary-item">
                      <span className="history-page__summary-label">
                        Último evento
                      </span>

                      <time
                        className="history-page__summary-value"
                        dateTime={
                          sortedEntries[sortedEntries.length - 1].occurredAt
                        }
                      >
                        {new Date(
                          sortedEntries[sortedEntries.length - 1].occurredAt,
                        ).toLocaleString("es-MX")}
                      </time>
                    </div>
                  )}
                  {documentId && (
                    <div className="history-page__summary-item">
                      <Link
                        to={`/results/${encodeURIComponent(documentId)}`}
                        className="history-page__back-link"
                      >
                        <ArrowLeft size={16} aria-hidden="true" />
                        <span>Volver al resultado</span>
                      </Link>
                    </div>
                  )}
                </div>
              </section>
              <div
                className={`history-page__timeline ${
                  sortedEntries.length > 1
                    ? "history-page__timeline--multiple"
                    : ""
                }`}
              >
                {sortedEntries.map((entry) => {
                  const classification = isRecord(entry.result.classification)
                    ? entry.result.classification
                    : null;

                  const confidence = isRecord(entry.result.confidence)
                    ? entry.result.confidence
                    : null;

                  const extractedData = isRecord(entry.result.extracted_data)
                    ? entry.result.extracted_data
                    : null;

                  const patient = isRecord(extractedData?.patient)
                    ? extractedData.patient
                    : null;

                  const requestingDoctor = isRecord(
                    extractedData?.requesting_doctor,
                  )
                    ? extractedData.requesting_doctor
                    : null;

                  const medications = Array.isArray(extractedData?.medications)
                    ? extractedData.medications.filter(isRecord)
                    : [];

                  const requestedStudies = Array.isArray(
                    extractedData?.requested_studies,
                  )
                    ? extractedData.requested_studies.filter(isRecord)
                    : [];

                  const validation = isRecord(entry.result.validation)
                    ? entry.result.validation
                    : null;

                  const missingFields =
                    validation && Array.isArray(validation.missing_fields)
                      ? validation.missing_fields.filter(
                          (value): value is string => typeof value === "string",
                        )
                      : [];

                  const inconsistencies =
                    validation && Array.isArray(validation.inconsistencies)
                      ? validation.inconsistencies.filter(
                          (value): value is string => typeof value === "string",
                        )
                      : [];

                  const warnings =
                    validation && Array.isArray(validation.warnings)
                      ? validation.warnings.filter(
                          (value): value is string => typeof value === "string",
                        )
                      : [];

                  const routingDecision = isRecord(
                    entry.result.routing_decision,
                  )
                    ? entry.result.routing_decision
                    : null;

                  const auditReasons =
                    routingDecision &&
                    Array.isArray(routingDecision.audit_reasons)
                      ? routingDecision.audit_reasons.filter(
                          (value): value is string => typeof value === "string",
                        )
                      : [];

                  const storage = isRecord(entry.result.storage)
                    ? entry.result.storage
                    : null;

                  return (
                    <div
                      key={entry.sequence}
                      className={`history-page__timeline-event ${
                        sortedEntries.length > 1
                          ? entry.eventType === "INITIAL_TRIAGE"
                            ? "history-page__timeline-event--initial"
                            : "history-page__timeline-event--success"
                          : ""
                      }`}
                    >
                      <div
                        id={`history-event-${entry.sequence}`}
                        className="history-page__event-card"
                        data-expanded={expandedSequence === entry.sequence}
                      >
                        <button
                          type="button"
                          className="history-page__event-toggle"
                          aria-expanded={expandedSequence === entry.sequence}
                          aria-controls={`history-event-panel-${entry.sequence}`}
                          onClick={() => {
                            setSelectedEvent({
                              documentId: documentId!,
                              sequence:
                                expandedSequence === entry.sequence
                                  ? -1
                                  : entry.sequence,
                            });
                          }}
                        >
                          <div className="history-page__event-info">
                            <div className="history-page__event-header">
                              <div className="history-page__event-meta">
                                <span className="history-page__event-title">
                                  {entry.eventType === "INITIAL_TRIAGE"
                                    ? "Triaje inicial"
                                    : "Revisión humana"}
                                </span>

                                <span className="history-page__event-date">
                                  Evento {entry.sequence} ·{" "}
                                  <time dateTime={entry.occurredAt}>
                                    {new Date(entry.occurredAt).toLocaleString(
                                      "es-MX",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                      },
                                    )}
                                  </time>
                                </span>
                              </div>
                            </div>
                          </div>

                          {entry.eventType === "INITIAL_TRIAGE" &&
                            typeof entry.result.status === "string" && (
                              <span
                                className={`history-page__status ${
                                  entry.result.status === "NEEDS_AUDIT"
                                    ? "history-page__status--warning"
                                    : entry.result.status === "FAILED" ||
                                        entry.result.status === "REJECTED"
                                      ? "history-page__status--error"
                                      : "history-page__status--success"
                                }`}
                              >
                                <span
                                  className="history-page__status-dot"
                                  aria-hidden="true"
                                />

                                {entry.result.status === "NEEDS_AUDIT"
                                  ? "Requiere revisión"
                                  : getStatusLabel(entry.result.status)}
                              </span>
                            )}

                          {entry.eventType === "HUMAN_REVIEW" &&
                            entry.decision && (
                              <span
                                className={`history-page__status ${
                                  entry.decision === "APPROVE"
                                    ? "history-page__status--success"
                                    : "history-page__status--error"
                                }`}
                              >
                                <span
                                  className="history-page__status-dot"
                                  aria-hidden="true"
                                />

                                {entry.decision === "APPROVE"
                                  ? "Aprobado"
                                  : "Rechazado"}
                              </span>
                            )}
                          <span className="history-page__event-action">
                            {expandedSequence === entry.sequence
                              ? "Ocultar detalle"
                              : "Mostrar detalle"}
                          </span>
                          <ChevronDown
                            className="history-page__event-chevron"
                            size={18}
                            aria-hidden="true"
                          />
                        </button>

                        <div
                          id={`history-event-panel-${entry.sequence}`}
                          className="history-page__event-details"
                          role="region"
                          aria-label={`Detalles del evento ${entry.sequence}`}
                          hidden={expandedSequence !== entry.sequence}
                        >
                          <div
                            className="history-page__tabs"
                            aria-label="Vista de detalles del evento"
                          >
                            <button
                              type="button"
                              className={`history-page__tab ${
                                activeTab === "summary"
                                  ? "history-page__tab--active"
                                  : ""
                              }`}
                              onClick={() => setActiveTab("summary")}
                            >
                              Resumen
                            </button>

                            <button
                              type="button"
                              className={`history-page__tab ${
                                activeTab === "json"
                                  ? "history-page__tab--active"
                                  : ""
                              }`}
                              onClick={() => setActiveTab("json")}
                            >
                              JSON
                            </button>
                          </div>

                          {activeTab === "summary" ? (
                            <div className="history-page__details-grid">
                              {classification && (
                                <section
                                  className={`history-page__detail-card ${
                                    entry.result.status === "APPROVED" ||
                                    !confidence
                                      ? "history-page__detail-card--full"
                                      : ""
                                  }`}
                                >
                                  <h3 className="history-page__detail-card-title">
                                    Clasificación
                                  </h3>
                                  <div className="history-page__detail-card-content">
                                    {[
                                      {
                                        label: "Tipo de documento",
                                        value: getDocumentTypeLabel(
                                          classification.document_type,
                                        ),
                                      },
                                      {
                                        label: "Especialidad",
                                        value:
                                          typeof classification.specialty ===
                                          "string"
                                            ? classification.specialty
                                            : null,
                                      },
                                      {
                                        label: "Prioridad",
                                        value:
                                          typeof classification.priority_level ===
                                          "string"
                                            ? getPriorityLabel(
                                                classification.priority_level,
                                              )
                                            : null,
                                      },
                                    ]
                                      .filter((item) => item.value !== null)
                                      .map((item) => (
                                        <div
                                          key={item.label}
                                          className="history-page__detail-row"
                                        >
                                          <span className="history-page__detail-label">
                                            {item.label}
                                          </span>

                                          <span className="history-page__detail-value">
                                            {item.value}
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                </section>
                              )}

                              {confidence &&
                                entry.result.status !== "APPROVED" && (
                                  <section className="history-page__detail-card">
                                    <h3 className="history-page__detail-card-title">
                                      Confianza
                                    </h3>
                                    <div className="history-page__detail-card-content">
                                      {[
                                        {
                                          label: "Global",
                                          value: confidence.global,
                                        },
                                        {
                                          label: "Clasificación",
                                          value: confidence.classification,
                                        },
                                        {
                                          label: "Extracción",
                                          value: confidence.extraction,
                                        },
                                      ].map(
                                        (item) =>
                                          typeof item.value === "number" && (
                                            <div
                                              key={item.label}
                                              className="history-page__detail-row"
                                            >
                                              <span className="history-page__detail-label">
                                                {item.label}
                                              </span>

                                              <span className="history-page__detail-value">
                                                {(item.value * 100).toFixed(0)}%
                                              </span>
                                            </div>
                                          ),
                                      )}
                                    </div>
                                  </section>
                                )}

                              {extractedData &&
                                (patient ||
                                  requestingDoctor ||
                                  typeof extractedData.primary_diagnosis ===
                                    "string" ||
                                  typeof extractedData.suggested_icd10 ===
                                    "string" ||
                                  medications.length > 0 ||
                                  requestedStudies.length > 0) && (
                                  <section className="history-page__detail-card history-page__detail-card--full">
                                    <h3 className="history-page__detail-card-title">
                                      Datos clínicos extraídos
                                    </h3>
                                    <div className="history-page__detail-card-body">
                                      {patient && (
                                        <div className="history-page__patient-details">
                                          {[
                                            {
                                              label: "Paciente",
                                              value:
                                                typeof patient.name === "string"
                                                  ? patient.name
                                                  : null,
                                            },
                                            {
                                              label: "Edad",
                                              value:
                                                typeof patient.age === "number"
                                                  ? `${patient.age} años`
                                                  : null,
                                            },
                                          ]
                                            .filter(
                                              (item) => item.value !== null,
                                            )
                                            .map((item) => (
                                              <div
                                                key={item.label}
                                                className="history-page__detail-row history-page__detail-row--patient"
                                              >
                                                <span className="history-page__detail-label">
                                                  {item.label}
                                                </span>

                                                <span className="history-page__detail-value">
                                                  {item.value}
                                                </span>
                                              </div>
                                            ))}
                                        </div>
                                      )}

                                      {requestingDoctor && (
                                        <div className="history-page__patient-details">
                                          {[
                                            {
                                              label: "Médico",
                                              value:
                                                typeof requestingDoctor.name ===
                                                "string"
                                                  ? requestingDoctor.name
                                                  : null,
                                            },
                                            {
                                              label: "N.º de colegiado / matrícula profesional",
                                              value:
                                                typeof requestingDoctor.license_number ===
                                                "string"
                                                  ? requestingDoctor.license_number
                                                  : null,
                                            },
                                          ]
                                            .filter(
                                              (item) => item.value !== null,
                                            )
                                            .map((item) => (
                                              <div
                                                key={item.label}
                                                className="history-page__detail-row history-page__detail-row--patient"
                                              >
                                                <span className="history-page__detail-label">
                                                  {item.label}
                                                </span>

                                                <span className="history-page__detail-value">
                                                  {item.value}
                                                </span>
                                              </div>
                                            ))}
                                        </div>
                                      )}

                                      {[
                                        {
                                          label: "Diagnóstico principal",
                                          value:
                                            typeof extractedData.primary_diagnosis ===
                                            "string"
                                              ? extractedData.primary_diagnosis
                                              : null,
                                        },
                                        {
                                          label: "Código CIE-10",
                                          value:
                                            typeof extractedData.suggested_icd10 ===
                                            "string"
                                              ? extractedData.suggested_icd10
                                              : null,
                                        },
                                      ]
                                        .filter((item) => item.value !== null)
                                        .map((item) => (
                                          <div className="history-page__patient-details">
                                            <div
                                              key={item.label}
                                              className="history-page__detail-row history-page__detail-row--patient"
                                            >
                                              <span className="history-page__detail-label">
                                                {item.label}
                                              </span>

                                              <span className="history-page__detail-value">
                                                {item.value}
                                              </span>
                                            </div>
                                          </div>
                                        ))}

                                      {medications.length > 0 && (
                                        <div className="history-page__detail-row history-page__detail-row--patient history-page__medications">
                                          <span className="history-page__detail-label">
                                            Medicamentos
                                          </span>

                                          <ul className="history-page__medication-list">
                                            {medications.map(
                                              (medication, index) => {
                                                const name =
                                                  typeof medication.name ===
                                                  "string"
                                                    ? medication.name
                                                    : null;

                                                const dosage =
                                                  typeof medication.dosage ===
                                                  "string"
                                                    ? medication.dosage
                                                    : null;

                                                if (!name && !dosage)
                                                  return null;

                                                return (
                                                  <li
                                                    key={index}
                                                    className="history-page__medication-item"
                                                  >
                                                    {[name, dosage]
                                                      .filter(Boolean)
                                                      .join(" ")}
                                                  </li>
                                                );
                                              },
                                            )}
                                          </ul>
                                        </div>
                                      )}

                                      {requestedStudies.length > 0 && (
                                        <div className="history-page__detail-row history-page__detail-row--patient history-page__medications">
                                          <span className="history-page__detail-label">
                                            Estudios solicitados
                                          </span>

                                          <ul className="history-page__medication-list">
                                            {requestedStudies.map(
                                              (study, index) => {
                                                if (
                                                  typeof study.name !==
                                                    "string" ||
                                                  !study.name.trim()
                                                ) {
                                                  return null;
                                                }

                                                return (
                                                  <li
                                                    key={index}
                                                    className="history-page__medication-item"
                                                  >
                                                    {study.name}
                                                  </li>
                                                );
                                              },
                                            )}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  </section>
                                )}

                              <section className="history-page__detail-card history-page__detail-card--start">
                                <h3 className="history-page__detail-card-title">
                                  Validación
                                </h3>
                                {entry.result.status === "APPROVED" ||
                                (missingFields.length === 0 &&
                                  inconsistencies.length === 0 &&
                                  warnings.length === 0) ? (
                                  <div className="history-page__validation-content">
                                    <CircleCheck
                                      className="history-page__validation-icon"
                                      size={18}
                                      aria-hidden="true"
                                    />

                                    <span className="history-page__validation-success">
                                      Sin hallazgos de validación
                                    </span>
                                  </div>
                                ) : (
                                  <div className="history-page__detail-card-body">
                                    {[
                                      {
                                        title: "Campos faltantes",
                                        items: missingFields,
                                      },
                                      {
                                        title: "Inconsistencias",
                                        items: inconsistencies,
                                      },
                                      {
                                        title: "Advertencias",
                                        items: warnings,
                                      },
                                    ].map(
                                      ({ title, items }) =>
                                        items.length > 0 && (
                                          <div
                                            key={title}
                                            className="history-page__detail-row history-page__detail-row--patient"
                                          >
                                            <span className="history-page__detail-label">
                                              {title}
                                            </span>

                                            <div className="history-page__validation-values">
                                              <span className="history-page__detail-value">
                                                {items
                                                  .map((item) =>
                                                    title === "Campos faltantes"
                                                      ? getMissingFieldLabel(
                                                          item,
                                                        )
                                                      : item,
                                                  )
                                                  .join(", ")}
                                              </span>
                                            </div>
                                          </div>
                                        ),
                                    )}
                                  </div>
                                )}
                              </section>

                              {routingDecision && (
                                <section className="history-page__detail-card">
                                  <h3 className="history-page__detail-card-title">
                                    Enrutamiento
                                  </h3>
                                  <div className="history-page__detail-card-content">
                                    {[
                                      {
                                        label: "Destino",
                                        value:
                                          typeof routingDecision.primary_destination ===
                                          "string"
                                            ? getRoutingDestinationLabel(
                                                routingDecision.primary_destination,
                                              )
                                            : null,
                                      },
                                      {
                                        label: "Revisión pendiente",
                                        value:
                                          typeof routingDecision.requires_human_review ===
                                          "boolean"
                                            ? routingDecision.requires_human_review
                                              ? "Requerida"
                                              : "No requerida"
                                            : null,
                                      },
                                    ]
                                      .filter((item) => item.value !== null)
                                      .map((item) => (
                                        <div
                                          key={item.label}
                                          className="history-page__detail-row history-page__detail-row--patient"
                                        >
                                          <span className="history-page__detail-label">
                                            {item.label}
                                          </span>

                                          <span className="history-page__detail-value">
                                            {item.value}
                                          </span>
                                        </div>
                                      ))}

                                    {auditReasons.length > 0 && (
                                      <div className="history-page__detail-row history-page__detail-row--patient">
                                        <span className="history-page__detail-label">
                                          Motivos de revisión
                                        </span>

                                        <div className="history-page__audit-reasons">
                                          {auditReasons.map((reason, index) => (
                                            <span
                                              key={index}
                                              className="history-page__detail-value"
                                            >
                                              {getAuditReasonLabel(reason)}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {typeof routingDecision.justification ===
                                      "string" && (
                                      <div className="history-page__detail-row history-page__detail-row--patient">
                                        <span className="history-page__detail-label">
                                          Justificación
                                        </span>

                                        <span className="history-page__detail-value">
                                          {routingDecision.justification}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </section>
                              )}

                              {storage && typeof storage.state === "string" && (
                                <div className="history-page__storage-status">
                                  <span className="history-page__storage-label">
                                    Almacenamiento
                                  </span>
                                  <span
                                    className={`history-page__storage-badge ${
                                      storage.state === "SUCCESS"
                                        ? "history-page__storage-badge--success"
                                        : storage.state === "ERROR"
                                          ? "history-page__storage-badge--error"
                                          : "history-page__storage-badge--warning"
                                    }`}
                                  >
                                    {storage.state === "SUCCESS" ? (
                                      <CircleCheck
                                        size={18}
                                        aria-hidden="true"
                                      />
                                    ) : storage.state === "ERROR" ? (
                                      <CircleAlert
                                        size={18}
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Clock3 size={18} aria-hidden="true" />
                                    )}
                                    <span>
                                      {storage.state === "SUCCESS"
                                        ? "Guardado correctamente"
                                        : storage.state === "ERROR"
                                          ? "Error al guardar"
                                          : "Guardado pendiente"}
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <pre className="history-page__json">
                              {JSON.stringify(entry.result, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default HistoryPage;
