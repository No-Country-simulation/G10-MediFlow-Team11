import { Box, Card, Divider, Stack, Typography } from "@mui/material";
import type { Validation } from "../../types/processing";

interface ValidationCardProps {
  validation: Validation;
}

interface ValidationSection {
  title: string;
  color: string;
  items: string[];
}

const fieldLabels: Record<string, string> = {
  "patient.name": "Nombre del paciente",
  "patient.age": "Edad del paciente",
  "requesting_doctor.name": "Nombre del médico responsable",
  "requesting_doctor.license_number":
    "Cédula profesional del médico responsable",
  primary_diagnosis: "Diagnóstico principal",
  suggested_icd10: "Código CIE-10 sugerido",
};

function formatMissingField(field: string): string {
  return fieldLabels[field] ?? field;
}

function ValidationCard({ validation }: ValidationCardProps) {
  const sections: ValidationSection[] = [
    {
      title: "Campos faltantes",
      color: "warning.main",
      items: validation.missing_fields.map(formatMissingField),
    },
    {
      title: "Inconsistencias",
      color: "error.main",
      items: validation.inconsistencies,
    },
    {
      title: "Advertencias",
      color: "warning.main",
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
          Hallazgos de validación
        </Typography>
      </Box>

      <Divider />

      <Stack spacing={2} sx={{ p: 2 }}>
        {visibleSections.map((section) => (
          <Stack key={section.title} spacing={1}>
            <Stack direction="row" sx={{ alignItems: "center" }} spacing={1}>
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: section.color,
                  flexShrink: 0,
                }}
              />

              <Typography
                variant="body2"
                sx={{ fontWeight: 500, color: section.color }}
              >
                {section.title}
              </Typography>
            </Stack>

            <Stack spacing={0.75} sx={{ pl: 2 }}>
              {section.items.map((item, index) => (
                <Stack
                  key={`${item}-${index}`}
                  direction="row"
                  sx={{ alignItems: "flex-start" }}
                  spacing={1}
                >
                  <Typography
                    variant="body2"
                    color="text.disabled"
                    aria-hidden="true"
                  >
                    –
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ overflowWrap: "anywhere" }}
                  >
                    {item}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}

export default ValidationCard;
