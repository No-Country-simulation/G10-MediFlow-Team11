import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import AuditPage from "../pages/AuditPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import ProcessingPage from "../pages/ProcessingPage";
import ResultPage from "../pages/ResultPage";
import HistoryPage from "../pages/HistoryPage";
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
        </Route>
      </>
  ),
);

function AppRoutes() {
  return <RouterProvider router={router} />;
}

export default AppRoutes;
