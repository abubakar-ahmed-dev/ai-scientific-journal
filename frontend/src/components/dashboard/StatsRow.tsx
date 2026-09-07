import { Link } from "react-router-dom";
import type { StatItem } from "../../lib/dashboardHelpers";

/**
 * Returning-state stats row (plan §5.2, reviewer decision: kept here only).
 * Secondary line is a link — no trend or due-soon claims (not computable
 * honestly without new endpoints).
 */
export function StatsRow({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white p-5 rounded-xl border border-app-border shadow-xs flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-medium text-slate-500">{item.label}</span>
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${item.iconClass}`}
            >
              <item.icon className="w-4.5 h-4.5" aria-hidden="true" />
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900 leading-none">
            {item.count}
            {item.capped && <span className="text-lg font-normal text-slate-400">+</span>}
          </p>
          <Link
            to={item.to}
            className="text-sm font-semibold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1 mt-auto"
          >
            {item.linkLabel}
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      ))}
    </div>
  );
}
