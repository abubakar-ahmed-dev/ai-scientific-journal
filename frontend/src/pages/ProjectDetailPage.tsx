import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  fetchProject,
  fetchObservations,
  fetchResearchTasks,
  deleteProject,
  updateProject,
} from "../lib/api";
import type { Project, Observation, ResearchTask } from "../lib/api";
import { Layout } from "../components/Layout";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { FileText, CheckSquare, Plus, Edit2, Trash2, ArrowLeft } from "lucide-react";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"observations" | "tasks">("observations");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "completed">("active");
  const [field, setField] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    try {
      const [projRes, obsRes, tasksRes] = await Promise.all([
        fetchProject(id),
        fetchObservations({ projectId: id }),
        fetchResearchTasks({ projectId: id }),
      ]);
      setProject(projRes.data);
      setTitle(projRes.data.title);
      setDescription(projRes.data.description || "");
      setStatus(projRes.data.status);
      setField(projRes.data.field || "");
      setObservations(obsRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (err) {
      console.error("Failed to load project details", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      await updateProject(id, {
        title,
        description: description || null,
        status,
        field: field || null,
      });
      setEditing(false);
      loadData();
      toast.success("Project updated.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update project");
    }
  }

  async function handleDelete() {
    if (!id) return;
    setConfirmDeleteOpen(false);
    try {
      await deleteProject(id);
      toast.success("Project deleted.");
      navigate("/projects");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </Link>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setEditing(!editing)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{editing ? "Cancel" : "Edit Project"}</span>
            </button>
            <button
              onClick={() => setConfirmDeleteOpen(true)}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading project details...</div>
        ) : !project ? (
          <div className="bg-white p-12 text-center rounded-lg border border-slate-200">
            <p className="text-slate-500 text-sm">Project not found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Project Header Card */}
            <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 shadow-xs">
              {editing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Scientific Field</label>
                      <input
                        type="text"
                        placeholder="e.g. Ecology, Biochemistry"
                        value={field}
                        onChange={(e) => setField(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        project.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : project.status === "completed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {project.status}
                    </span>
                    {project.field && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {project.field}
                      </span>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{project.title}</h1>
                  {project.description && (
                    <p className="text-slate-600 text-sm leading-relaxed">{project.description}</p>
                  )}
                  {project.tags && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {project.tags.map((t) => (
                        <span key={t} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Tabs for Associated Observations and Tasks */}
            <div className="flex space-x-2 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("observations")}
                className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                  activeTab === "observations"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Observations ({observations.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tasks")}
                className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
                  activeTab === "tasks"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Research Tasks ({tasks.length})</span>
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === "observations" ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Project Observations ({observations.length})
                  </h2>
                  <Link
                    to={`/observations/new?projectId=${project.id}`}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Observation to Project
                  </Link>
                </div>

                {observations.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 text-sm space-y-2">
                    <p>No observations currently filed under this project.</p>
                    <Link
                      to={`/observations/new?projectId=${project.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 font-semibold rounded text-xs hover:bg-indigo-100 transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Observation
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {observations.map((obs) => (
                      <li key={obs.id} className="p-5 hover:bg-slate-50 transition space-y-1">
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/observations/${obs.id}`}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            {obs.title}
                          </Link>
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {obs.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1">{obs.description}</p>
                        <div className="text-[11px] text-slate-400 pt-1">
                          Observed: {new Date(obs.observedAt).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              /* Tasks Tab */
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Linked Research Tasks ({tasks.length})
                  </h2>
                  <Link
                    to="/tasks"
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Open Tasks Board &rarr;
                  </Link>
                </div>

                {tasks.length === 0 ? (
                  <div className="p-10 text-center text-slate-500 text-sm">
                    No research tasks linked to this project yet.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {tasks.map((task) => (
                      <li key={task.id} className="p-5 hover:bg-slate-50 transition space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900">{task.title}</span>
                          <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                            {task.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">{task.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete project?"
        destructive
        confirmLabel="Delete Project"
        message={
          <>
            <p>
              This permanently deletes <strong>{project?.title || "this project"}</strong>. This
              action cannot be undone.
            </p>
            <p className="mt-2">
              Observations and tasks are not deleted — they will be kept as unfiled.
            </p>
          </>
        }
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </Layout>
  );
}
