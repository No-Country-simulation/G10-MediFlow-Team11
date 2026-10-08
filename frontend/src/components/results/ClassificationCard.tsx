import { Card, CardContent, Stack, Typography } from "@mui/material";
import type {
  DocumentClassification,
  DocumentType,
  PriorityLevel,
} from "../../types/processing";

interface ClassificationCardProps {
  classification: DocumentClassification;
}

const documentTypeLabels: Record<DocumentType, string> = {
  PRESCRIPTION: "Receta médica",
  IMAGING_REPORT: "Informe de imágenes",
  STUDY_REPORT: "Informe de estudio",
  PROCEDURE_ORDER: "Orden de procedimiento",
  DISCHARGE_SUMMARY: "Epicrisis",
  MEDICAL_CERTIFICATE: "Certificado médico",
};

const priorityLabels: Record<PriorityLevel, string> = {
  ROUTINE: "Rutina",
  URGENT: "Urgente",
};

function ClassificationCard({ classification }: ClassificationCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h6">Clasificación del documento</Typography>

          <Stack spacing={1}>
            <Typography>
              <strong>Tipo:</strong>{" "}
              {documentTypeLabels[classification.document_type]}
            </Typography>

            {classification.specialty && (
              <Typography>
                <strong>Especialidad:</strong> {classification.specialty}
              </Typography>
            )}

            <Typography>
              <strong>Prioridad:</strong>{" "}
              {priorityLabels[classification.priority_level]}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default ClassificationCard;
