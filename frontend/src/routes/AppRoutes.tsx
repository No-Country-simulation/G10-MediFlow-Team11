import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AuditPage from "../pages/AuditPage";
import SettingsPage from "../pages/SettingsPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import ProcessingPage from "../pages/ProcessingPage";
import ResultPage from "../pages/ResultPage";
import HistoryPage from "../pages/HistoryPage";
import HelpPage from "../pages/HelpPage";
import ClinicalReviewPage from "../pages/ClinicalReviewPage";

const router = createBrowserRouter(
  createRoutesFromElements(
      <>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="processing" element={<ProcessingPage />} />
          <Route path="results/:documentId" element={<ResultPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="audit/:documentId/review" element={<ClinicalReviewPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </>
  ),
);

function AppRoutes() {
  return <RouterProvider router={router} />;
}

export default AppRoutes;
