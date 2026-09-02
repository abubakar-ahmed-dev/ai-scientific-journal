import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchProject, fetchObservations, deleteProject, updateProject } from "../lib/api";
import type { Project, Observation } from "../lib/api";
import { Layout } from "../components/Layout";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "archived" | "completed">("active");

  async function loadData() {
    if (!id) return;
    try {
      const [projRes, obsRes] = await Promise.all([
        fetchProject(id),
        fetchObservations({ projectId: id }),
      ]);
      setProject(projRes.data);
      setTitle(projRes.data.title);
      setDescription(projRes.data.description || "");
      setStatus(projRes.data.status);
      setObservations(obsRes.data || []);
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
      await updateProject(id, { title, description: description || null, status });
      setEditing(false);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update project");
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (
      window.confirm(
        "Are you sure you want to delete this project? Note: Associated observations will NOT be deleted; they will be set to unfiled."
      )
    ) {
      try {
        await deleteProject(id);
        navigate("/projects");
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Failed to delete project");
      }
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/projects" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            &larr; Back to Projects
          </Link>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setEditing(!editing)}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50"
            >
              {editing ? "Cancel" : "Edit Project"}
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading project details...</div>
        ) : !project ? (
          <div className="p-8 bg-red-50 text-red-700 rounded">Project not found.</div>
        ) : (
          <div className="space-y-6">
            {/* Project Details / Edit Header */}
            <div className="bg-white p-6 sm:p-8 rounded-lg border border-slate-200 shadow-sm">
              {editing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Title</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="px-3 py-2 border border-slate-300 rounded text-sm bg-white"
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                      <option value="completed">Completed</option>
                    </select>
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
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
                  >
                    Save Changes
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {project.status}
                    </span>
                    {project.field && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {project.field}
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-slate-900">{project.title}</h1>
                  {project.description && (
                    <p className="text-slate-600 text-sm leading-relaxed">{project.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Observations in Project */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  Project Observations ({observations.length})
                </h2>
                <Link
                  to="/observations/new"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                >
                  + Add Observation to Project
                </Link>
              </div>

              {observations.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No observations currently filed under this project.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {observations.map((obs) => (
                    <li key={obs.id} className="p-6 hover:bg-slate-50 transition">
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/observations/${obs.id}`}
                          className="text-base font-semibold text-indigo-600 hover:text-indigo-800"
                        >
                          {obs.title}
                        </Link>
                        <span className="text-xs text-slate-400 capitalize">{obs.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{obs.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
