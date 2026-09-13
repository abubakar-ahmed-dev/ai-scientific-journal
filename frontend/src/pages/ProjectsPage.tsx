import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchProjects, createProject } from "../lib/api";
import type { Project } from "../lib/api";
import { Layout } from "../components/Layout";
import { Badge, type BadgeVariant } from "../components/ui/Badge";
import { TagList } from "../components/ui/TagList";
import { useToast } from "../components/ui/Toast";

const projectStatusVariant: Record<string, BadgeVariant> = {
  active: "emerald",
  completed: "blue",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

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
      toast.success("Project created.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  // Filter state
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const haystack = `${p.title} ${p.field ?? ""} ${p.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hasActiveFilters = statusFilter !== "all" || searchQuery.trim() !== "";

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-app-heading">Research Projects</h1>
            <p className="text-sm text-slate-500">
              Group related observations into scientific research initiatives.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 shadow-sm transition"
          >
            {showCreate ? "Cancel" : "+ New Project"}
          </button>
        </div>

        {/* Search + Status Filter Tabs (guidelines §51) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-app-border pb-2">
          {(["all", "active", "completed", "archived"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              aria-pressed={statusFilter === tab}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition ${
                statusFilter === tab
                  ? "bg-brand-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-app-border"
              }`}
            >
              {tab} ({tab === "all" ? projects.length : projects.filter((p) => p.status === tab).length})
            </button>
          ))}

          <div className="sm:ml-auto flex items-center gap-2">
            <input
              type="text"
              aria-label="Search projects"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-md text-xs border border-app-border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 w-48"
            />
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-xs font-semibold text-brand-600 hover:text-brand-800"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Create Project Panel */}
        {showCreate && (
          <form onSubmit={handleCreateProject} className="bg-white p-6 rounded-lg border border-brand-100 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-app-heading">Create New Project</h2>
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
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-brand-500"
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
                className="px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </form>
        )}

        {/* Projects Grid — hidden while the create form is open so the empty
            state never competes with the form (guidelines §53: no redundant
            prompts alongside an active task). */}
        {!showCreate && (loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading projects...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-lg border border-app-border">
            <p className="text-slate-500 text-sm">
              {projects.length === 0
                ? "No projects created yet."
                : hasActiveFilters
                ? "No projects match your filters."
                : `No ${statusFilter} projects found.`}
            </p>
            {projects.length === 0 && (
              <button
                onClick={() => setShowCreate(true)}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700"
              >
                Create Your First Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((proj) => (
              <Link
                key={proj.id}
                to={`/projects/${proj.id}`}
                aria-label={`Open project: ${proj.title}`}
                className="group flex flex-col justify-between bg-white p-6 rounded-xl border border-app-border shadow-xs hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    {proj.field ? (
                      <Badge variant="brand">
                        <span className="truncate">{proj.field}</span>
                      </Badge>
                    ) : (
                      <span />
                    )}
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={projectStatusVariant[proj.status] ?? "neutral"} className="capitalize">
                        {proj.status}
                      </Badge>
                      <ArrowRight className="w-4 h-4 -translate-x-1 text-brand-600 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-display font-bold leading-snug text-app-heading transition-colors group-hover:text-brand-700">
                    {proj.title}
                  </h3>
                  {proj.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 line-clamp-2">
                      {proj.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <TagList tags={proj.tags} />
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </Layout>
  );
}
