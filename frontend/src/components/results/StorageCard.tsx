import { Box, Card, Chip, Divider, Stack, Typography } from "@mui/material";
import type { ChipProps } from "@mui/material";
import type { Storage, StorageState } from "../../types/processing";

interface StorageCardProps {
  storage: Storage;
}

const storageStatusConfig: Record<
  StorageState,
  { label: string; color: ChipProps["color"] }
> = {
  PENDING: { label: "Pendiente", color: "warning" },
  SUCCESS: { label: "Guardado correctamente", color: "success" },
  ERROR: { label: "Error de almacenamiento", color: "error" },
};

function StorageCard({ storage }: StorageCardProps) {
  const status = storageStatusConfig[storage.state];

  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Almacenamiento
        </Typography>
      </Box>

      <Divider />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          p: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Estado del documento
        </Typography>

        <Chip
          label={status.label}
          color={status.color}
          size="small"
          variant="outlined"
        />
      </Stack>
    </Card>
  );
}

export default StorageCard;
