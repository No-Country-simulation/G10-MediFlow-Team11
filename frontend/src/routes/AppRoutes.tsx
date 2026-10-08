import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AuditPage from "../pages/AuditPage";
import LoginPage from "../pages/LoginPage";
import ProcessingPage from "../pages/ProcessingPage";
import ResultPage from "../pages/ResultPage";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/processing" replace />} />
          <Route path="processing" element={<ProcessingPage />} />
          <Route path="results/:documentId" element={<ResultPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
