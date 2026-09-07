import { Link } from "react-router-dom";
import { BookOpen, Sparkles, FileText, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ActivityItem } from "../../lib/dashboardHelpers";
import { relativeTime } from "../../lib/format";

const KIND_STYLE: Record<ActivityItem["kind"], { icon: LucideIcon; chip: string }> = {
  observation: { icon: FileText, chip: "bg-brand-50 text-brand-600" },
  task: { icon: CheckCircle2, chip: "bg-amber-50 text-amber-600" },
  analysis: { icon: Sparkles, chip: "bg-cyan-50 text-cyan-700" },
};

/**
 * Full-width Recent Activity section (dashboard refactor 2026-09-07: moved
 * out of the right column into its own bottom grid). Clickable rows built
 * only from real records.
 */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section aria-label="Recent activity" className="space-y-4 pt-2 border-t border-app-border">
      <div className="flex items-center justify-between pt-4">
        <h2 className="text-lg font-bold text-app-heading flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
            <BookOpen className="w-4.5 h-4.5" aria-hidden="true" />
          </span>
          <span>Recent Activity</span>
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="p-6 bg-white rounded-xl border border-app-border text-center text-sm text-slate-500">
          Activity from your observations, tasks, and analyses will appear here.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => {
            const style = KIND_STYLE[item.kind];
            return (
              <Link
                key={item.id}
                to={item.to}
                className="p-3.5 bg-white rounded-xl border border-app-border hover:border-slate-300 hover:shadow-2xs transition flex items-center gap-3 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.chip}`}
                >
                  <style.icon className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {item.kind === "observation"
                      ? "Observation"
                      : item.kind === "task"
                      ? "Task completed"
                      : "AI analysis"}
                  </span>
                  <span className="block text-sm text-slate-700 font-medium line-clamp-1 mt-0.5">
                    {item.label}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">
                  {relativeTime(item.at)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
