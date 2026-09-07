import { Link } from "react-router-dom";
import { NotebookPen, FolderKanban } from "lucide-react";
import { DashboardHeader } from "./DashboardHeader";
import { QuickCaptureForm } from "./QuickCaptureForm";
import { WorkspaceReadiness } from "./WorkspaceReadiness";
import type { ReadinessRow } from "./WorkspaceReadiness";
import { FeaturePreviews } from "./FeaturePreviews";

interface NewUserDashboardProps {
  readinessRows: ReadinessRow[];
  headerSubtext: string;
}

/**
 * New-user state (plan §5.1): one clear primary action — record the first
 * observation. No rocket, no numbered onboarding list, no `0` stat tiles.
 * Rendered only when the empty workspace is *confirmed* (both observations
 * and projects fetches succeeded and returned zero), so an outage can never
 * masquerade as a fresh account.
 */
export function NewUserDashboard({ readinessRows, headerSubtext }: NewUserDashboardProps) {
  return (
    <div className="space-y-8">
      <DashboardHeader subtext={headerSubtext} />

      <div className="bg-white rounded-xl border border-app-border p-6 sm:p-8 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <NotebookPen className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <h2 className="text-lg font-bold text-app-heading">Start with one observation.</h2>
            <p className="text-sm text-slate-500 max-w-xl">
              Capture what happened, add notes or measurements, and save it as your first
              research record. Projects are optional — you can organize later.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-4 pl-14">
          <Link
            to="/observations/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-semibold hover:bg-brand-700 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <NotebookPen className="w-4 h-4" />
            Record First Observation
          </Link>
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-app-border text-slate-700 rounded-md text-sm font-semibold hover:bg-slate-50 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <FolderKanban className="w-4 h-4" />
            Create Project
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuickCaptureForm />
        </div>
        <WorkspaceReadiness rows={readinessRows} />
      </div>

      <FeaturePreviews />
    </div>
  );
}
