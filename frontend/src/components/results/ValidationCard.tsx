import { Alert, Box, Card, Divider, Stack, Typography } from "@mui/material";
import type { AlertColor } from "@mui/material";
import type { Validation } from "../../types/processing";

interface ValidationCardProps {
  validation: Validation;
}

interface ValidationSection {
  title: string;
  severity: AlertColor;
  items: string[];
}

function ValidationCard({ validation }: ValidationCardProps) {
  const sections: ValidationSection[] = [
    {
      title: "Campos faltantes",
      severity: "warning",
      items: validation.missing_fields,
    },
    {
      title: "Inconsistencias",
      severity: "error",
      items: validation.inconsistencies,
    },
    {
      title: "Advertencias",
      severity: "info",
      items: validation.warnings,
    },
  ];

  const visibleSections = sections.filter(
    (section) => section.items.length > 0,
  );

  if (visibleSections.length === 0) {
    return null;
  }

  return (
    <Card variant="outlined">
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Validación del documento
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={2} sx={{ p: 2 }}>
        {visibleSections.map((section) => (
          <Alert
            key={section.title}
            severity={section.severity}
            variant="outlined"
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {section.title}
            </Typography>

            <Box
              component="ul"
              sx={{
                mt: 1,
                mb: 0,
                pl: 2,
                overflowWrap: "anywhere",
              }}
            >
              {section.items.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <Typography variant="body2">{item}</Typography>
                </li>
              ))}
            </Box>
          </Alert>
        ))}
      </Stack>
    </Card>
  );
}

export default ValidationCard;
