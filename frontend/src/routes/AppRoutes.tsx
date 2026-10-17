import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AuditPage from "../pages/AuditPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import ProcessingPage from "../pages/ProcessingPage";
import ResultPage from "../pages/ResultPage";
import HistoryPage from "../pages/HistoryPage";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="processing" element={<ProcessingPage />} />
          <Route path="results/:documentId" element={<ResultPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
