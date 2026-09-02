import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../lib/firebase/authContext";
import LandingPage from "../pages/LandingPage";
import DashboardPage from "../pages/DashboardPage";
import ObservationsPage from "../pages/ObservationsPage";
import ObservationDetailPage from "../pages/ObservationDetailPage";
import ObservationFormPage from "../pages/ObservationFormPage";
import ProjectsPage from "../pages/ProjectsPage";
import ProjectDetailPage from "../pages/ProjectDetailPage";
import SettingsPage from "../pages/SettingsPage";

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
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/:id" element={<ProjectDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
