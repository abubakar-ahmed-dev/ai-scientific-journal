import { Link } from "react-router-dom";
import { PlayCircle, Plus, Sparkles, ArrowRight, Lightbulb } from "lucide-react";
import type { Observation, Project } from "../../lib/api";
import type { NextStep } from "../../lib/dashboardHelpers";
import { relativeTime } from "../../lib/format";

interface ResearchBriefProps {
  project: Project | null;
  latestObservation: Observation | null;
  /** Real per-project observation count; null while its dedicated query loads. */
  observationCount: number | null;
  observationsCapped: boolean;
  openTaskCount: number;
  tasksCapped: boolean;
  nextStep: NextStep;
}

/**
 * Today's Research Brief (plan §5.2) — replaces the old "Current Research"
 * hero + unattributed AI banner. Counts are real (per-project query), the
 * next step is a deterministic rule or an explicitly-labeled analysis quote.
 */
export function ResearchBrief({
  project,
  latestObservation,
  observationCount,
  observationsCapped,
  openTaskCount,
  tasksCapped,
  nextStep,
}: ResearchBriefProps) {
  const isAnalysisStep = nextStep.source === "analysis";

  // No active project: anchor the brief on the latest observation instead.
  if (!project) {
    return (
      <div className="bg-white rounded-xl border border-app-border p-6 shadow-xs">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Latest Research Activity
        </p>
        {latestObservation ? (
          <>
            <h2 className="text-lg font-bold text-app-heading mt-1.5 truncate">
              <Link to={`/observations/${latestObservation.id}`} className="hover:text-brand-600 transition">
                {latestObservation.title}
              </Link>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Added {relativeTime(latestObservation.createdAt)} · not part of a project yet
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Link
                to="/projects"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-semibold hover:bg-brand-700 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <Plus className="w-4 h-4" />
                Create Project
              </Link>
              <Link
                to={`/observations/${latestObservation.id}`}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
              >
                View observation
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 mt-2">
            Record an observation to start your journal.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-app-border p-6 shadow-xs">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Current Research
          </p>
          <h2 className="text-xl font-bold text-app-heading truncate">{project.title}</h2>
          {project.description && (
            <p className="text-sm text-slate-600 line-clamp-2 max-w-2xl">{project.description}</p>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          {project.status}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-3 text-xs text-slate-500">
        <span>
          {observationCount === null ? (
            "…"
          ) : (
            <>
              {observationCount}
              {observationsCapped && "+"} observation{observationCount === 1 ? "" : "s"}
            </>
          )}
        </span>
        <span>
          {openTaskCount}
          {tasksCapped && "+"} open task{openTaskCount === 1 ? "" : "s"}
        </span>
        <span>Last activity: {relativeTime(project.updatedAt)}</span>
      </div>

      {/* Next-step hint — deterministic rule, or the analysis' own suggestion
          when that analysis is newer than every observation (violet = AI). */}
      <Link
        to={nextStep.to}
        className={`group mt-5 flex items-center gap-3.5 rounded-xl border p-4 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 ${
          isAnalysisStep
            ? "bg-purple-50/60 border-purple-200 hover:bg-purple-50"
            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
        }`}
      >
        {isAnalysisStep ? (
          <Sparkles className="w-5 h-5 text-purple-600 shrink-0" aria-hidden="true" />
        ) : (
          <Lightbulb className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[10px] font-bold uppercase tracking-widest ${
              isAnalysisStep ? "text-purple-700" : "text-slate-400"
            }`}
          >
            {nextStep.label}
          </span>
          <span
            className={`block text-sm mt-1 leading-relaxed transition-colors ${
              isAnalysisStep
                ? "text-purple-900 group-hover:text-purple-700"
                : "text-slate-700 group-hover:text-brand-700"
            }`}
          >
            {nextStep.text}
          </span>
        </span>
        <ArrowRight
          className="w-4 h-4 shrink-0 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-brand-600"
          aria-hidden="true"
        />
      </Link>

      <div className="flex items-center gap-3 pt-4">
        <Link
          to={`/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-semibold hover:bg-brand-700 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <PlayCircle className="w-4 h-4" />
          Continue Research
        </Link>
        <Link
          to="/projects"
          className="text-xs font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
        >
          View all projects
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
