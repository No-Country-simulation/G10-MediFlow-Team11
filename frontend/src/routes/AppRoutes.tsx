import {
  BrowserRouter,
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AuditPage from "../pages/AuditPage";
import LoginPage from "../pages/LoginPage";
import ProcessingPage from "../pages/ProcessingPage";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

function ResultHandoffStub() {
  return (
    <Box sx={{ maxWidth: 800, mx: "auto", mt: 4, px: 2 }}>
      <Paper elevation={1} sx={{ p: 4 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5" component="h1" gutterBottom>
              Vista de Resultados
            </Typography>
            <Typography variant="subtitle2" color="text.secondary">
              Implementación asignada al Issue #20
            </Typography>
          </Box>
          <Divider />
          <Typography variant="body1">
            El procesamiento ha finalizado correctamente. Esta página
            provisional será sustituida por la vista oficial de resultados
            cuando se complete el Issue #20.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", pt: 1 }}>
            <Button
              variant="contained"
              component={RouterLink}
              to="/processing"
            >
              Procesar otro documento
            </Button>
            <Button variant="outlined" component={RouterLink} to="/audit">
              Ir a Auditoría
            </Button>
            <Button variant="text" component={RouterLink} to="/">
              Volver al inicio
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/processing" replace />} />
          <Route path="processing" element={<ProcessingPage />} />
          <Route path="result" element={<ResultHandoffStub />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;