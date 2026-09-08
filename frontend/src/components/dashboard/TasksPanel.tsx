import { Link } from "react-router-dom";
import { ListTodo, Plus, ArrowRight, AlertTriangle } from "lucide-react";
import type { ResearchTask } from "../../lib/api";

interface TasksPanelProps {
  tasks: ResearchTask[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

/** Right column prioritized task summary (plan §5.2, max 3). */
export function TasksPanel({ tasks, loading, failed, onRetry }: TasksPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-app-border pb-3">
        <h2 className="text-lg font-bold text-app-heading flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <ListTodo className="w-4.5 h-4.5" aria-hidden="true" />
          </span>
          <span>Today's Tasks</span>
        </h2>
        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 hover:bg-brand-100 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          View all
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="p-4 bg-white rounded-xl border border-app-border animate-pulse space-y-2">
          <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          <div className="h-3 bg-slate-100 rounded w-3/4"></div>
        </div>
      ) : failed ? (
        <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 text-center space-y-1">
          <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
          <p className="text-xs font-semibold text-amber-900">Failed to load research tasks.</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs text-brand-600 font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-5 bg-white rounded-xl border border-app-border text-center text-xs text-slate-500 space-y-2">
          <p>You're all caught up — no open tasks right now.</p>
          <Link
            to="/tasks"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-semibold hover:bg-brand-700 transition"
          >
            <Plus className="w-3 h-3" />
            Add Task
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tasks.map((task) => (
            <Link
              key={task.id}
              to="/tasks"
              className="block p-3.5 bg-white rounded-xl border border-app-border hover:shadow-2xs hover:border-slate-300 transition text-xs space-y-1.5 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800 line-clamp-1">{task.title}</span>
                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    task.status === "in_progress"
                      ? "bg-amber-100 text-amber-800"
                      : task.status === "planned"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {task.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-slate-500 line-clamp-1">{task.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
