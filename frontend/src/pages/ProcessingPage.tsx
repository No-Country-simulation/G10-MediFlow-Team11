import { useState } from "react";
import type { MouseEvent } from "react";
import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import PageHeader from "../components/PageHeader";
import ProcessingResult from "../components/ProcessingResult";
import { env } from "../config/env";
import {
  aiTimeoutProcessingResponse,
  auditRequiredProcessingResponse,
  successfulProcessingResponse,
} from "../mocks/processingMocks";
import type { ProcessingResponse } from "../types/processing";

type DemoScenario = "processed" | "audit" | "ai-timeout";

const demoResponses: Record<DemoScenario, ProcessingResponse> = {
  processed: successfulProcessingResponse,
  audit: auditRequiredProcessingResponse,
  "ai-timeout": aiTimeoutProcessingResponse,
};

function ProcessingPage() {
  const [scenario, setScenario] = useState<DemoScenario>("processed");
  const handleScenarioChange = (
    _event: MouseEvent<HTMLElement>,
    value: DemoScenario | null,
  ) => {
    if (value) {
      setScenario(value);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Resultado del procesamiento"
        description="Consulta la clasificación, los datos extraídos y las decisiones de enrutamiento del documento."
      />

      {env.useMocks ? (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="overline" color="text.secondary">
            Respuesta simulada
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={scenario}
            onChange={handleScenarioChange}
            aria-label="Seleccionar respuesta simulada"
            sx={{ display: "flex", width: "fit-content", maxWidth: "100%", mt: 0.5 }}
          >
            <ToggleButton value="processed">Procesado</ToggleButton>
            <ToggleButton value="audit">Revisión humana</ToggleButton>
            <ToggleButton value="ai-timeout">Sin respuesta de IA</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      ) : null}

      {env.useMocks ? (
        <ProcessingResult result={demoResponses[scenario]} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          El resultado aparecerá aquí cuando se complete el procesamiento de un documento.
        </Typography>
      )}
    </Box>
  );
}

export default ProcessingPage;