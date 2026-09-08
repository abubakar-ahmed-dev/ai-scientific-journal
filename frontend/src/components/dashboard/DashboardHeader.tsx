import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { greeting } from "../../lib/format";

interface DashboardHeaderProps {
  /** Non-count subtext — capped page counts must never masquerade as totals. */
  subtext: string;
}

/** Greeting header with the one canonical create action (plan §5.2). */
export function DashboardHeader({ subtext }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-app-heading">{greeting()}</h1>
        <p className="text-sm text-slate-500 mt-3">{subtext}</p>
      </div>

      <Link
        to="/observations/new"
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-md transition shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <Plus className="w-4 h-4" />
        <span>New Observation</span>
      </Link>
    </div>
  );
}
