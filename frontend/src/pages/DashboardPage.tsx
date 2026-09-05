import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import {
  fetchObservations,
  fetchProjects,
  fetchResearchTasks,
  fetchConversations,
  fetchAnalyses,
} from "../lib/api";
import type {
  Observation,
  Project,
  ResearchTask,
  Conversation,
  Analysis,
} from "../lib/api";
import {
  Sparkles,
  FileText,
  FolderKanban,
  CheckSquare,
  ArrowRight,
  Plus,
  Search,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  ListTodo,
  PlayCircle,
  Rocket,
  BookOpen,
} from "lucide-react";

/** Time-of-day greeting (guidelines §10). */
const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const STATUS_PRIORITY: Record<string, number> = {
  in_progress: 0,
  planned: 1,
  suggested: 2,
};

const relativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
};

type ActivityItem = {
  id: string;
  kind: "observation" | "task" | "analysis";
  label: string;
  detail?: string;
  to: string;
  at: string;
};

export default function DashboardPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination hasMore flags for accurate metric indication
  const [obsHasMore, setObsHasMore] = useState(false);
  const [projHasMore, setProjHasMore] = useState(false);
  const [tasksHasMore, setTasksHasMore] = useState(false);
  const [analysesHasMore, setAnalysesHasMore] = useState(false);

  // Track per-section settlement (F6: distinct error state from empty state)
  const [failedSections, setFailedSections] = useState<{
    observations?: boolean;
    projects?: boolean;
    tasks?: boolean;
    conversations?: boolean;
    analyses?: boolean;
  }>({});

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFailedSections({});

    const results = await Promise.allSettled([
      fetchObservations({ limit: 6 }),
      fetchProjects({ limit: 50 }),
      fetchResearchTasks({ limit: 50 }),
      fetchConversations({ limit: 5 }),
      fetchAnalyses({ limit: 5 }),
    ]);

    const errors: typeof failedSections = {};

    if (results[0].status === "fulfilled") {
      setObservations(results[0].value.data || []);
      setObsHasMore(Boolean(results[0].value.meta?.hasMore));
    } else {
      errors.observations = true;
    }

    if (results[1].status === "fulfilled") {
      setProjects(results[1].value.data || []);
      setProjHasMore(Boolean(results[1].value.meta?.hasMore));
    } else {
      errors.projects = true;
    }

    if (results[2].status === "fulfilled") {
      setTasks(results[2].value.data || []);
      setTasksHasMore(Boolean(results[2].value.meta?.hasMore));
    } else {
      errors.tasks = true;
    }

    if (results[3].status === "fulfilled") {
      setConversations(results[3].value.data || []);
    } else {
      errors.conversations = true;
    }

    if (results[4].status === "fulfilled") {
      setAnalyses(results[4].value.data || []);
      setAnalysesHasMore(Boolean(results[4].value.meta?.hasMore));
    } else {
      errors.analyses = true;
    }

    const hasAnyError = Object.values(errors).some(Boolean);
    if (hasAnyError) {
      setError("Some research data could not be loaded. Please retry below.");
      setFailedSections(errors);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const activeProjects = projects.filter((p) => p.status === "active");
  const pendingTasks = tasks.filter(
    (t) => t.status === "suggested" || t.status === "planned" || t.status === "in_progress"
  );

  /**
   * Current Research hero (guidelines §11): most recently active project.
   * The data model has no research-progress field, so no percentage bar —
   * honest counts and last activity instead (§11/§60.5).
   */
  const currentResearch: Project | null =
    [...activeProjects].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0] || null;

  // Prioritized task summary (guidelines §14): status priority, then recency.
  const summaryTasks = [...pendingTasks]
    .sort((a, b) => {
      const pA = STATUS_PRIORITY[a.status] ?? 9;
      const pB = STATUS_PRIORITY[b.status] ?? 9;
      if (pA !== pB) return pA - pB;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, 5);

  // Clickable activity feed (guidelines §17) built only from real records.
  const activity: ActivityItem[] = [
    ...observations.map<ActivityItem>((o) => ({
      id: `obs-${o.id}`,
      kind: "observation",
      label: o.title,
      to: `/observations/${o.id}`,
      at: o.updatedAt || o.createdAt,
    })),
    ...tasks
      .filter((t) => t.status === "completed")
      .map<ActivityItem>((t) => ({
        id: `task-${t.id}`,
        kind: "task",
        label: t.title,
        detail: "Completed task",
        to: "/tasks",
        at: t.updatedAt,
      })),
    ...analyses.map<ActivityItem>((a) => ({
      id: `anl-${a.id}`,
      kind: "analysis",
      label: a.type.replace("_", " "),
      detail: a.summary,
      to: "/observations",
      at: a.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  const isEmptyWorkspace = !loading && observations.length === 0 && projects.length === 0;

  // Journal Intelligence (guidelines §16): real latest analysis only.
  const latestAnalysis = analyses[0];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Contextual greeting header (guidelines §10) */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{greeting()}</h1>
            <p className="text-sm text-slate-500 mt-1">
              Continue your research where you left off.
            </p>
          </div>

          <Link
            to="/observations/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition shadow-xs focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Plus className="w-4 h-4" />
            <span>New Observation</span>
          </Link>
        </div>

        {/* Error Alert with Reachable Retry (F6) */}
        {error && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={loadDashboardData}
              className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-amber-300 text-xs font-semibold text-amber-800 rounded-md hover:bg-amber-100 transition shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* New-user onboarding state (guidelines §20.1) */}
        {isEmptyWorkspace ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-4">
            <Rocket className="w-10 h-10 text-indigo-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Your research workspace is ready.</h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Create your first project and record your first observation — then let the
              journal AI help you analyze and plan.
            </p>
            <Link
              to="/projects"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 transition"
            >
              <FolderKanban className="w-4 h-4" />
              Create Project
            </Link>
            <ol className="pt-2 text-xs text-slate-500 space-y-1 max-w-xs mx-auto text-left">
              <li>1. Create your first project</li>
              <li>2. Record your first observation</li>
              <li>3. Explore the journal AI</li>
            </ol>
          </div>
        ) : (
          <>
            {/* Current Research hero (guidelines §11) — honest stats, no fabricated progress */}
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse space-y-3">
                <div className="h-3 bg-slate-200 rounded w-1/4"></div>
                <div className="h-6 bg-slate-200 rounded w-1/2"></div>
                <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                <div className="h-8 bg-slate-100 rounded w-40"></div>
              </div>
            ) : currentResearch ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Current Research
                    </p>
                    <h2 className="text-xl font-bold text-slate-900 truncate">
                      {currentResearch.title}
                    </h2>
                    {currentResearch.description && (
                      <p className="text-sm text-slate-600 line-clamp-2 max-w-2xl">
                        {currentResearch.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {currentResearch.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-3 text-xs text-slate-500">
                  <span>
                    {observations.filter((o) => o.projectId === currentResearch.id).length} recent observations
                  </span>
                  <span>
                    {tasks.filter((t) => t.projectId === currentResearch.id &&
                      t.status !== "completed" && t.status !== "dismissed").length} open tasks
                  </span>
                  <span>Last activity: {relativeTime(currentResearch.updatedAt)}</span>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Link
                    to={`/projects/${currentResearch.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-semibold hover:bg-indigo-700 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Continue Research
                  </Link>
                  <Link
                    to="/projects"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                  >
                    View all projects
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-6 text-center space-y-2">
                <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">No active research project.</p>
                <p className="text-xs text-slate-500">
                  Create or reactivate a project to anchor your current research.
                </p>
                <Link
                  to="/projects"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Project
                </Link>
              </div>
            )}

            {/* Quick actions (guidelines §12): the four canonical actions, flat cards */}
            <div>
              <h2 className="text-sm font-bold text-slate-900 pb-3">What do you want to do?</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Link
                  to="/observations/new"
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-xs transition flex items-center gap-3 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Plus className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition">New Observation</h3>
                    <p className="text-xs text-slate-500">Record research</p>
                  </div>
                </Link>

                <Link
                  to="/ask"
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-purple-300 hover:shadow-xs transition flex items-center gap-3 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0">
                    <Search className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-purple-700 transition">Ask Journal</h3>
                    <p className="text-xs text-slate-500">Search your knowledge</p>
                  </div>
                </Link>

                <Link
                  to="/conversations"
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-xs transition flex items-center gap-3 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition">AI Chat</h3>
                    <p className="text-xs text-slate-500">Work with AI</p>
                  </div>
                </Link>

                <Link
                  to="/tasks"
                  className="p-4 bg-white border border-slate-200 rounded-xl hover:border-emerald-300 hover:shadow-xs transition flex items-center gap-3 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <ListTodo className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition">Add Task</h3>
                    <p className="text-xs text-slate-500">Plan your work</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Journal Intelligence (guidelines §16/§22.2) — only from real analysis data */}
            {!loading && !failedSections.analyses && latestAnalysis && (
              <div className="bg-purple-50/60 border border-purple-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Sparkles className="w-4.5 h-4.5 text-purple-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-purple-700">AI suggestion</p>
                    <p className="text-sm text-slate-700 line-clamp-2 mt-0.5">
                      From your latest {latestAnalysis.type.replace("_", " ")}:{" "}
                      {latestAnalysis.suggestedNextSteps?.[0] || latestAnalysis.summary}
                    </p>
                  </div>
                </div>
                <Link
                  to="/observations"
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:text-purple-900"
                >
                  Review analysis
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}

            {/* Metrics (guidelines §9: below active work) — honest counts with hasMore "+" */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">Observations</span>
                  <FileText className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {observations.length}
                  {obsHasMore && <span className="text-base font-normal text-slate-400">+</span>}
                </p>
                <Link to="/observations" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  View journal
                </Link>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">Active Projects</span>
                  <FolderKanban className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {activeProjects.length}
                  {projHasMore && <span className="text-base font-normal text-slate-400">+</span>}
                </p>
                <Link to="/projects" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Manage projects
                </Link>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">Open Tasks</span>
                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {pendingTasks.length}
                  {tasksHasMore && <span className="text-base font-normal text-slate-400">+</span>}
                </p>
                <Link to="/tasks" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Open tasks board
                </Link>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold">AI Analyses</span>
                  <Sparkles className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-slate-900">
                  {analyses.length}
                  {analysesHasMore && <span className="text-base font-normal text-slate-400">+</span>}
                </p>
                <Link to="/ask" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Ask My Journal
                </Link>
              </div>
            </div>

            {/* Main 2-Column Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column (2/3): Recent Observations */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span>Recent Observations</span>
                  </h2>
                  <Link to="/observations" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                    View All &rarr;
                  </Link>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="bg-white p-5 rounded-xl border border-slate-200 animate-pulse space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                        <div className="h-3 bg-slate-100 rounded w-full"></div>
                        <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : failedSections.observations ? (
                  <div className="bg-amber-50/70 p-8 rounded-xl border border-amber-200 text-center space-y-2">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="text-xs font-semibold text-amber-900">Failed to load recent observations.</p>
                    <button
                      type="button"
                      onClick={loadDashboardData}
                      className="text-xs text-indigo-600 font-semibold hover:underline"
                    >
                      Retry loading observations
                    </button>
                  </div>
                ) : observations.length === 0 ? (
                  <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-3">
                    <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-sm text-slate-600 font-medium">No observations logged yet.</p>
                    <Link
                      to="/observations/new"
                      className="inline-flex items-center gap-1 px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 transition"
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
                        className="bg-white p-5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-xs transition space-y-2"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <Link
                              to={`/observations/${obs.id}`}
                              className="text-base font-semibold text-slate-900 hover:text-indigo-600 transition"
                            >
                              {obs.title}
                            </Link>
                            <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
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

                        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-400 border-t border-slate-100">
                          <span>{new Date(obs.observedAt).toLocaleDateString()}</span>
                          {obs.measurements.length > 0 && (
                            <span>{obs.measurements.length} measurements</span>
                          )}
                          {Boolean(obs.mediaCount && obs.mediaCount > 0) && <span>{obs.mediaCount} files attached</span>}
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

              {/* Right Column (1/3): Prioritized Tasks + Activity */}
              <div className="space-y-8">
                {/* Prioritized task summary (guidelines §14) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-amber-600" />
                      <span>Today's Tasks</span>
                    </h3>
                    <Link
                      to="/tasks"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                      View all
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {loading ? (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 animate-pulse space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                    </div>
                  ) : failedSections.tasks ? (
                    <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 text-center space-y-1">
                      <p className="text-xs font-semibold text-amber-900">Failed to load research tasks.</p>
                      <button
                        type="button"
                        onClick={loadDashboardData}
                        className="text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : summaryTasks.length === 0 ? (
                    <div className="p-5 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500 space-y-2">
                      <p>You're all caught up — no open tasks right now.</p>
                      <Link
                        to="/tasks"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 transition"
                      >
                        <Plus className="w-3 h-3" />
                        Add Task
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {summaryTasks.map((task) => (
                        <Link
                          key={task.id}
                          to="/tasks"
                          className="block p-3 bg-white rounded-lg border border-slate-200 hover:shadow-2xs hover:border-slate-300 transition text-xs space-y-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-800 line-clamp-1">{task.title}</span>
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

                {/* Clickable recent activity (guidelines §17) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-slate-500" />
                      <span>Recent Activity</span>
                    </h3>
                  </div>

                  {loading ? (
                    <div className="p-4 bg-white rounded-xl border border-slate-200 animate-pulse space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                      <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                    </div>
                  ) : activity.length === 0 ? (
                    <div className="p-5 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                      Activity from your observations, tasks, and analyses will appear here.
                    </div>
                  ) : (
                    <ol className="space-y-1">
                      {activity.map((item) => (
                        <li key={item.id}>
                          <Link
                            to={item.to}
                            className="flex items-start justify-between gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-2xs border border-transparent hover:border-slate-200 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            <span className="text-xs text-slate-700 line-clamp-1">
                              {item.kind === "analysis" && (
                                <Sparkles className="inline w-3 h-3 text-purple-500 mr-1 -mt-0.5" />
                              )}
                              <span className="font-medium">
                                {item.kind === "observation"
                                  ? "Observation"
                                  : item.kind === "task"
                                  ? item.detail
                                  : "AI analysis"}:
                              </span>{" "}
                              {item.label}
                            </span>
                            <span className="shrink-0 text-[10px] text-slate-400 pt-0.5">
                              {relativeTime(item.at)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
