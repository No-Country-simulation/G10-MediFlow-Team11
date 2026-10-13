import { Box, Card, Chip, Divider, Stack, Typography } from "@mui/material";
import type {
  Confidence,
  DocumentClassification,
  DocumentType,
  PriorityLevel,
} from "../../types/processing";

interface ProcessingSummaryProps {
  classification: DocumentClassification | null;
  confidence: Confidence | null;
}

const documentTypeLabels: Record<DocumentType, string> = {
  PRESCRIPTION: "Receta médica",
  IMAGING_REPORT: "Informe de imágenes",
  STUDY_REPORT: "Informe de estudio",
  PROCEDURE_ORDER: "Orden de procedimiento",
  DISCHARGE_SUMMARY: "Resumen de alta",
  MEDICAL_CERTIFICATE: "Certificado médico",
};

const priorityLabels: Record<PriorityLevel, string> = {
  ROUTINE: "Rutinaria",
  URGENT: "Urgente",
};

function ProcessingSummary({
  classification,
  confidence,
}: ProcessingSummaryProps) {
  if (!classification && !confidence) {
    return null;
  }

  const confidenceMetrics = confidence
    ? [
        { label: "Confianza global", value: confidence.global },
        {
          label: "Confianza de clasificación",
          value: confidence.classification,
        },
        {
          label: "Confianza de extracción",
          value: confidence.extraction,
        },
      ]
    : [];

  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Resumen del procesamiento
        </Typography>
      </Box>

      <Divider />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm:
              classification && confidence
                ? "minmax(0, 3fr) minmax(0, 2fr)"
                : "1fr",
          },
        }}
      >
        {classification && (
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <Stack
              direction="row"
              sx={{ justifyContent: "space-between" }}
              spacing={2}
            >
              <Typography variant="body2" color="text.secondary">
                Tipo de documento
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, textAlign: "right" }}
              >
                {documentTypeLabels[classification.document_type]}
              </Typography>
            </Stack>

            {classification.specialty && (
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between" }}
                spacing={2}
              >
                <Typography variant="body2" color="text.secondary">
                  Especialidad
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, textAlign: "right" }}
                >
                  {classification.specialty}
                </Typography>
              </Stack>
            )}

            <Stack
              direction="row"
              sx={{ justifyContent: "space-between" }}
              spacing={2}
            >
              <Typography variant="body2" color="text.secondary">
                Prioridad
              </Typography>
              <Chip
                label={priorityLabels[classification.priority_level]}
                size="small"
                color={
                  classification.priority_level === "URGENT"
                    ? "warning"
                    : "default"
                }
                variant="outlined"
              />
            </Stack>
          </Stack>
        )}

        {confidence && (
          <Stack
            spacing={1.5}
            sx={(theme) => ({
              p: 2,
              borderLeft: {
                xs: "none",
                sm: classification
                  ? `1px solid ${theme.palette.divider}`
                  : "none",
              },
              borderTop: {
                xs: classification
                  ? `1px solid ${theme.palette.divider}`
                  : "none",
                sm: "none",
              },
            })}
          >
            {confidenceMetrics.map((metric) => {
              const percentage = Math.round(metric.value * 100);

              return (
                <Stack key={metric.label} spacing={0.5}>
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    spacing={1}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {metric.label}
                    </Typography>

                    <Typography
                      variant={
                        metric.label === "Confianza global" ? "h5" : "body2"
                      }
                      sx={{
                        fontWeight:
                          metric.label === "Confianza global" ? 700 : 600,
                        lineHeight: 1.2,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {percentage}%
                    </Typography>
                  </Stack>

                  <Box
                    sx={{
                      position: "relative",
                      height: 14,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <Box
                      sx={{
                        width: "100%",
                        height: "1px",
                        bgcolor: "divider",
                      }}
                    />

                    <Box
                      sx={{
                        position: "absolute",
                        left: `${Math.max(0, Math.min(100, percentage))}%`,
                        top: "50%",
                        width: 9,
                        height: 9,
                        bgcolor: "background.paper",
                        border: 1.5,
                        borderColor: "primary.main",
                        transform: "translate(-50%, -50%) rotate(45deg)",
                      }}
                    />
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>
    </Card>
  );
}

export default ProcessingSummary;
