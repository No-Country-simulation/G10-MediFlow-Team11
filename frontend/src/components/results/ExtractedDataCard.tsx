import { Box, Card, Divider, Stack, Typography } from "@mui/material";
import type { ExtractedData } from "../../types/processing";
import { buildExtractedDataRows } from "./extractedDataRows";

interface ExtractedDataCardProps {
  data: ExtractedData;
}

function ExtractedDataCard({ data }: ExtractedDataCardProps) {
  const rows = buildExtractedDataRows(data);

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Datos clínicos extraídos
        </Typography>
      </Box>

      <Divider />

      <Stack divider={<Divider flexItem />}>
        {rows.map((row) => (
          <Box
            key={row.label}
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "minmax(140px, 35%) 1fr",
              },
              gap: { xs: 0.5, sm: 2 },
              px: 2,
              py: 1.5,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {row.label}
            </Typography>

            {Array.isArray(row.value) ? (
              <Box
                component="ul"
                sx={{
                  m: 0,
                  pl: 2,
                  overflowWrap: "anywhere",
                }}
              >
                {row.value.map((item, index) => (
                  <Typography
                    component="li"
                    variant="body2"
                    key={`${item}-${index}`}
                    sx={{ fontWeight: 600, mb: 0.5 }}
                  >
                    {item}
                  </Typography>
                ))}
              </Box>
            ) : (
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, overflowWrap: "anywhere" }}
              >
                {row.value}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Card>
  );
}

export default ExtractedDataCard;
