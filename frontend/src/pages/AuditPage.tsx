import { Alert, Stack } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";

function AuditPage() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("documentId");

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Auditoría de documentos"
        description="Revisa los documentos derivados a revisión humana por baja confianza, ambigüedad o inconsistencias."
      />

      {documentId && (
        <Alert severity="info" variant="outlined">
          Documento seleccionado para auditoría: <strong>{documentId}</strong>
        </Alert>
      )}
    </Stack>
  );
}

export default AuditPage;
