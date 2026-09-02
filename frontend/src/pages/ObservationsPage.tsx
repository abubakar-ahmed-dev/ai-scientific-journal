import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchObservations, fetchProjects } from "../lib/api";
import type { Observation, Project } from "../lib/api";
import { Layout } from "../components/Layout";

export default function ObservationsPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [sortBy, setSortBy] = useState<"updated" | "observed">("updated");

  // Pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function loadObservations(cursor?: string) {
    setLoading(true);
    try {
      const res = await fetchObservations({
        limit: 10,
        cursor,
        sort: sortBy,
        projectId: selectedProject || undefined,
        status: selectedStatus || undefined,
        q: searchQuery || undefined,
      });

      setObservations(res.data || []);
      setNextCursor(res.meta?.nextCursor || null);
      setHasMore(!!res.meta?.hasMore);
    } catch (err) {
      console.error("Failed to fetch observations", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects().then((res) => setProjects(res.data || []));
  }, []);

  useEffect(() => {
    loadObservations();
  }, [selectedProject, selectedStatus, sortBy]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadObservations();
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Observations</h1>
            <p className="text-sm text-slate-500">
              Your recorded field notes, scientific observations, and journal entries.
            </p>
          </div>
          <Link
            to="/observations/new"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 shadow-sm transition"
          >
            + New Observation
          </Link>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search title, description, hypothesis, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm font-medium hover:bg-slate-900 transition"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-4 items-center justify-between text-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="text-xs font-medium text-slate-500 mr-2">Project:</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="">All Projects</option>
                  <option value="unfiled">Unfiled Only</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mr-2">Status:</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="observed">Observed</option>
                  <option value="analyzed">Analyzed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mr-2">Sort By:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "updated" | "observed")}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white"
              >
                <option value="updated">Recently Updated (Default)</option>
                <option value="observed">Observed Date (Scientific)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Observations List */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading observations...</div>
          ) : observations.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <p className="text-slate-500 text-sm">No observations match your current filter.</p>
              <Link
                to="/observations/new"
                className="inline-block px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Create Observation
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {observations.map((obs) => (
                <div key={obs.id} className="p-6 hover:bg-slate-50 transition flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link
                        to={`/observations/${obs.id}`}
                        className="text-lg font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {obs.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{obs.description}</p>
                    </div>

                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${
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

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2">
                    <span>
                      Observed: <strong>{new Date(obs.observedAt).toLocaleString()}</strong>
                    </span>
                    <span>Version: v{obs.version}</span>
                    {obs.measurements.length > 0 && (
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        {obs.measurements.length} Measurements
                      </span>
                    )}
                    {obs.location && (
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                        Location: {obs.location.label || obs.location.precision}
                      </span>
                    )}
                    {obs.tags.map((t) => (
                      <span key={t} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {hasMore && nextCursor && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-center">
              <button
                onClick={() => loadObservations(nextCursor)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition shadow-sm"
              >
                Load Next Page &rarr;
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
