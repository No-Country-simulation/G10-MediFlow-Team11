import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import PageHeader from "../components/PageHeader";
import AuditPage from "../pages/AuditPage";
import LoginPage from "../pages/LoginPage";
import ProcessingPage from "../pages/ProcessingPage";

function ResultNavigationTarget() {
  return (
    <PageHeader
      title="Resultado del procesamiento"
      description="El documento se procesó correctamente. El detalle de clasificación, extracción y enrutamiento se completa en la vista de Resultado."
    />
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
          <Route path="result/:documentId" element={<ResultNavigationTarget />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;