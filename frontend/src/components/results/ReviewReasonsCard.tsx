import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Alert, AlertTitle, Box, Typography } from "@mui/material";
import type { AuditReason } from "../../types/processing";
import { alpha } from "@mui/material/styles";

interface ReviewReasonsCardProps {
  reasons: AuditReason[];
}

const auditReasonLabels: Record<AuditReason, string> = {
  LOW_CONFIDENCE: "Confianza de extracción por debajo del umbral requerido",
  ILLEGIBLE_DOCUMENT: "El documento presenta información ilegible",
  MISSING_CRITICAL_FIELDS: "Faltan campos críticos para validar el documento",
  INCONSISTENT_DATA: "Se detectaron datos inconsistentes",
  INVALID_AI_RESPONSE: "La respuesta del sistema no es válida",
  AI_TIMEOUT: "Se agotó el tiempo de espera del procesamiento",
  AI_UNAVAILABLE: "El servicio de procesamiento no está disponible",
};

function ReviewReasonsCard({ reasons }: ReviewReasonsCardProps) {
  if (reasons.length === 0) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      variant="outlined"
      icon={<WarningAmberOutlinedIcon fontSize="inherit" />}
      sx={{
        alignItems: "flex-start",
        backgroundColor: alpha("#FF9800", 0.03),
      }}
    >
      <Box
        sx={{
          borderBottom: 1,
          borderColor: alpha("#FF9800", 1),
          mb: 1,
        }}
      >
        <AlertTitle sx={{ fontWeight: 600, color: "warning.main" }}>
          Motivos de revisión
        </AlertTitle>
      </Box>
      <Typography variant="body2" sx={{ mb: 1, color: "text.secondary" }}>
        Este documento ha sido derivado a revisión manual. La información
        disponible puede ser parcial o no verificada.
      </Typography>

      <Box component="ul" sx={{ m: 0, pl: 2 }}>
        {reasons.map((reason) => (
          <Typography
            component="li"
            variant="body2"
            key={reason}
            sx={{ mb: 0.5 }}
          >
            {auditReasonLabels[reason]}
          </Typography>
        ))}
      </Box>
    </Alert>
  );
}

export default ReviewReasonsCard;
