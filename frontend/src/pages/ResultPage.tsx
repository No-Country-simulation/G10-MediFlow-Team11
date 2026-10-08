import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { getDocumentResult } from "../services/resultService";
import type { ProcessingResponse } from "../types/processing";
import ResultStatus from "../components/results/ResultStatus";
import ProcessingSummary from "../components/results/ProcessingSummary";
import ExtractedDataCard from "../components/results/ExtractedDataCard";
import ValidationCard from "../components/results/ValidationCard";
import RoutingCard from "../components/results/RoutingCard";
import NotificationCard from "../components/results/NotificationCard";
import StorageCard from "../components/results/StorageCard";

function ResultPage() {
  const { documentId } = useParams<{ documentId: string }>();

  const [result, setResult] = useState<ProcessingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function loadResult() {
      setLoading(true);
      setResult(null);
      setError(null);

      try {
        const data = documentId ? await getDocumentResult(documentId) : null;

        if (active) {
          setResult(data);
        }
      } catch (error: unknown) {
        if (active) {
          setError(
            error instanceof Error
              ? error.message
              : "Ocurrió un error al consultar el documento.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadResult();

    return () => {
      active = false;
    };
  }, [documentId]);

  return (
    <>
      <PageHeader
        title="Resultado del procesamiento"
        description="Consulta el estado y la información obtenida del documento."
      />

      {loading ? (
        <CircularProgress />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : !result ? (
        <Alert severity="warning">
          No se encontró el documento solicitado.
        </Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              lg: "1fr 1fr",
            },
            gap: 2,
            alignItems: "start",
          }}
        >
          {/* Panel de resultados */}
          <Paper variant="outlined" sx={{ minWidth: 0 }}>
            <Stack spacing={2} sx={{ p: 2 }}>
              <Stack
                direction="row"
                sx={{
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Resultado
                </Typography>

                <Button
                  size="small"
                  startIcon={<HistoryOutlinedIcon />}
                  onClick={() =>
                    navigate(
                      `/history?documentId=${encodeURIComponent(result.document_id)}`,
                    )
                  }
                >
                  Ver historial
                </Button>
              </Stack>

              <Divider />

              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  justifyContent: "space-between",
                  alignItems: { xs: "flex-start", sm: "center" },
                }}
                spacing={2}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
                  spacing={1}
                >
                  <Typography variant="body2" color="text.secondary">
                    Documento
                  </Typography>

                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {result.document_id}
                  </Typography>

                  <Button
                    size="small"
                    startIcon={<ContentCopyOutlinedIcon />}
                    onClick={() => {
                      void navigator.clipboard.writeText(result.document_id);
                    }}
                  >
                    Copiar ID
                  </Button>
                </Stack>

                <ResultStatus status={result.status} />
              </Stack>

              <Divider />

              <ProcessingSummary
                classification={result.classification}
                confidence={result.confidence}
              />
              {result.extracted_data && (
                <ExtractedDataCard data={result.extracted_data} />
              )}
              {result.validation && (
                <ValidationCard validation={result.validation} />
              )}
              <RoutingCard routing={result.routing_decision} />
              {result.status === "NEEDS_AUDIT" && (
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() =>
                    navigate(
                      `/audit?documentId=${encodeURIComponent(result.document_id)}`,
                    )
                  }
                >
                  Continuar a auditoría
                </Button>
              )}

              <NotificationCard notification={result.notification} />

              <StorageCard storage={result.storage} />
            </Stack>
          </Paper>

          {/* Panel del documento */}
          <Paper variant="outlined" sx={{ minWidth: 0 }}>
            <Stack spacing={2} sx={{ p: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Documento
              </Typography>

              <Divider />

              <Box
                sx={{
                  minHeight: { xs: 320, lg: 600 },
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  bgcolor: "action.hover",
                  borderRadius: 1,
                  p: 3,
                }}
              >
                <Stack spacing={1} sx={{ alignItems: "center" }}>
                  <Typography color="text.secondary">
                    Vista previa no disponible
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: "center" }}
                  >
                    El visor del documento se integrará cuando esté disponible
                    el servicio correspondiente.
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Box>
      )}
    </>
  );
}

export default ResultPage;
