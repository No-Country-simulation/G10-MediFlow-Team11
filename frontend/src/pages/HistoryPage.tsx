import { useEffect, useState } from "react";
import { getDocumentHistory } from "../services/historyService";
import type { DocumentHistoryResponse } from "../types/history";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Paper,
  Tab,
  Tabs,
  Divider,
} from "@mui/material";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ErrorIcon from "@mui/icons-material/Error";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { getDocumentResult } from "../services/resultService";
import type { ProcessingResponse } from "../types/processing";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDocumentTypeLabel(value: unknown): string {
  const labels: Record<string, string> = {
    PRESCRIPTION: "Receta médica",
    IMAGING_REPORT: "Informe de imágenes",
    STUDY_REPORT: "Informe de estudio",
    PROCEDURE_ORDER: "Orden de procedimiento",
    DISCHARGE_SUMMARY: "Epicrisis",
    MEDICAL_CERTIFICATE: "Certificado médico",
  };

  return typeof value === "string" ? (labels[value] ?? value) : "No disponible";
}

function getPriorityLabel(value: unknown): string {
  const labels: Record<string, string> = {
    ROUTINE: "Rutina",
    URGENT: "Urgente",
  };

  return typeof value === "string" ? (labels[value] ?? value) : "No disponible";
}

function getRoutingDestinationLabel(value: unknown): string {
  const labels: Record<string, string> = {
    MEDICAL_EMERGENCY: "Emergencia médica",
    PHARMACY: "Farmacia",
    AUTHORIZATION_AUDIT: "Auditoría de autorizaciones",
    MEDICAL_RECORD: "Historia clínica",
    HUMAN_REVIEW: "Revisión humana",
  };

  return typeof value === "string" ? (labels[value] ?? value) : "No disponible";
}

function getAuditReasonLabel(value: string): string {
  const labels: Record<string, string> = {
    LOW_CONFIDENCE: "Baja confianza",
    ILLEGIBLE_DOCUMENT: "Documento ilegible",
    MISSING_CRITICAL_FIELDS: "Faltan campos críticos",
    INCONSISTENT_DATA: "Datos inconsistentes",
    INVALID_AI_RESPONSE: "Respuesta inválida de la IA",
    AI_TIMEOUT: "Tiempo de espera agotado de la IA",
    AI_UNAVAILABLE: "IA no disponible",
  };

  return labels[value] ?? value;
}

const getMissingFieldLabel = (field: string): string => {
  const labels: Record<string, string> = {
    "patient.name": "Nombre del paciente",
    "patient.age": "Edad del paciente",
    "requesting_doctor.name": "Médico solicitante",
    "requesting_doctor.license_number": "Matrícula profesional del médico",
    primary_diagnosis: "Diagnóstico principal",
    suggested_icd10: "Código CIE-10 sugerido",
    medications: "Medicamentos",
    requested_studies: "Estudios solicitados",
  };

  const normalizedField = field.replace(/\[\d+\]/g, "");

  const medicationMatch = normalizedField.match(
    /^medications(?:\.\d+)?\.(name|dosage)$/,
  );

  if (medicationMatch) {
    return medicationMatch[1] === "name"
      ? "Nombre del medicamento"
      : "Dosis del medicamento";
  }

  const studyMatch = normalizedField.match(
    /^requested_studies(?:\.\d+)?\.name$/,
  );

  if (studyMatch) {
    return "Nombre del estudio solicitado";
  }

  return labels[field] ?? field;
};

function HistoryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
        const [response, result] = await Promise.all([
          getDocumentHistory(documentId!, controller.signal),
          getDocumentResult(documentId!),
        ]);

        if (!controller.signal.aborted) {
          setHistory(response);
          setCurrentResult(result);
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

  const getStatusLabel = (status: unknown): string => {
    const labels: Record<string, string> = {
      RECEIVED: "Recibido",
      PROCESSING: "En procesamiento",
      PROCESSED: "Procesado",
      NEEDS_AUDIT: "Requiere auditoría",
      APPROVED: "Aprobado",
      REJECTED: "Rechazado",
      FAILED: "Fallido",
    };

    return typeof status === "string"
      ? (labels[status] ?? status)
      : "No disponible";
  };

  return (
    <>
      <PageHeader
        title="Historial de documentos"
        description="Consulte los estados registrados durante el procesamiento y las revisiones realizadas sobre este documento."
      />
      <Divider sx={{ margin: 0 }} />
      <Box>
        {!documentId ? (
          <Alert severity="warning">
            No se especificó un documento para consultar su historial.
          </Alert>
        ) : loading ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              py: 6,
            }}
          >
            <CircularProgress size={24} />
            <Typography color="text.secondary">
              Cargando historial del documento...
            </Typography>
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : !history ? (
          <Alert severity="info">
            No se encontró el historial del documento {documentId}.
          </Alert>
        ) : history.entries.length === 0 ? (
          <Alert severity="info">
            El documento {documentId} todavía no tiene eventos registrados.
          </Alert>
        ) : (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Paper
                variant="outlined"
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  gap: 4,
                  mt: 2,
                  p: 2,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Documento
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 500,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {history.documentId}
                  </Typography>
                </Box>
                {currentResult && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Estado actual
                    </Typography>
                    <Box
                      sx={{
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Chip
                        label={getStatusLabel(currentResult.status)}
                        size="small"
                        variant="outlined"
                        color={
                          currentResult.status === "APPROVED"
                            ? "success"
                            : currentResult.status === "REJECTED"
                              ? "error"
                              : currentResult.status === "NEEDS_AUDIT"
                                ? "warning"
                                : "default"
                        }
                        sx={{ fontWeight: 500 }}
                      />
                    </Box>
                  </Box>
                )}

                {sortedEntries.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Último evento
                    </Typography>

                    <Typography
                      variant="body1"
                      sx={{
                        fontWeight: 500,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {new Date(
                        sortedEntries[sortedEntries.length - 1].occurredAt,
                      ).toLocaleString("es-MX")}
                    </Typography>
                  </Box>
                )}
                {documentId && (
                  <Box
                    sx={{
                      display: "flex",
                      whiteSpace: "nowrap",
                      ml: "auto",
                      px: 2,
                    }}
                  >
                    <Button
                      variant="text"
                      startIcon={<ArrowBackIcon />}
                      onClick={() => {
                        navigate(`/results/${encodeURIComponent(documentId)}`);
                      }}
                      sx={{
                        flexShrink: 0,
                      }}
                    >
                      Volver al resultado
                    </Button>
                  </Box>
                )}
              </Paper>
            </Box>
            <Box
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                mt: 3,
                ml: sortedEntries.length > 1 ? 3 : 0,

                ...(sortedEntries.length > 1 && {
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 16,
                    bottom: 16,
                    left: -17,
                    width: 2,
                    bgcolor: "divider",
                  },
                }),
              }}
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

                const routingDecision = isRecord(entry.result.routing_decision)
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
                  <Box
                    key={entry.sequence}
                    sx={{
                      position: "relative",
                      ...(sortedEntries.length > 1 && {
                        "&::before": {
                          content: '""',
                          position: "absolute",
                          top: 20,
                          left: -22,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor:
                            entry.eventType === "INITIAL_TRIAGE"
                              ? "primary.main"
                              : "success.main",
                          zIndex: 1,
                        },
                      }),
                    }}
                  >
                    <Accordion
                      expanded={expandedSequence === entry.sequence}
                      onChange={(_, isExpanded) => {
                        setSelectedEvent({
                          documentId: documentId!,
                          sequence: isExpanded ? entry.sequence : -1,
                        });
                      }}
                      disableGutters
                      sx={{
                        border: 1,
                        borderColor: "divider",
                        borderRadius: "8px !important",
                        boxShadow: "none",
                        "&::before": { display: "none" },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        sx={{
                          px: 3,
                          py: 1,
                          "& .MuiAccordionSummary-content": {
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                          },
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              flexWrap: "wrap",
                              gap: 2,
                            }}
                          >
                            <Box>
                              <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 600 }}
                              >
                                {entry.eventType === "INITIAL_TRIAGE"
                                  ? "Triaje inicial"
                                  : "Revisión humana"}
                              </Typography>

                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Evento {entry.sequence} ·{" "}
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
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {entry.eventType === "INITIAL_TRIAGE" &&
                          typeof entry.result.status === "string" && (
                            <Chip
                              sx={{ whiteSpace: "nowrap" }}
                              label={
                                entry.result.status === "NEEDS_AUDIT"
                                  ? "Requiere revisión"
                                  : getStatusLabel(entry.result.status)
                              }
                              color={
                                entry.result.status === "NEEDS_AUDIT"
                                  ? "warning"
                                  : entry.result.status === "FAILED" ||
                                      entry.result.status === "REJECTED"
                                    ? "error"
                                    : "success"
                              }
                              size="small"
                              variant="outlined"
                            />
                          )}

                        {entry.eventType === "HUMAN_REVIEW" &&
                          entry.decision && (
                            <Chip
                              sx={{ whiteSpace: "nowrap" }}
                              label={
                                entry.decision === "APPROVE"
                                  ? "Aprobado"
                                  : "Rechazado"
                              }
                              color={
                                entry.decision === "APPROVE"
                                  ? "success"
                                  : "error"
                              }
                              size="small"
                              variant="outlined"
                            />
                          )}
                        <Typography
                          variant="caption"
                          color="primary"
                          sx={{
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {expandedSequence === entry.sequence
                            ? "Ocultar detalle"
                            : "Mostrar detalle"}
                        </Typography>
                      </AccordionSummary>

                      <AccordionDetails sx={{ px: 3, pb: 3 }}>
                        <Tabs
                          value={activeTab}
                          onChange={(_, value: "summary" | "json") =>
                            setActiveTab(value)
                          }
                          sx={{
                            mb: 3,
                            borderBottom: 1,
                            borderColor: "divider",
                          }}
                        >
                          <Tab label="Resumen" value="summary" />
                          <Tab label="JSON" value="json" />
                        </Tabs>

                        {activeTab === "summary" ? (
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: {
                                xs: "minmax(0, 1fr)",
                                md: "repeat(2, minmax(0, 1fr))",
                              },
                              gap: 2,
                              "& > *": {
                                minWidth: 0,
                              },
                            }}
                          >
                            {classification && (
                              <Paper
                                variant="outlined"
                                sx={{
                                  borderRadius: 2,
                                  overflow: "hidden",
                                  gridColumn:
                                    entry.result.status === "APPROVED" ||
                                    !confidence
                                      ? "1 / -1"
                                      : "auto",
                                }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                    px: 2,
                                    py: 1.5,
                                    fontWeight: 600,
                                    borderBottom: 1,
                                    borderColor: "divider",
                                  }}
                                >
                                  Clasificación
                                </Typography>
                                <Box
                                  sx={{
                                    p: 2,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 1.5,
                                  }}
                                >
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
                                      <Box
                                        key={item.label}
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "minmax(120px, 1fr) minmax(0, 1.7fr)",
                                          },
                                          gap: 1,
                                          alignItems: "start",
                                        }}
                                      >
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {item.label}
                                        </Typography>

                                        <Typography
                                          variant="body2"
                                          sx={{ fontWeight: 500 }}
                                        >
                                          {item.value}
                                        </Typography>
                                      </Box>
                                    ))}
                                </Box>
                              </Paper>
                            )}

                            {confidence &&
                              entry.result.status !== "APPROVED" && (
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    borderRadius: 2,
                                    overflow: "hidden",
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    sx={{
                                      px: 2,
                                      py: 1.5,
                                      fontWeight: 600,
                                      borderBottom: 1,
                                      borderColor: "divider",
                                    }}
                                  >
                                    Confianza
                                  </Typography>
                                  <Box
                                    sx={{
                                      p: 2,
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 1.5,
                                    }}
                                  >
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
                                          <Box
                                            key={item.label}
                                            sx={{
                                              display: "grid",
                                              gridTemplateColumns: {
                                                xs: "1fr",
                                                sm: "minmax(120px, 1fr) minmax(0, 1.7fr)",
                                              },
                                              gap: 1,
                                              alignItems: "start",
                                            }}
                                          >
                                            <Typography
                                              variant="caption"
                                              color="text.secondary"
                                            >
                                              {item.label}
                                            </Typography>

                                            <Typography
                                              variant="body2"
                                              sx={{ fontWeight: 500 }}
                                            >
                                              {(item.value * 100).toFixed(0)}%
                                            </Typography>
                                          </Box>
                                        ),
                                    )}
                                  </Box>
                                </Paper>
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
                                <Paper
                                  variant="outlined"
                                  sx={{
                                    gridColumn: "1 / -1",
                                    borderRadius: 2,
                                    overflow: "hidden",
                                  }}
                                >
                                  <Typography
                                    variant="subtitle2"
                                    sx={{
                                      px: 2,
                                      py: 1.5,
                                      fontWeight: 600,
                                      borderBottom: 1,
                                      borderColor: "divider",
                                    }}
                                  >
                                    Datos clínicos extraídos
                                  </Typography>
                                  <Box sx={{ p: 2 }}>
                                    {patient && (
                                      <Box
                                        sx={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 1.5,
                                          mb: 2,
                                        }}
                                      >
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
                                          .filter((item) => item.value !== null)
                                          .map((item) => (
                                            <Box
                                              key={item.label}
                                              sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                  xs: "1fr",
                                                  sm: "160px minmax(0, 1fr)",
                                                },
                                                gap: 1,
                                                alignItems: "start",
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                              >
                                                {item.label}
                                              </Typography>

                                              <Typography
                                                variant="body2"
                                                sx={{ fontWeight: 500 }}
                                              >
                                                {item.value}
                                              </Typography>
                                            </Box>
                                          ))}
                                      </Box>
                                    )}

                                    {requestingDoctor && (
                                      <Box
                                        sx={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 1.5,
                                          mb: 2,
                                        }}
                                      >
                                        {[
                                          {
                                            label: "Médico solicitante",
                                            value:
                                              typeof requestingDoctor.name ===
                                              "string"
                                                ? requestingDoctor.name
                                                : null,
                                          },
                                          {
                                            label: "Matrícula profesional",
                                            value:
                                              typeof requestingDoctor.license_number ===
                                              "string"
                                                ? requestingDoctor.license_number
                                                : null,
                                          },
                                        ]
                                          .filter((item) => item.value !== null)
                                          .map((item) => (
                                            <Box
                                              key={item.label}
                                              sx={{
                                                display: "grid",
                                                gridTemplateColumns: {
                                                  xs: "1fr",
                                                  sm: "160px minmax(0, 1fr)",
                                                },
                                                gap: 1,
                                                alignItems: "start",
                                              }}
                                            >
                                              <Typography
                                                variant="caption"
                                                color="text.secondary"
                                              >
                                                {item.label}
                                              </Typography>

                                              <Typography
                                                variant="body2"
                                                sx={{ fontWeight: 500 }}
                                              >
                                                {item.value}
                                              </Typography>
                                            </Box>
                                          ))}
                                      </Box>
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
                                        <Box
                                          key={item.label}
                                          sx={{
                                            display: "grid",
                                            gridTemplateColumns: {
                                              xs: "1fr",
                                              sm: "160px minmax(0, 1fr)",
                                            },
                                            gap: 1,
                                            alignItems: "start",
                                            mb: 1.5,
                                          }}
                                        >
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                          >
                                            {item.label}
                                          </Typography>

                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 500 }}
                                          >
                                            {item.value}
                                          </Typography>
                                        </Box>
                                      ))}

                                    {medications.length > 0 && (
                                      <Box
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "160px minmax(0, 1fr)",
                                          },
                                          gap: 1,
                                          alignItems: "start",
                                          mb: 1.5,
                                        }}
                                      >
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Medicamentos
                                        </Typography>

                                        <Box
                                          sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 0.5,
                                          }}
                                        >
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

                                              if (!name && !dosage) return null;

                                              return (
                                                <Typography
                                                  key={index}
                                                  variant="body2"
                                                  sx={{ fontWeight: 500 }}
                                                >
                                                  {[name, dosage]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                                </Typography>
                                              );
                                            },
                                          )}
                                        </Box>
                                      </Box>
                                    )}

                                    {requestedStudies.length > 0 && (
                                      <Box
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "160px minmax(0, 1fr)",
                                          },
                                          gap: 1,
                                          alignItems: "start",
                                          mb: 1.5,
                                        }}
                                      >
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          Estudios solicitados
                                        </Typography>

                                        <Box
                                          sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 0.5,
                                          }}
                                        >
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
                                                <Typography
                                                  key={index}
                                                  variant="body2"
                                                  sx={{ fontWeight: 500 }}
                                                >
                                                  {study.name}
                                                </Typography>
                                              );
                                            },
                                          )}
                                        </Box>
                                      </Box>
                                    )}
                                  </Box>
                                </Paper>
                              )}

                            <Paper
                              variant="outlined"
                              sx={{
                                borderRadius: 2,
                                overflow: "hidden",
                                alignSelf: "start",
                              }}
                            >
                              <Typography
                                variant="subtitle2"
                                sx={{
                                  px: 2,
                                  py: 1.5,
                                  fontWeight: 600,
                                  borderBottom: 1,
                                  borderColor: "divider",
                                }}
                              >
                                Validación
                              </Typography>
                              {entry.result.status === "APPROVED" ||
                              (missingFields.length === 0 &&
                                inconsistencies.length === 0 &&
                                warnings.length === 0) ? (
                                <Box
                                  sx={{
                                    display: "flex",
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 1,
                                    px: 2,
                                    py: 1.5,
                                  }}
                                >
                                  <TaskAltIcon
                                    color="success"
                                    sx={{ fontSize: 18, flexShrink: 0 }}
                                  />

                                  <Typography
                                    variant="body2"
                                    color="success.main"
                                    sx={{ fontWeight: 500 }}
                                  >
                                    Sin hallazgos de validación
                                  </Typography>
                                </Box>
                              ) : (
                                <Box sx={{ p: 2 }}>
                                  {[
                                    {
                                      title: "Campos faltantes",
                                      items: missingFields,
                                    },
                                    {
                                      title: "Inconsistencias",
                                      items: inconsistencies,
                                    },
                                    { title: "Advertencias", items: warnings },
                                  ].map(
                                    ({ title, items }) =>
                                      items.length > 0 && (
                                        <Box
                                          key={title}
                                          sx={{
                                            display: "grid",
                                            gridTemplateColumns: {
                                              xs: "1fr",
                                              sm: "160px minmax(0, 1fr)",
                                            },
                                            gap: 1,
                                            alignItems: "start",
                                          }}
                                        >
                                          <Typography
                                            variant="caption"
                                            color="text.secondary"
                                          >
                                            {title}
                                          </Typography>

                                          <Box
                                            sx={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: 0.5,
                                            }}
                                          >
                                            <Typography
                                              variant="body2"
                                              sx={{ fontWeight: 500 }}
                                            >
                                              {items
                                                .map((item) =>
                                                  title === "Campos faltantes"
                                                    ? getMissingFieldLabel(item)
                                                    : item,
                                                )
                                                .join(", ")}
                                            </Typography>
                                          </Box>
                                        </Box>
                                      ),
                                  )}
                                </Box>
                              )}
                            </Paper>

                            {routingDecision && (
                              <Paper
                                variant="outlined"
                                sx={{
                                  borderRadius: 2,
                                  overflow: "hidden",
                                }}
                              >
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                    px: 2,
                                    py: 1.5,
                                    fontWeight: 600,
                                    borderBottom: 1,
                                    borderColor: "divider",
                                  }}
                                >
                                  Enrutamiento
                                </Typography>
                                <Box sx={{ p: 2 }}>
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
                                      <Box
                                        key={item.label}
                                        sx={{
                                          display: "grid",
                                          gridTemplateColumns: {
                                            xs: "1fr",
                                            sm: "160px minmax(0, 1fr)",
                                          },
                                          gap: 1,
                                          alignItems: "start",
                                          mb: 1.5,
                                        }}
                                      >
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {item.label}
                                        </Typography>

                                        <Typography
                                          variant="body2"
                                          sx={{ fontWeight: 500 }}
                                        >
                                          {item.value}
                                        </Typography>
                                      </Box>
                                    ))}

                                  {auditReasons.length > 0 && (
                                    <Box
                                      sx={{
                                        display: "grid",
                                        gridTemplateColumns: {
                                          xs: "1fr",
                                          sm: "160px minmax(0, 1fr)",
                                        },
                                        gap: 1,
                                        alignItems: "start",
                                        mb: 1.5,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        Motivos de revisión
                                      </Typography>

                                      <Box
                                        sx={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 0.5,
                                        }}
                                      >
                                        {auditReasons.map((reason, index) => (
                                          <Typography
                                            key={index}
                                            variant="body2"
                                            sx={{ fontWeight: 500 }}
                                          >
                                            {getAuditReasonLabel(reason)}
                                          </Typography>
                                        ))}
                                      </Box>
                                    </Box>
                                  )}

                                  {typeof routingDecision.justification ===
                                    "string" && (
                                    <Box
                                      sx={{
                                        display: "grid",
                                        gridTemplateColumns: {
                                          xs: "1fr",
                                          sm: "160px minmax(0, 1fr)",
                                        },
                                        gap: 1,
                                        alignItems: "start",
                                        mb: 1.5,
                                      }}
                                    >
                                      <Typography
                                        variant="caption"
                                        color="text.secondary"
                                      >
                                        Justificación
                                      </Typography>

                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500 }}
                                      >
                                        {routingDecision.justification}
                                      </Typography>
                                    </Box>
                                  )}
                                </Box>
                              </Paper>
                            )}

                            {storage && typeof storage.state === "string" && (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                  gap: 1.5,
                                  mt: 3,
                                  pt: 2,
                                  borderTop: 1,
                                  borderColor: "divider",
                                }}
                              >
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  Almacenamiento
                                </Typography>

                                <Chip
                                  size="small"
                                  variant="outlined"
                                  color={
                                    storage.state === "SUCCESS"
                                      ? "success"
                                      : storage.state === "ERROR"
                                        ? "error"
                                        : "warning"
                                  }
                                  icon={
                                    storage.state === "SUCCESS" ? (
                                      <TaskAltIcon />
                                    ) : storage.state === "ERROR" ? (
                                      <ErrorIcon />
                                    ) : (
                                      <ScheduleIcon />
                                    )
                                  }
                                  label={
                                    storage.state === "SUCCESS"
                                      ? "Guardado correctamente"
                                      : storage.state === "ERROR"
                                        ? "Error al guardar"
                                        : "Guardado pendiente"
                                  }
                                  sx={{
                                    border: "none",
                                    fontWeight: 500,
                                    "& .MuiChip-icon": {
                                      fontSize: 18,
                                    },
                                  }}
                                />
                              </Box>
                            )}
                          </Box>
                        ) : (
                          <Box
                            component="pre"
                            sx={{
                              p: 2,
                              m: 0,
                              overflowX: "auto",
                              borderRadius: 1,
                              bgcolor: "action.hover",
                              fontSize: "0.8rem",
                            }}
                          >
                            {JSON.stringify(entry.result, null, 2)}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
}

export default HistoryPage;
