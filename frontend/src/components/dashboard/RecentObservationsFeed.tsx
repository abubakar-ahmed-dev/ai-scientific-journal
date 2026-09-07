import { Link } from "react-router-dom";
import { FileText, Plus, AlertTriangle } from "lucide-react";
import type { Observation } from "../../lib/api";

interface RecentObservationsFeedProps {
  observations: Observation[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

/** Left column feed (plan §5.2): compact clickable cards, real state per section. */
export function RecentObservationsFeed({
  observations,
  loading,
  failed,
  onRetry,
}: RecentObservationsFeedProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-app-border pb-3">
        <h2 className="text-lg font-bold text-app-heading flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
            <FileText className="w-4.5 h-4.5" aria-hidden="true" />
          </span>
          <span>Recent Observations</span>
        </h2>
        <Link to="/observations" className="text-xs font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1">
          View All <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white p-5 rounded-xl border border-app-border animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-3 bg-slate-100 rounded w-full"></div>
              <div className="h-3 bg-slate-100 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : failed ? (
        <div className="bg-amber-50/70 p-8 rounded-xl border border-amber-200 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="text-xs font-semibold text-amber-900">Failed to load recent observations.</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-brand-600 font-semibold hover:underline"
          >
            Retry loading observations
          </button>
        </div>
      ) : observations.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-app-border text-center space-y-3">
          <FileText className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-600 font-medium">No observations logged yet.</p>
          <Link
            to="/observations/new"
            className="inline-flex items-center gap-1 px-4 py-2 bg-brand-600 text-white rounded-md text-xs font-semibold hover:bg-brand-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Log First Observation
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {observations.map((obs) => (
            <div
              key={obs.id}
              className="bg-white p-4 sm:p-5 rounded-xl border border-app-border hover:border-slate-300 hover:shadow-xs transition space-y-2.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    to={`/observations/${obs.id}`}
                    className="text-base font-semibold text-slate-900 hover:text-brand-600 transition"
                  >
                    {obs.title}
                  </Link>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed max-w-prose">
                    {obs.description}
                  </p>
                </div>

                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                    obs.status === "draft"
                      ? "bg-amber-100 text-amber-800"
                      : obs.status === "analyzed"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {obs.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1.5 text-xs text-slate-400">
                <span>{new Date(obs.observedAt).toLocaleDateString()}</span>
                {obs.measurements.length > 0 && (
                  <span>
                    {obs.measurements.length} measurement{obs.measurements.length === 1 ? "" : "s"}
                  </span>
                )}
                {Boolean(obs.mediaCount && obs.mediaCount > 0) && (
                  <span>
                    {obs.mediaCount} file{obs.mediaCount === 1 ? "" : "s"} attached
                  </span>
                )}
                {obs.location && obs.location.precision !== "hidden" && (
                  <span className="flex items-center gap-1 text-slate-500">
                    {obs.location.label || obs.location.precision}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
