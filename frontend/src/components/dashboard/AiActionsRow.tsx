import { Link } from "react-router-dom";
import { Sparkles, Search, ListChecks, ArrowRight, MessageSquareText, FlaskConical } from "lucide-react";

interface AiActionsRowProps {
  latestObservationId: string | null;
  /** First observation of the latest analysis — where its viewer lives. */
  latestAnalysisObservationId: string | null;
  hasAnalyses: boolean;
}

const cardBase =
  "p-5 bg-white border border-cyan-100 rounded-xl hover:border-cyan-300 hover:shadow-xs transition flex items-start gap-4 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-400";

/**
 * AI Research Assistant band (plan §5.2) — visually distinct from the brief
 * above. Row 1 holds the two conversations surfaces (Ask Journal, AI Chat);
 * row 2 holds analysis review. "Analyze Latest" intentionally lives only in
 * the brief's next step (and this band's empty state) — not repeated here.
 * Cyan is the AI accent: distinct from the teal primary without clashing.
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
      className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-cyan-600" aria-hidden="true" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-700">
          AI Research Assistant
        </h2>
      </div>

      {/* Row 1: the two conversation surfaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/ask" className={cardBase}>
          <div className="w-11 h-11 rounded-xl bg-cyan-700 text-white flex items-center justify-center shrink-0 transition-colors group-hover:bg-cyan-800">
            <Search className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-app-heading transition-colors group-hover:text-cyan-700">
              Ask Journal
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              Question your whole journal — answers cite the observations they rely on.
            </p>
          </div>
        </Link>

        <Link to="/conversations" className={cardBase}>
          <div className="w-11 h-11 rounded-xl bg-cyan-700 text-white flex items-center justify-center shrink-0 transition-colors group-hover:bg-cyan-800">
            <MessageSquareText className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-app-heading transition-colors group-hover:text-cyan-700">
              AI Chat
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              Think out loud with an assistant that keeps your research context in mind.
            </p>
          </div>
        </Link>
      </div>

      {/* Row 2: analysis review (or its honest empty state) */}
      {hasAnalyses && latestAnalysisObservationId ? (
        <Link
          to={`/observations/${latestAnalysisObservationId}`}
          className="p-5 bg-white border border-cyan-100 rounded-xl hover:border-cyan-300 hover:shadow-xs transition flex items-center gap-4 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-app-heading transition-colors group-hover:text-cyan-700">
              Review Analyses
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              Revisit findings, uncertainties, and suggested next steps from your past analyses.
            </p>
          </div>
          <ArrowRight
            className="w-4 h-4 shrink-0 text-cyan-400 transition-all group-hover:translate-x-1 group-hover:text-cyan-600"
            aria-hidden="true"
          />
        </Link>
      ) : (
        <div className="p-5 bg-white/80 border border-dashed border-cyan-200 rounded-xl flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-500 flex items-center justify-center shrink-0">
            <ListChecks className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-app-heading">No Analyses Yet</h3>
            <p className="text-sm text-slate-600 leading-relaxed mt-1">
              Run your first analysis to see findings and suggested next steps here.
            </p>
          </div>
          <div className="shrink-0">
            <Link
              to={`/observations/${latestObservationId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-cyan-700 text-white rounded-md text-xs font-semibold hover:bg-cyan-800 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              Analyze Latest Observation
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
