import { Chip } from "@mui/material";
import type { ChipProps } from "@mui/material";
import type { DocumentStatus } from "../../types/processing";

interface ResultStatusProps {
  status: DocumentStatus;
}

const statusConfig: Record<
  DocumentStatus,
  { label: string; color: ChipProps["color"] }
> = {
  RECEIVED: { label: "Recibido", color: "default" },
  PROCESSING: { label: "Procesando", color: "info" },
  PROCESSED: { label: "Procesado", color: "success" },
  NEEDS_AUDIT: { label: "Requiere auditoría", color: "warning" },
  APPROVED: { label: "Aprobado", color: "success" },
  REJECTED: { label: "Rechazado", color: "error" },
  FAILED: { label: "Fallido", color: "error" },
};

function ResultStatus({ status }: ResultStatusProps) {
  const config = statusConfig[status];

  return (
    <Chip
      label={config.label}
      color={config.color}
      variant="outlined"
      size="medium"
    />
  );
}

export default ResultStatus;
