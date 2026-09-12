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

  // Pagination — cursor-based. Page 1 opens with no cursor; each later page
  // records the cursor it was opened with so "Previous" can walk back through
  // visited pages without a backend prev-cursor.
  const [page, setPage] = useState(1);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // Exact match count from the backend (meta.total). Null when absent —
  // currently for `q` searches, where the backend cannot count exactly.
  const [total, setTotal] = useState<number | null>(null);

  async function loadObservations(cursor?: string, targetPage = 1) {
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
      setTotal(res.meta?.total ?? null);
      setPage(targetPage);
    } catch (err) {
      console.error("Failed to fetch observations", err);
    } finally {
      setLoading(false);
    }
  }

  // Filter/search changes restart the list from the first page.
  function restartFromFirstPage() {
    setPageCursors([null]);
    loadObservations(undefined, 1);
  }

  function goToNextPage() {
    if (!hasMore || !nextCursor) return;
    setPageCursors((prev) => [...prev, nextCursor]);
    loadObservations(nextCursor, page + 1);
  }

  function goToPrevPage() {
    if (page <= 1) return;
    const targetCursor = pageCursors[page - 2] ?? null;
    loadObservations(targetCursor ?? undefined, page - 1);
  }

  useEffect(() => {
    fetchProjects().then((res) => setProjects(res.data || []));
  }, []);

  useEffect(() => {
    restartFromFirstPage();
  }, [selectedProject, selectedStatus, sortBy]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    restartFromFirstPage();
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-app-heading">Observations</h1>
            <p className="text-sm text-slate-500">
              Your recorded field notes, scientific observations, and journal entries.
            </p>
          </div>
          <Link
            to="/observations/new"
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 shadow-sm transition"
          >
            + New Observation
          </Link>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-lg border border-app-border shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              aria-label="Search observations"
              placeholder="Search title, description, hypothesis, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-medium hover:bg-brand-400 transition cursor-pointer"
            >
              Search
            </button>
          </form>

          <div className="flex flex-wrap gap-4 items-center justify-between text-sm">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label htmlFor="filter-project" className="text-xs font-medium text-slate-500 mr-2">Project:</label>
                <select
                  id="filter-project"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white cursor-pointer"
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
                <label htmlFor="filter-status" className="text-xs font-medium text-slate-500 mr-2">Status:</label>
                <select
                  id="filter-status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white cursor-pointer"
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
              <label htmlFor="sort-by" className="text-xs font-medium text-slate-500 mr-2">Sort By:</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "updated" | "observed")}
                className="px-2.5 py-1.5 border border-slate-300 rounded-md text-sm bg-white cursor-pointer"
              >
                <option value="updated">Recently Updated (Default)</option>
                <option value="observed">Observed Date (Scientific)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Observation Records — section heading separates filters from list */}
        <section aria-labelledby="records-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="records-heading" className="text-lg font-bold text-app-heading">
              Observation Records
            </h2>
            {!loading && observations.length > 0 && (
              <span className="text-xs font-medium text-slate-500">
                {total != null
                  ? `Showing ${(page - 1) * 10 + 1}–${(page - 1) * 10 + observations.length} of ${total} observations`
                  : `Page ${page} — ${observations.length} shown${hasMore ? " (more available)" : ""}`}
              </span>
            )}
          </div>

          {loading ? (
            <div className="bg-white p-8 rounded-xl border border-app-border shadow-sm text-center text-slate-500 text-sm">
              Loading observations...
            </div>
          ) : observations.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-app-border shadow-sm text-center space-y-3">
              <p className="text-slate-500 text-sm">No observations match your current filter.</p>
              <Link
                to="/observations/new"
                className="inline-block px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700"
              >
                Create Observation
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {observations.map((obs) => (
                <Link
                  key={obs.id}
                  to={`/observations/${obs.id}`}
                  className="group block bg-white p-5 sm:p-6 rounded-xl border border-app-border shadow-sm hover:border-brand-300 hover:shadow-xs transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-app-heading transition-colors group-hover:text-brand-600">
                        {obs.title}
                      </h3>
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

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-3">
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
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && (page > 1 || hasMore) && (
            <div className="flex items-center justify-center gap-4 pt-1">
              <button
                onClick={goToPrevPage}
                disabled={page <= 1}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                &larr; Previous
              </button>
              <span className="text-xs text-slate-500" aria-live="polite">
                {total != null
                  ? `Page ${page} of ${Math.max(1, Math.ceil(total / 10))}`
                  : `Page ${page}`}
              </span>
              <button
                onClick={goToNextPage}
                disabled={!hasMore || !nextCursor}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                Next &rarr;
              </button>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
