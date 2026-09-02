import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchObservations, fetchProjects } from "../lib/api";
import type { Observation, Project } from "../lib/api";
import { Layout } from "../components/Layout";

export default function DashboardPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [obsRes, projRes] = await Promise.all([
          fetchObservations({ limit: 5 }),
          fetchProjects({ limit: 10 }),
        ]);
        setObservations(obsRes.data || []);
        setProjects(projRes.data || []);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Research Dashboard</h1>
            <p className="text-sm text-slate-500">
              Overview of your scientific observations and active research projects.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Link
              to="/projects"
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition shadow-sm"
            >
              Manage Projects
            </Link>
            <Link
              to="/observations/new"
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition shadow-sm"
            >
              + New Observation
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Recent Observations</h3>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{observations.length}</p>
            <Link to="/observations" className="mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-800 inline-block">
              View all observations &rarr;
            </Link>
          </div>

          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Active Projects</h3>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {projects.filter((p) => p.status === "active").length}
            </p>
            <Link to="/projects" className="mt-4 text-xs font-medium text-indigo-600 hover:text-indigo-800 inline-block">
              View all projects &rarr;
            </Link>
          </div>
        </div>

        {/* Recent Observations List */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Journal Observations</h2>
            <Link to="/observations" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              View All
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading observations...</div>
          ) : observations.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500 text-sm">No observations recorded yet.</p>
              <Link
                to="/observations/new"
                className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Record Your First Observation
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {observations.map((obs) => (
                <li key={obs.id} className="p-6 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <div>
                      <Link
                        to={`/observations/${obs.id}`}
                        className="text-base font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {obs.title}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{obs.description}</p>
                    </div>
                    <span
                      className={`ml-4 px-2.5 py-0.5 rounded-full text-xs font-medium ${
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

                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                    <span>Observed: {new Date(obs.observedAt).toLocaleDateString()}</span>
                    <span>Measurements: {obs.measurements.length}</span>
                    {obs.location && <span>Location: {obs.location.label || obs.location.precision}</span>}
                    {obs.tags.length > 0 && (
                      <div className="flex gap-1">
                        {obs.tags.map((t) => (
                          <span key={t} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
