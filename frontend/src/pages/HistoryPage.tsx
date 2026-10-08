import { Box, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";

function HistoryPage() {
  const [searchParams] = useSearchParams();
  const documentId = searchParams.get("documentId");

  return (
    <>
      <PageHeader
        title="Historial de documentos"
        description="Consulte el historial de documentos procesados."
      />
      <Box>
        <Typography variant="body1" color="text.secondary">
          {documentId
            ? `Historial del documento: ${documentId}`
            : "Documento no especificado."}
        </Typography>
      </Box>
    </>
  );
}

export default HistoryPage;
