import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProjects, createProject } from "../lib/api";
import type { Project } from "../lib/api";
import { Layout } from "../components/Layout";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // New Project Form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [field, setField] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetchProjects();
      setProjects(res.data || []);
    } catch (err) {
      console.error("Failed to load projects", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      await createProject({
        title,
        description: description || null,
        field: field || null,
        tags,
      });

      setTitle("");
      setDescription("");
      setField("");
      setTagsInput("");
      setShowCreate(false);
      loadProjects();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  // Filter state
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "archived">("all");

  const filteredProjects = projects.filter(
    (p) => statusFilter === "all" || p.status === statusFilter
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Research Projects</h1>
            <p className="text-sm text-slate-500">
              Group related observations into scientific research initiatives.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm transition"
          >
            {showCreate ? "Cancel" : "+ New Project"}
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex space-x-2 border-b border-slate-200 pb-2">
          {(["all", "active", "completed", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              aria-pressed={statusFilter === tab}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition ${
                statusFilter === tab
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {tab} ({tab === "all" ? projects.length : projects.filter((p) => p.status === tab).length})
            </button>
          ))}
        </div>

        {/* Create Project Panel */}
        {showCreate && (
          <form onSubmit={handleCreateProject} className="bg-white p-6 rounded-lg border border-indigo-100 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Create New Project</h2>
            <div>
              <label htmlFor="new-project-title" className="block text-xs font-medium text-slate-700 mb-1">Project Title *</label>
              <input
                id="new-project-title"
                type="text"
                required
                maxLength={200}
                placeholder="e.g. Urban Bird Ecology Study"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-project-field" className="block text-xs font-medium text-slate-700 mb-1">Field / Discipline (Optional)</label>
                <input
                  id="new-project-field"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Ornithology, Marine Biology"
                  value={field}
                  onChange={(e) => setField(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>

              <div>
                <label htmlFor="new-project-tags" className="block text-xs font-medium text-slate-700 mb-1">Tags (Comma-separated)</label>
                <input
                  id="new-project-tags"
                  type="text"
                  placeholder="birds, migration, weather"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-project-description" className="block text-xs font-medium text-slate-700 mb-1">Description (Optional)</label>
              <textarea
                id="new-project-description"
                rows={3}
                placeholder="Brief summary of research goals..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        )}

        {/* Projects Grid */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-lg border border-slate-200">
            <p className="text-slate-500 text-sm">
              {projects.length === 0 ? "No projects created yet." : `No ${statusFilter} projects found.`}
            </p>
            {projects.length === 0 && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Create Your First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((proj) => (
              <div key={proj.id} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-between hover:border-indigo-200 transition">
                <div>
                  <div className="flex items-start justify-between">
                    {proj.field && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {proj.field}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 capitalize">{proj.status}</span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-slate-900">
                    <Link to={`/projects/${proj.id}`} className="hover:text-indigo-600">
                      {proj.title}
                    </Link>
                  </h3>
                  {proj.description && (
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">{proj.description}</p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex gap-1">
                    {proj.tags.map((t) => (
                      <span key={t} className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <Link to={`/projects/${proj.id}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                    View &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
