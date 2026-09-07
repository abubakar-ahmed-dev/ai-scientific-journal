import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ArrowRight, ShieldCheck } from "lucide-react";

export interface ReadinessRow {
  label: string;
  done: boolean;
}

/**
 * Workspace readiness (plan §5.1): evidence-based status rows sized to sit
 * beside the taller Quick Capture form — flex column fills the grid cell,
 * with a privacy reassurance and an alternate-path link anchoring the base.
 * Every row reflects an actually-confirmed fetch state — no decorative checks.
 */
export function WorkspaceReadiness({ rows }: { rows: ReadinessRow[] }) {
  return (
    <div className="bg-white rounded-xl border border-app-border p-6 h-full flex flex-col">
      <h2 className="text-base font-bold text-app-heading">Workspace Ready</h2>

      <ul className="space-y-4 mt-5 flex-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start gap-2.5 text-sm">
            {row.done ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300 shrink-0" aria-hidden="true" />
            )}
            <span className={row.done ? "text-slate-700" : "text-slate-500"}>{row.label}</span>
          </li>
        ))}
      </ul>

      <div className="pt-5 mt-5 border-t border-slate-100 space-y-3">
        <p className="flex items-start gap-2 text-xs text-slate-500 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-px" aria-hidden="true" />
          Your records stay private — only your account can see them.
        </p>
        <Link
          to="/observations/new"
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-800 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          Prefer the full form? Open it
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
