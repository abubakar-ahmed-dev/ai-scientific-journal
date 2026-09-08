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

/** Soft-teal surface from the UI-Guidelines §3 token set (#E0F0E9). */
const TEAL_SURFACE = "bg-[#E0F0E9]";

/**
 * Today's Research Brief (plan §5.2) — split-panel hero: identity + action on
 * white (left), counts + next-step embedded in a tinted side panel (right) so
 * the full-width card has no dead zone. Counts are real (per-project query);
 * the next step is a deterministic rule or an explicitly-labeled analysis
 * quote (cyan = AI accent).
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

  const nextStepPanel = (
    <div
      className={`rounded-xl border p-4 ${
        isAnalysisStep ? "bg-cyan-50/70 border-cyan-200" : "bg-white/80 border-slate-200"
      }`}
    >
      <Link
        to={nextStep.to}
        className="group flex items-start gap-3 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md"
      >
        {isAnalysisStep ? (
          <Sparkles className="w-4.5 h-4.5 text-cyan-600 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <Lightbulb className="w-4.5 h-4.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`block text-[10px] font-bold uppercase tracking-widest ${
              isAnalysisStep ? "text-cyan-700" : "text-slate-400"
            }`}
          >
            {nextStep.label}
          </span>
          <span
            className={`block text-sm mt-1 leading-snug transition-colors ${
              isAnalysisStep
                ? "text-cyan-900 group-hover:text-cyan-700"
                : "text-slate-700 group-hover:text-brand-700"
            }`}
          >
            {nextStep.text}
          </span>
        </span>
        <ArrowRight
          className="w-4 h-4 shrink-0 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-brand-600 mt-4"
          aria-hidden="true"
        />
      </Link>
    </div>
  );

  // No active project: single-zone brief anchored on the latest observation —
  // there are no project counts to mirror, so no side panel.
  if (!project) {
    return (
      <div className="bg-white rounded-xl border border-app-border p-6 shadow-xs">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Latest Research Activity
        </p>
        {latestObservation ? (
          <>
            <h2 className="text-xl font-bold text-app-heading truncate mt-1">
              <Link
                to={`/observations/${latestObservation.id}`}
                className="hover:text-brand-600 transition-colors"
              >
                {latestObservation.title}
              </Link>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Added {relativeTime(latestObservation.createdAt)} · not part of a project yet
            </p>
            <div className="mt-5 max-w-xl">{nextStepPanel}</div>
          </>
        ) : (
          <p className="text-sm text-slate-500 mt-2">
            Record an observation to start your journal.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-semibold hover:bg-brand-700 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </Link>
          {latestObservation && (
            <Link
              to={`/observations/${latestObservation.id}`}
              className="text-sm font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 transition-colors"
            >
              View observation
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-app-border shadow-xs overflow-hidden flex flex-col lg:flex-row">
      {/* Left: identity + action (actions anchored to the card's bottom so
          they sit level with the suggestion panel on the right) */}
      <div className="p-7 flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Current Research
          </p>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {project.status}
          </span>
        </div>
        <h2 className="text-xl font-bold text-app-heading truncate mt-4.5">{project.title}</h2>
        {project.description && (
          <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed mt-3.5">
            {project.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 lg:mt-auto pt-6">
          <Link
            to={`/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-semibold hover:bg-brand-700 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <PlayCircle className="w-4 h-4" />
            Continue Research
          </Link>
          <Link
            to="/projects"
            className="text-sm font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 transition-colors"
          >
            View all projects
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Right: counts + next step on the soft-teal surface */}
      <div
        className={`shrink-0 lg:w-80 xl:w-96 ${TEAL_SURFACE} border-t lg:border-t-0 lg:border-l border-app-border/60 p-6 flex flex-col gap-4`}
      >
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-none">
              {observationCount ?? "—"}
              {observationCount !== null && observationsCapped && (
                <span className="text-sm font-normal text-slate-400">+</span>
              )}
            </p>
            <p className="text-[11px] font-medium text-slate-600 mt-1.5">
              Observation{observationCount === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 leading-none">
              {openTaskCount}
              {tasksCapped && <span className="text-sm font-normal text-slate-400">+</span>}
            </p>
            <p className="text-[11px] font-medium text-slate-600 mt-1.5">
              Open task{openTaskCount === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-md font-semibold text-slate-800 leading-none pt-1.5 whitespace-nowrap">
              {relativeTime(project.updatedAt)}
            </p>
            <p className="text-[11px] font-medium text-slate-600 mt-2">Last activity</p>
          </div>
        </div>

        <div className="border-t border-brand-700/10 -mx-1 px-1 pt-4 flex-1 flex flex-col justify-center">
          {nextStepPanel}
        </div>
      </div>
    </div>
  );
}
