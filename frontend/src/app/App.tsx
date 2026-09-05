import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../lib/firebase/authContext";
import type { ReactNode } from "react";
import LandingPage from "../pages/LandingPage";
import DashboardPage from "../pages/DashboardPage";
import ObservationsPage from "../pages/ObservationsPage";
import ObservationDetailPage from "../pages/ObservationDetailPage";
import ObservationFormPage from "../pages/ObservationFormPage";
import { ConversationsPage } from "../pages/ConversationsPage";
import { Layout } from "../components/Layout";
import ProjectsPage from "../pages/ProjectsPage";
import ProjectDetailPage from "../pages/ProjectDetailPage";
import SettingsPage from "../pages/SettingsPage";

import { ResearchTasksPage } from "../pages/ResearchTasksPage";
import { AskMyJournalPage } from "../pages/AskMyJournalPage";
import { ToastProvider } from "../components/ui/Toast";

// Leaflet + its assets are heavy; split them out of the initial bundle so
// only map routes pay the download cost.
const ResearchMapPage = lazy(() =>
  import("../pages/ResearchMapPage").then((m) => ({ default: m.ResearchMapPage }))
);

// Signs a signed-out user (logout, expired session) back to the landing page
// instead of rendering data-less pages against a dead session.
function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <ToastProvider>
      <Routes>
      {/* The landing page is a public home page, not a login-only gate: signed-in
          users can still visit it via the logo and get a "Go to Dashboard" CTA. */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/observations" element={<RequireAuth><ObservationsPage /></RequireAuth>} />
      <Route path="/observations/new" element={<RequireAuth><ObservationFormPage /></RequireAuth>} />
      <Route path="/observations/:id" element={<RequireAuth><ObservationDetailPage /></RequireAuth>} />
      <Route path="/observations/:id/edit" element={<RequireAuth><ObservationFormPage /></RequireAuth>} />
      <Route
        path="/map"
        element={
          <RequireAuth>
          <Layout>
            <Suspense
              fallback={
                <div className="p-12 text-center text-sm text-slate-400">Loading research map…</div>
              }
            >
              <ResearchMapPage />
            </Suspense>
          </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/ask"
        element={
          <RequireAuth>
            <Layout>
              <AskMyJournalPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/tasks"
        element={
          <RequireAuth>
            <Layout>
              <ResearchTasksPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/conversations"
        element={
          <RequireAuth>
            <Layout>
              <ConversationsPage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="/projects" element={<RequireAuth><ProjectsPage /></RequireAuth>} />
      <Route path="/projects/:id" element={<RequireAuth><ProjectDetailPage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      </Routes>
    </ToastProvider>
  );
}
