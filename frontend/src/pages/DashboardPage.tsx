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
  MapPin,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

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

  return (
    <Layout>
      <div className="space-y-8">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Research Dashboard
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Empirical field observations, active projects, and AI-assisted investigation workflows.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/observations/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <Plus className="w-4 h-4" />
              <span>New Observation</span>
            </Link>
          </div>
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

        {/* Metrics Grid (Honest labels & count semantics per F4) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Recent Observations Metric */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Recent Observations</span>
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {observations.length}
              {obsHasMore && <span className="text-lg font-normal text-slate-400">+</span>}
            </p>
            <Link
              to="/observations"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1"
            >
              <span>View field journal</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Active Projects Metric */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Projects</span>
              <FolderKanban className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {activeProjects.length}
              {projHasMore && <span className="text-lg font-normal text-slate-400">+</span>}
            </p>
            <Link
              to="/projects"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1"
            >
              <span>Manage projects</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Pending Tasks Metric */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Pending Tasks</span>
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {pendingTasks.length}
              {tasksHasMore && <span className="text-lg font-normal text-slate-400">+</span>}
            </p>
            <Link
              to="/tasks"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1"
            >
              <span>Open tasks board</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* AI Analyses Metric */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Recent AI Analyses</span>
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-slate-900">
              {analyses.length}
              {analysesHasMore && <span className="text-lg font-normal text-slate-400">+</span>}
            </p>
            <Link
              to="/ask"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 pt-1"
            >
              <span>Ask My Journal</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Quick Scientific Action Cards (4 Cards per Plan §2.2 / F11) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/ask"
            className="p-4 bg-linear-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl hover:shadow-xs transition flex items-center gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-purple-700 transition">
                Ask My Journal
              </h3>
              <p className="text-xs text-slate-600">Query your observations with grounded AI citations</p>
            </div>
          </Link>

          <Link
            to="/map"
            className="p-4 bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl hover:shadow-xs transition flex items-center gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 transition">
                Research Map
              </h3>
              <p className="text-xs text-slate-600">Explore observations on the interactive map</p>
            </div>
          </Link>

          <Link
            to="/conversations"
            className="p-4 bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl hover:shadow-xs transition flex items-center gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition">
                AI Scientific Chat {conversations.length > 0 && `(${conversations.length})`}
              </h3>
              <p className="text-xs text-slate-600">Stateful research discussions bounded by project</p>
            </div>
          </Link>

          <Link
            to="/projects"
            className="p-4 bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl hover:shadow-xs transition flex items-center gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 group-hover:text-amber-700 transition">
                Research Projects
              </h3>
              <p className="text-xs text-slate-600">Organize observations into initiatives (+ New Project)</p>
            </div>
          </Link>
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
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {obs.location.label || obs.location.precision}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column (1/3): Tasks & Analyses */}
          <div className="space-y-8">
            {/* Planned & Suggested Tasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-amber-600" />
                  <span>Research Tasks</span>
                </h3>
                <Link to="/tasks" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  Board &rarr;
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
              ) : tasks.length === 0 ? (
                <div className="p-5 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  No active research tasks. Accept AI suggestions or create new tasks.
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 hover:shadow-2xs transition text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 line-clamp-1">{task.title}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {task.status}
                        </span>
                      </div>
                      <p className="text-slate-500 line-clamp-1">{task.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent AI Analyses */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>Recent AI Analyses</span>
                </h3>
              </div>

              {loading ? (
                <div className="p-4 bg-white rounded-xl border border-slate-200 animate-pulse space-y-2">
                  <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  <div className="h-3 bg-slate-100 rounded w-3/4"></div>
                </div>
              ) : failedSections.analyses ? (
                <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200 text-center space-y-1">
                  <p className="text-xs font-semibold text-amber-900">Failed to load AI analyses.</p>
                  <button
                    type="button"
                    onClick={loadDashboardData}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    Retry
                  </button>
                </div>
              ) : analyses.length === 0 ? (
                <div className="p-5 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                  No structured analyses generated yet. Use "Analyze with AI" from any observation.
                </div>
              ) : (
                <div className="space-y-2">
                  {analyses.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="p-3 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {a.type}
                        </span>
                        <span className="text-slate-400 text-[10px]">
                          {new Date(a.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-700 line-clamp-2 leading-relaxed">
                        {a.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
