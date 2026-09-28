import type { ReactNode } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import type { ProcessingResponse } from "../types/processing";

type ProcessingResultProps = {
  result: ProcessingResponse;
};

const labels: Record<string, string> = {
  age: "Edad",
  classification: "Clasificación",
  document_type: "Tipo de documento",
  extraction: "Extracción",
  global: "General",
  license_number: "Matrícula profesional",
  medications: "Medicamentos",
  name: "Nombre",
  patient: "Paciente",
  priority_level: "Prioridad",
  primary_diagnosis: "Diagnóstico principal",
  requested_studies: "Estudios solicitados",
  requesting_doctor: "Profesional solicitante",
  specialty: "Especialidad",
  suggested_icd10: "CIE-10 sugerido",
};

const auditReasonLabels: Record<string, string> = {
  AI_TIMEOUT: "Tiempo de espera de IA agotado",
  AI_UNAVAILABLE: "Servicio de IA no disponible",
  ILLEGIBLE_DOCUMENT: "Documento ilegible",
  INCONSISTENT_DATA: "Datos inconsistentes",
  INVALID_AI_RESPONSE: "Respuesta de IA no válida",
  LOW_CONFIDENCE: "Confianza baja",
  MISSING_CRITICAL_FIELDS: "Faltan campos críticos",
};

const statusLabels: Record<string, string> = {
  APPROVED: "Aprobado",
  FAILED: "Fallido",
  NEEDS_AUDIT: "Requiere revisión humana",
  PROCESSING: "En procesamiento",
  PROCESSED: "Procesado",
  RECEIVED: "Recibido",
  REJECTED: "Rechazado",
};

const destinationLabels: Record<string, string> = {
  AUTHORIZATION_AUDIT: "Auditoría de autorizaciones",
  HUMAN_REVIEW: "Revisión humana",
  MEDICAL_EMERGENCY: "Emergencias médicas",
  MEDICAL_RECORD: "Historia clínica",
  PHARMACY: "Farmacia",
};

const documentTypeLabels: Record<string, string> = {
  DISCHARGE_SUMMARY: "Resumen de alta",
  IMAGING_REPORT: "Informe de imágenes",
  MEDICAL_CERTIFICATE: "Certificado médico",
  PRESCRIPTION: "Receta médica",
  PROCEDURE_ORDER: "Orden de procedimiento",
  STUDY_REPORT: "Informe de estudio",
};

const hiddenInfrastructureKeys = new Set([
  "provider",
]);

function formatLabel(key: string): string {
  if (labels[key]) {
    return labels[key];
  }

  return key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isInfrastructureKey(key: string): boolean {
  const normalizedKey = key.toLowerCase().replaceAll("_", "");

  return (
    hiddenInfrastructureKeys.has(normalizedKey) ||
    normalizedKey.includes("bucket") ||
    normalizedKey.includes("namespace") ||
    normalizedKey.endsWith("objectkey") ||
    normalizedKey.endsWith("path") ||
    normalizedKey.endsWith("prefix")
  );
}

function formatFinding(item: string): string {
  if (/^[a-z0-9_]+(\.[a-z0-9_]+)*$/i.test(item)) {
    return item.split(".").map(formatLabel).join(" / ");
  }

  return item;
}

function renderExtractedValue(value: unknown, depth = 0): ReactNode {
  if (value === null || value === undefined || value === "") {
    return (
      <Typography variant="body2" color="text.secondary">
        No disponible
      </Typography>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          Sin elementos registrados
        </Typography>
      );
    }

    return (
      <Stack spacing={1}>
        {value.map((item, index) => (
          <Box key={`${depth}-${index}`}>
            {value.length > 1 && (
              <Typography variant="caption" color="text.secondary">
                Elemento {index + 1}
              </Typography>
            )}
            {renderExtractedValue(item, depth + 1)}
          </Box>
        ))}
      </Stack>
    );
  }

  if (typeof value === "object") {
    const visibleEntries = Object.entries(value as Record<string, unknown>).filter(
      ([key]) => !isInfrastructureKey(key),
    );

    if (visibleEntries.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          Sin datos disponibles
        </Typography>
      );
    }

    return (
      <Stack spacing={1}>
        {visibleEntries.map(([key, nestedValue]) => (
          <Box key={key}>
            <Typography variant="caption" color="text.secondary">
              {formatLabel(key)}
            </Typography>
            {renderExtractedValue(nestedValue, depth + 1)}
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
      {String(value)}
    </Typography>
  );
}

function SectionCard({
  title,
  children,
  sx,
}: {
  title: string;
  children: ReactNode;
  sx?: Record<string, unknown>;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%", borderRadius: 2, ...sx }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function Findings({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        {title}
      </Typography>
      {items.length > 0 ? (
        <Stack spacing={0.75}>
          {items.map((item, index) => (
            <Typography key={`${title}-${index}`} variant="body2" color="text.secondary">
              {formatFinding(item)}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Sin hallazgos
        </Typography>
      )}
    </Box>
  );
}

function ProcessingResult({ result }: ProcessingResultProps) {
  const needsAudit = result.status === "NEEDS_AUDIT";
  const extractedEntries = result.extracted_data
    ? Object.entries(result.extracted_data).filter(
        ([key, value]) => !isInfrastructureKey(key) && value !== undefined,
      )
    : [];

  return (
    <Stack spacing={2}>
      {needsAudit && (
        <Alert severity="warning" variant="outlined">
          <AlertTitle sx={{ fontWeight: 600 }}>Requiere revisión humana</AlertTitle>
          {result.routing_decision.audit_reasons.length > 0 ? (
            <Stack
              direction="row"
              useFlexGap
              spacing={1}
              sx={{ mt: 1, flexWrap: "wrap" }}
            >
              {result.routing_decision.audit_reasons.map((reason) => (
                <Chip
                  key={reason}
                  size="small"
                  color="warning"
                  label={auditReasonLabels[reason] ?? formatLabel(reason)}
                />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2">El documento está pendiente de revisión.</Typography>
          )}
        </Alert>
      )}

      {result.notification.generated && (
        <Alert severity="error" variant="filled">
          <AlertTitle sx={{ fontWeight: 600 }}>Notificación urgente</AlertTitle>
          {result.notification.message}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary">
                Identificador del documento
              </Typography>
              <Typography variant="h6" component="p" sx={{ overflowWrap: "anywhere" }}>
                {result.document_id}
              </Typography>
            </Box>
            <Chip
              color={needsAudit ? "warning" : result.status === "PROCESSED" ? "success" : "default"}
              label={statusLabels[result.status] ?? formatLabel(result.status)}
            />
          </Stack>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          gap: 2,
        }}
      >
        <SectionCard title="Clasificación">
          {result.classification ? (
            <Stack spacing={1.5}>
              <Field label="Tipo de documento">
                {documentTypeLabels[result.classification.document_type] ??
                  formatLabel(result.classification.document_type)}
              </Field>
              <Field label="Especialidad">
                {result.classification.specialty ?? "No disponible"}
              </Field>
              <Field label="Prioridad">
                <Chip
                  size="small"
                  color={result.classification.priority_level === "URGENT" ? "error" : "default"}
                  label={result.classification.priority_level === "URGENT" ? "Urgente" : "Rutinaria"}
                />
              </Field>
            </Stack>
          ) : (
            <FallbackMessage>No se obtuvo una clasificación válida.</FallbackMessage>
          )}
        </SectionCard>

        <SectionCard title="Confianza">
          {result.confidence ? (
            <Stack spacing={1.5}>
              <ConfidenceValue label="Clasificación" value={result.confidence.classification} />
              <Divider />
              <ConfidenceValue label="Extracción" value={result.confidence.extraction} />
              <Divider />
              <ConfidenceValue label="Global" value={result.confidence.global} />
            </Stack>
          ) : (
            <FallbackMessage>No se calcularon valores de confianza.</FallbackMessage>
          )}
        </SectionCard>

        <SectionCard title="Datos extraídos" sx={{ gridColumn: { md: "1 / -1" } }}>
          {result.extracted_data && extractedEntries.length > 0 ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                gap: 2,
              }}
            >
              {extractedEntries.map(([key, value]) => (
                <Box key={key} sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                    {formatLabel(key)}
                  </Typography>
                  {renderExtractedValue(value)}
                </Box>
              ))}
            </Box>
          ) : (
            <FallbackMessage>No hay datos extraídos disponibles para este documento.</FallbackMessage>
          )}
        </SectionCard>

        <SectionCard title="Validación">
          {result.validation ? (
            <Stack spacing={2}>
              <Findings title="Campos faltantes" items={result.validation.missing_fields} />
              <Findings title="Inconsistencias" items={result.validation.inconsistencies} />
              <Findings title="Advertencias" items={result.validation.warnings} />
            </Stack>
          ) : (
            <FallbackMessage>No se pudo completar la validación automática.</FallbackMessage>
          )}
        </SectionCard>

        <SectionCard title="Enrutamiento">
          <Stack spacing={1.5}>
            <Field label="Destino">
              {destinationLabels[result.routing_decision.primary_destination] ??
                formatLabel(result.routing_decision.primary_destination)}
            </Field>
            <Field label="Justificación">{result.routing_decision.justification}</Field>
            <Field label="Revisión humana">
              {result.routing_decision.requires_human_review ? "Requerida" : "No requerida"}
            </Field>
          </Stack>
        </SectionCard>

        <SectionCard title="Almacenamiento">
          <Chip
            size="small"
            color={
              result.storage.state === "SUCCESS"
                ? "success"
                : result.storage.state === "ERROR"
                  ? "error"
                  : "default"
            }
            label={
              result.storage.state === "SUCCESS"
                ? "Guardado"
                : result.storage.state === "ERROR"
                  ? "Error de almacenamiento"
                  : "Pendiente"
            }
          />
        </SectionCard>
      </Box>
    </Stack>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box>{children}</Box>
    </Box>
  );
}

function ConfidenceValue({ label, value }: { label: string; value: number }) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ justifyContent: "space-between" }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {Math.round(value * 100)}%
      </Typography>
    </Stack>
  );
}

function FallbackMessage({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 0.5 }}>
      {children}
    </Typography>
  );
}

export default ProcessingResult;