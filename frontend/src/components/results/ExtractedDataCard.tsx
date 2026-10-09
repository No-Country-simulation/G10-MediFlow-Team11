import { Box, Card, Divider, Stack, Typography } from "@mui/material";
import type { ExtractedData } from "../../types/processing";

interface ExtractedDataCardProps {
  data: ExtractedData;
}

interface DataRow {
  label: string;
  value: string | string[];
}

function ExtractedDataCard({ data }: ExtractedDataCardProps) {
  const rows: DataRow[] = [];

  if (data.patient?.name) {
    rows.push({
      label: "Paciente",
      value: data.patient.name,
    });
  }

  if (data.patient?.age != null) {
    rows.push({
      label: "Edad",
      value: `${data.patient.age} años`,
    });
  }

  if (data.requesting_doctor?.name) {
    rows.push({
      label: "Médico responsable",
      value: data.requesting_doctor.name,
    });
  }

  if (data.requesting_doctor?.license_number) {
    rows.push({
      label: "Cédula profesional",
      value: data.requesting_doctor.license_number,
    });
  }

  if (data.primary_diagnosis) {
    rows.push({
      label: "Diagnóstico principal",
      value: data.primary_diagnosis,
    });
  }

  if (data.suggested_icd10) {
    rows.push({
      label: "Código CIE-10 sugerido",
      value: data.suggested_icd10,
    });
  }

  if (data.medications?.length) {
    const medications = data.medications
      .filter((medication) => medication.name)
      .map((medication) =>
        [medication.name, medication.dosage].filter(Boolean).join(" "),
      );

    if (medications.length > 0) {
      rows.push({
        label: "Medicamentos",
        value: medications,
      });
    }
  }

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
                    sx={{ mb: 0.5 }}
                  >
                    {item}
                  </Typography>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
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
