import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../lib/firebase/authContext";
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

// Leaflet + its assets are heavy; split them out of the initial bundle so
// only map routes pay the download cost.
const ResearchMapPage = lazy(() =>
  import("../pages/ResearchMapPage").then((m) => ({ default: m.ResearchMapPage }))
);

export default function App() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={currentUser ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/observations" element={<ObservationsPage />} />
      <Route path="/observations/new" element={<ObservationFormPage />} />
      <Route path="/observations/:id" element={<ObservationDetailPage />} />
      <Route path="/observations/:id/edit" element={<ObservationFormPage />} />
      <Route
        path="/map"
        element={
          <Layout>
            <Suspense
              fallback={
                <div className="p-12 text-center text-sm text-slate-400">Loading research map…</div>
              }
            >
              <ResearchMapPage />
            </Suspense>
          </Layout>
        }
      />
      <Route
        path="/ask"
        element={
          <Layout>
            <AskMyJournalPage />
          </Layout>
        }
      />
      <Route
        path="/tasks"
        element={
          <Layout>
            <ResearchTasksPage />
          </Layout>
        }
      />
      <Route
        path="/conversations"
        element={
          <Layout>
            <ConversationsPage />
          </Layout>
        }
      />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
