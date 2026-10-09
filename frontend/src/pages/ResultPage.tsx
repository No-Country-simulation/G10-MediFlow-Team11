import "../styles/processing-page.css";
import PageHeader from "../components/PageHeader";
import DocumentViewer, {
  type DocumentViewerState,
  type ViewerMimeType,
} from "../components/DocumentViewer/DocumentViewer";
import { Box, Chip, Link } from "@mui/material";
import { useLocation, useNavigate, Link as RouterLink } from "react-router-dom";
import { useEffect, useMemo } from "react";
import type {
  AuditReason,
  DocumentStatus,
  DocumentType,
  PriorityLevel,
  ProcessingResponse,
  RoutingDestination,
} from "../types/processing";

type SourceKind = "file" | "text";

interface ResultLocationState {
  result: ProcessingResponse;
  sourceKind: SourceKind;
  sourceFile?: File | null;
  sourceText?: string | null;
  originChannel?: string | null;
}

const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  PRESCRIPTION: "Receta médica",
  IMAGING_REPORT: "Informe de imágenes",
  STUDY_REPORT: "Informe de estudios",
  PROCEDURE_ORDER: "Orden de procedimiento",
  DISCHARGE_SUMMARY: "Resumen de egreso",
  MEDICAL_CERTIFICATE: "Certificado médico",
};

const PRIORITY_LABEL: Record<PriorityLevel, string> = {
  ROUTINE: "Rutina",
  URGENT: "Urgente",
};

const PRIORITY_COLOR: Record<PriorityLevel, "default" | "error" | "warning"> = {
  ROUTINE: "default",
  URGENT: "error",
};

const DESTINATION_LABEL: Record<RoutingDestination, string> = {
  MEDICAL_EMERGENCY: "Guardia de Emergencias",
  PHARMACY: "Farmacia",
  AUTHORIZATION_AUDIT: "Auditoría de autorizaciones",
  MEDICAL_RECORD: "Historia clínica",
  HUMAN_REVIEW: "Revisión humana",
};

const STATUS_COLOR: Record<
  DocumentStatus,
  "success" | "warning" | "error" | "info"
> = {
  RECEIVED: "info",
  PROCESSING: "info",
  PROCESSED: "success",
  NEEDS_AUDIT: "warning",
  APPROVED: "success",
  REJECTED: "error",
  FAILED: "error",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  RECEIVED: "Recibido",
  PROCESSING: "En procesamiento",
  PROCESSED: "Procesado",
  NEEDS_AUDIT: "Requiere auditoría",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
};

const AUDIT_REASON_LABEL: Record<AuditReason, string> = {
  LOW_CONFIDENCE: "Baja confianza en la extracción",
  ILLEGIBLE_DOCUMENT: "Documento ilegible",
  MISSING_CRITICAL_FIELDS: "Campos críticos faltantes",
  INCONSISTENT_DATA: "Datos inconsistentes",
  INVALID_AI_RESPONSE: "Respuesta de IA inválida",
  AI_TIMEOUT: "Tiempo agotado en IA",
  AI_UNAVAILABLE: "IA no disponible",
};

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function isViewerMimeType(value: string): value is ViewerMimeType {
  return (
    value === "application/pdf" ||
    value === "image/jpeg" ||
    value === "image/png"
  );
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 90 ? "#0B7573" : pct >= 70 ? "#1A5FD0" : "#FF6B35";
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          marginBottom: 6,
          color: "#737373",
        }}
      >
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: "#1A1A1A" }}>
          {percentage(value)}
        </span>
      </div>
      <div
        style={{
          height: 8,
          width: "100%",
          background: "#F5F5F5",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 6,
            transition: "width 300ms ease",
          }}
        />
      </div>
    </div>
  );
}

function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as ResultLocationState | null) ?? null;
  const result = state?.result ?? null;

  useEffect(() => {
    if (!result) return undefined;
    window.scrollTo({ top: 0, behavior: "smooth" });
    return undefined;
  }, [result]);

  const previewDocument: DocumentViewerState | null = useMemo(() => {
    const file = state?.sourceFile;
    if (!file || !isViewerMimeType(file.type)) return null;
    return {
      status: "ready",
      documentKey: file.name + String(file.lastModified) + String(file.size),
      blob: file,
      mimeType: file.type,
      fileName: file.name,
    };
  }, [state]);

  if (!result) {
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <PageHeader
          title="Resultado del procesamiento"
          description="No hay un resultado disponible. Por favor, procese primero un documento o texto."
        />
        <Box
          sx={{
            background: "#FFFFFF",
            border: "1px solid #E5E5E5",
            borderRadius: "12px",
            padding: 4,
            textAlign: "center",
            maxWidth: 620,
            mx: "auto",
          }}
        >
          <p style={{ color: "#737373", margin: "0 0 20px 0" }}>
            No se encontró un resultado de procesamiento en el contexto.
          </p>
          <Link
            component={RouterLink}
            to="/processing"
            underline="hover"
            sx={{
              display: "inline-flex",
              height: 44,
              alignItems: "center",
              px: 3,
              borderRadius: 2,
              background: "#1A5FD0",
              color: "#FFFFFF",
              textDecoration: "none",
              fontWeight: 600,
              "&:hover": { background: "#174FA9" },
            }}
          >
            Volver a Procesamiento
          </Link>
        </Box>
      </Box>
    );
  }

  const {
    document_id,
    status,
    classification,
    confidence,
    extracted_data,
    validation,
    routing_decision,
    notification,
    storage,
  } = result;

  const isTextSource = state?.sourceKind === "text";
  const hasAuditReasons = routing_decision.audit_reasons.length > 0;
  const hasMissing = validation?.missing_fields.length ?? 0 > 0;
  const hasWarnings = validation?.warnings.length ?? 0 > 0;
  const hasInconsistencies = validation?.inconsistencies.length ?? 0 > 0;
  const hasValidation = hasMissing || hasWarnings || hasInconsistencies;

  return (
    <Box className="processing-page">
      <PageHeader
        title="Resultado del procesamiento"
        description="Revise la clasificación, los datos extraídos y el destino asignado al documento."
      />
      <Box sx={{ width: "100%", maxWidth: 1400, mx: "auto" }}>
        <div className="processing-page__grid" style={{ overflow: "hidden" }}>
          <div className="processing-page__grid-col processing-page__grid-col--config">
            <section
              aria-busy={false}
              className="processing-page__config-panel"
            >
              <div
                className="processing-page__section-header"
                style={{ height: 36 }}
              >
                Resultado
              </div>
              <div
                className="processing-page__config-body"
                style={{ padding: 24 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 24,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#737373",
                        marginBottom: 4,
                      }}
                    >
                      Identificador
                    </div>
                    <div
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {document_id}
                    </div>
                  </div>
                  <Chip
                    color={STATUS_COLOR[status]}
                    label={STATUS_LABEL[status]}
                    size="medium"
                    sx={{ borderRadius: "999px", fontWeight: 600, px: 1 }}
                  />
                </div>

                {state?.originChannel && (
                  <div
                    style={{ marginBottom: 24, fontSize: 12, color: "#737373" }}
                  >
                    <span style={{ display: "block", marginBottom: 2 }}>
                      Origen
                    </span>
                    <span style={{ color: "#1A1A1A", fontWeight: 500 }}>
                      {state.originChannel}
                    </span>
                  </div>
                )}

                {classification && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        marginBottom: 12,
                      }}
                    >
                      Clasificación
                    </div>
                    <div
                      style={{
                        background: "#FAFAFA",
                        border: "1px solid #E5E5E5",
                        borderRadius: 10,
                        padding: "16px 18px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#737373",
                              marginBottom: 4,
                            }}
                          >
                            Tipo de documento
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#1A1A1A",
                            }}
                          >
                            {DOCUMENT_TYPE_LABEL[classification.document_type]}
                          </div>
                        </div>
                        {classification.specialty && (
                          <div style={{ flex: 1, minWidth: 200 }}>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#737373",
                                marginBottom: 4,
                              }}
                            >
                              Especialidad
                            </div>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: "#1A1A1A",
                              }}
                            >
                              {classification.specialty}
                            </div>
                          </div>
                        )}
                        <div style={{ minWidth: 120 }}>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#737373",
                              marginBottom: 4,
                            }}
                          >
                            Prioridad
                          </div>
                          <Chip
                            label={
                              PRIORITY_LABEL[classification.priority_level]
                            }
                            color={
                              PRIORITY_COLOR[classification.priority_level]
                            }
                            size="small"
                            sx={{ fontWeight: 600, borderRadius: "999px" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {confidence && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        marginBottom: 12,
                      }}
                    >
                      Confianza
                    </div>
                    <ConfidenceBar
                      label="Clasificación"
                      value={confidence.classification}
                    />
                    <ConfidenceBar
                      label="Extracción"
                      value={confidence.extraction}
                    />
                    <ConfidenceBar label="Global" value={confidence.global} />
                  </div>
                )}

                {hasAuditReasons && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        marginBottom: 12,
                      }}
                    >
                      Motivos de auditoría
                    </div>
                    <div
                      style={{
                        background: "#FFFBF7",
                        border: "1px solid rgba(255, 107, 53, 0.35)",
                        borderRadius: 10,
                        padding: "14px 16px",
                      }}
                    >
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {routing_decision.audit_reasons.map((reason) => (
                          <li
                            key={reason}
                            style={{
                              fontSize: 13,
                              color: "#1A1A1A",
                              marginBottom: 6,
                            }}
                          >
                            {AUDIT_REASON_LABEL[reason]}
                          </li>
                        ))}
                      </ul>
                      {routing_decision.requires_human_review && (
                        <div
                          style={{
                            marginTop: 12,
                            paddingTop: 12,
                            borderTop: "1px solid rgba(255, 107, 53, 0.25)",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#FF6B35",
                          }}
                        >
                          ⚠ Requiere revisión humana
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {notification && notification.generated && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        marginBottom: 12,
                      }}
                    >
                      Notificación generada
                    </div>
                    <div
                      style={{
                        background: "#EEF4FF",
                        border: "1px solid rgba(26, 95, 208, 0.25)",
                        borderRadius: 10,
                        padding: "14px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#737373",
                          marginBottom: 4,
                        }}
                      >
                        Tipo:{" "}
                        <span style={{ fontWeight: 600, color: "#1A5FD0" }}>
                          {notification.type}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#1A1A1A",
                          lineHeight: 1.45,
                        }}
                      >
                        {notification.message}
                      </div>
                    </div>
                  </div>
                )}

                {extracted_data && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        marginBottom: 12,
                      }}
                    >
                      Datos extraídos
                    </div>
                    <div
                      style={{
                        background: "#FAFAFA",
                        border: "1px solid #E5E5E5",
                        borderRadius: 10,
                        padding: "16px 18px",
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      {extracted_data.patient?.name && (
                        <div>
                          <span style={{ fontSize: 12, color: "#737373" }}>
                            Paciente:&nbsp;
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>
                            {extracted_data.patient.name}
                            {typeof extracted_data.patient.age === "number" && (
                              <span
                                style={{
                                  color: "#737373",
                                  marginLeft: 6,
                                  fontWeight: 400,
                                }}
                              >
                                · {extracted_data.patient.age} años
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {extracted_data.requesting_doctor?.name && (
                        <div>
                          <span style={{ fontSize: 12, color: "#737373" }}>
                            Solicitante:&nbsp;
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>
                            {extracted_data.requesting_doctor.name}
                            {extracted_data.requesting_doctor
                              .license_number && (
                              <span
                                style={{
                                  color: "#737373",
                                  marginLeft: 6,
                                  fontWeight: 400,
                                }}
                              >
                                · MP{" "}
                                {
                                  extracted_data.requesting_doctor
                                    .license_number
                                }
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {extracted_data.primary_diagnosis && (
                        <div>
                          <span style={{ fontSize: 12, color: "#737373" }}>
                            Diagnóstico:&nbsp;
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>
                            {extracted_data.primary_diagnosis}
                          </span>
                        </div>
                      )}
                      {extracted_data.suggested_icd10 && (
                        <div>
                          <span style={{ fontSize: 12, color: "#737373" }}>
                            CIE-10 sugerido:&nbsp;
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#1A5FD0",
                            }}
                          >
                            {extracted_data.suggested_icd10}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {hasValidation && validation && (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        marginBottom: 12,
                      }}
                    >
                      Validación
                    </div>
                    <div
                      style={{
                        background: "#FFFBF7",
                        border: "1px solid rgba(255, 107, 53, 0.2)",
                        borderRadius: 10,
                        padding: "14px 16px",
                      }}
                    >
                      {hasMissing && (
                        <div style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#FF6B35",
                              marginBottom: 4,
                            }}
                          >
                            Campos faltantes ({validation.missing_fields.length}
                            )
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 18,
                              fontSize: 12,
                              color: "#1A1A1A",
                            }}
                          >
                            {validation.missing_fields.map((f) => (
                              <li key={f}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {hasInconsistencies && (
                        <div style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#FF6B35",
                              marginBottom: 4,
                            }}
                          >
                            Inconsistencias ({validation.inconsistencies.length}
                            )
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 18,
                              fontSize: 12,
                              color: "#1A1A1A",
                            }}
                          >
                            {validation.inconsistencies.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {hasWarnings && (
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#FF6B35",
                              marginBottom: 4,
                            }}
                          >
                            Advertencias ({validation.warnings.length})
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 18,
                              fontSize: 12,
                              color: "#1A1A1A",
                            }}
                          >
                            {validation.warnings.map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 24 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1A1A1A",
                      marginBottom: 12,
                    }}
                  >
                    Enrutamiento
                  </div>
                  <div
                    style={{
                      background: "#FAFAFA",
                      border: "1px solid #E5E5E5",
                      borderRadius: 10,
                      padding: "16px 18px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "#737373",
                        marginBottom: 4,
                      }}
                    >
                      Destino principal
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "#1A1A1A",
                        marginBottom: 10,
                      }}
                    >
                      {DESTINATION_LABEL[routing_decision.primary_destination]}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "#4B5576",
                        padding: 12,
                        borderRadius: 8,
                        background: "#FFFFFF",
                        border: "1px solid #F0F0F0",
                      }}
                    >
                      {routing_decision.justification}
                    </div>
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1A1A1A",
                      marginBottom: 12,
                    }}
                  >
                    Almacenamiento
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "999px",
                        background:
                          storage.state === "SUCCESS"
                            ? "#0B7573"
                            : storage.state === "ERROR"
                              ? "#FF6B35"
                              : "#A9A9A9",
                      }}
                    />
                    <span style={{ color: "#1A1A1A" }}>{storage.provider}</span>
                    <span style={{ color: "#737373" }}>·</span>
                    <span style={{ color: "#737373" }}>
                      Estado:{" "}
                      {storage.state === "SUCCESS"
                        ? "Almacenado"
                        : storage.state === "ERROR"
                          ? "Error de almacenamiento"
                          : "Pendiente"}
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="processing-page__config-footer"
                style={{ padding: "12px" }}
              >
                <div
                  className="processing-page__actions-row"
                  style={{ width: "100%", flexWrap: "wrap" }}
                >
                  <button
                    type="button"
                    onClick={() => navigate("/processing")}
                    className="processing-page__btn-primary processing-page__btn-primary--enabled"
                  >
                    Procesar otro documento
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/audit")}
                    className="processing-page__btn-secondary"
                  >
                    Ir a Auditoría
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="processing-page__grid-col processing-page__grid-col--viewer">
            <section className="processing-page__viewer-panel">
              <div
                className="processing-page__viewer-header"
                style={{ paddingInline: 16 }}
              >
                <h2 className="processing-page__viewer-title">
                  {isTextSource ? "Texto original" : "Documento"}
                </h2>
                <span
                  className="processing-page__viewer-filename"
                  title={
                    isTextSource
                      ? (state?.originChannel ?? "Entrada de texto")
                      : state?.sourceFile?.name
                  }
                >
                  {isTextSource
                    ? "Entrada de texto"
                    : (state?.sourceFile?.name ?? document_id)}
                </span>
              </div>
              <div className="processing-page__viewer-body">
                {isTextSource ? (
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      background: "#FFFFFF",
                      padding: "24px 28px",
                      minHeight: 0,
                    }}
                  >
                    <p
                      style={{
                        maxWidth: 720,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        fontSize: 14,
                        lineHeight: 1.7,
                        color: "#1A1A1A",
                        margin: 0,
                      }}
                    >
                      {state?.sourceText || ""}
                    </p>
                  </div>
                ) : previewDocument ? (
                  <DocumentViewer
                    document={previewDocument}
                    ariaLabel="Vista previa del documento procesado"
                    className="processing-page__viewer-body"
                  />
                ) : (
                  <Box
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#737373",
                      fontSize: 13,
                    }}
                  >
                    Vista previa no disponible para este tipo de archivo.
                  </Box>
                )}
              </div>
            </section>
          </div>
        </div>
      </Box>
    </Box>
  );
}

export default ResultPage;
