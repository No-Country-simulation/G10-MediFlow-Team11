import {
  Alert,
  Box,
  Card,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type {
  AuditReason,
  RoutingDecision,
  RoutingDestination,
  Storage,
} from "../../types/processing";

interface RoutingCardProps {
  routing: RoutingDecision;
  storage: Storage;
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

function RoutingCard({ routing, storage }: RoutingCardProps) {
  const storageLabels = {
    PENDING: "Almacenamiento pendiente",
    SUCCESS: "Guardado correctamente",
    ERROR: "Error de almacenamiento",
  } as const;

  const storageColors = {
    PENDING: "warning.main",
    SUCCESS: "success.main",
    ERROR: "error.main",
  } as const;

  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Enrutamiento
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={2} sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            p: 2,
            bgcolor: "action.hover",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <DescriptionOutlinedIcon color="primary" />

          <Box>
            <Typography variant="caption" color="text.secondary">
              Destino principal
            </Typography>

            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {destinationLabels[routing.primary_destination]}
            </Typography>
          </Box>
        </Box>

        {routing.justification && (
          <>
            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Justificación
              </Typography>

              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {routing.justification}
              </Typography>
            </Box>
          </>
        )}

        {routing.requires_human_review && (
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
                  color="warning"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}

        <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
          {storage.state === "SUCCESS" ? (
            <CheckOutlinedIcon sx={{ color: storageColors[storage.state] }} />
          ) : (
            <InfoOutlinedIcon sx={{ color: storageColors[storage.state] }} />
          )}

          <Typography
            variant="body2"
            sx={{ color: storageColors[storage.state] }}
          >
            {storageLabels[storage.state]}
          </Typography>
        </Stack>
      </Stack>
    </Card>
  );
}

export default RoutingCard;
