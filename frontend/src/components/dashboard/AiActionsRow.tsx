import { Link } from "react-router-dom";
import { Sparkles, Search, ListChecks, ArrowRight, FlaskConical } from "lucide-react";

interface AiActionsRowProps {
  latestObservationId: string | null;
  /** First observation of the latest analysis — where its viewer lives. */
  latestAnalysisObservationId: string | null;
  hasAnalyses: boolean;
}

const cardBase =
  "p-5 bg-white border border-purple-100 rounded-xl hover:border-purple-300 hover:shadow-xs transition flex items-start gap-4 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400";

/**
 * AI Research Assistant band (plan §5.2) — visually distinct from the brief
 * above: violet-tinted section container, its own label, two rows (actions on
 * top, analysis review below). Cards deep-link to where each action actually
 * lives; analysis generation never runs from the dashboard.
 */
export function AiActionsRow({
  latestObservationId,
  latestAnalysisObservationId,
  hasAnalyses,
}: AiActionsRowProps) {
  // No observations → nothing is analyzable; the row belongs to the new-user state.
  if (!latestObservationId) return null;

  return (
    <section
      aria-label="AI research assistant"
      className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-purple-600" aria-hidden="true" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-purple-700">
          AI Research Assistant
        </h2>
      </div>

      {/* Row 1: the two start-here actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to={`/observations/${latestObservationId}`} className={cardBase}>
          <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 transition-colors group-hover:bg-purple-700">
            <FlaskConical className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-app-heading transition-colors group-hover:text-purple-700">
              Analyze Latest
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              Run a structured analysis on your newest observation to surface findings,
              hypotheses, and uncertainty.
            </p>
          </div>
        </Link>

        <Link to="/ask" className={cardBase}>
          <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 transition-colors group-hover:bg-purple-700">
            <Search className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-app-heading transition-colors group-hover:text-purple-700">
              Ask Journal
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              Question your whole journal — answers cite the observations they rely on.
            </p>
          </div>
        </Link>
      </div>

      {/* Row 2: analysis review (or its honest empty state) */}
      {hasAnalyses && latestAnalysisObservationId ? (
        <Link
          to={`/observations/${latestAnalysisObservationId}`}
          className="p-5 bg-white border border-purple-100 rounded-xl hover:border-purple-300 hover:shadow-xs transition flex items-center gap-4 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-app-heading transition-colors group-hover:text-purple-700">
              Review Analyses
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              Revisit findings, uncertainties, and suggested next steps from your past analyses.
            </p>
          </div>
          <ArrowRight
            className="w-4 h-4 shrink-0 text-purple-400 transition-all group-hover:translate-x-1 group-hover:text-purple-600"
            aria-hidden="true"
          />
        </Link>
      ) : (
        <div className="p-5 bg-white/80 border border-dashed border-purple-200 rounded-xl flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-400 flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-app-heading">No analyses yet</h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              Run your first analysis to see findings and suggested next steps here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              to={`/observations/${latestObservationId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 text-white rounded-md text-xs font-semibold hover:bg-purple-700 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Analyze Latest
            </Link>
            <Link
              to="/ask"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-purple-300 text-purple-700 rounded-md text-xs font-semibold hover:bg-purple-50 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-purple-400"
            >
              <Search className="w-3.5 h-3.5" />
              Ask Journal
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
