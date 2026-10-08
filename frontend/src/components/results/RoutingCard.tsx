import {
  Alert,
  Box,
  Card,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import type {
  AuditReason,
  RoutingDecision,
  RoutingDestination,
} from "../../types/processing";

interface RoutingCardProps {
  routing: RoutingDecision;
}

const destinationLabels: Record<RoutingDestination, string> = {
  MEDICAL_EMERGENCY: "Emergencia médica",
  PHARMACY: "Farmacia",
  AUTHORIZATION_AUDIT: "Auditoría de autorizaciones",
  MEDICAL_RECORD: "Historia clínica",
  HUMAN_REVIEW: "Revisión humana",
};

const auditReasonLabels: Record<AuditReason, string> = {
  LOW_CONFIDENCE: "Confianza insuficiente",
  ILLEGIBLE_DOCUMENT: "Documento ilegible",
  MISSING_CRITICAL_FIELDS: "Faltan campos críticos",
  INCONSISTENT_DATA: "Datos inconsistentes",
  INVALID_AI_RESPONSE: "Respuesta de IA inválida",
  AI_TIMEOUT: "Tiempo de espera de IA agotado",
  AI_UNAVAILABLE: "Servicio de IA no disponible",
};

function RoutingCard({ routing }: RoutingCardProps) {
  const requiresReview = routing.requires_human_review;

  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Destino del documento
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={2} sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
          spacing={1}
        >
          <Typography variant="body2" color="text.secondary">
            Destino asignado:
          </Typography>

          <Chip
            label={destinationLabels[routing.primary_destination]}
            size="small"
            color={requiresReview ? "warning" : "primary"}
            variant="outlined"
          />
        </Stack>

        {routing.justification && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Justificación
            </Typography>

            <Typography variant="body2">{routing.justification}</Typography>
          </Box>
        )}

        {requiresReview && (
          <Alert severity="warning" variant="outlined">
            Este documento requiere revisión humana.
          </Alert>
        )}

        {routing.audit_reasons.length > 0 && (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Motivos de auditoría
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {routing.audit_reasons.map((reason) => (
                <Chip
                  key={reason}
                  label={auditReasonLabels[reason]}
                  size="small"
                  variant="outlined"
                  color="warning"
                />
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Card>
  );
}

export default RoutingCard;
