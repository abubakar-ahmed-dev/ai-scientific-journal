import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  fetchObservation,
  fetchObservationVersions,
  deleteObservation,
  createConversation,
} from "../lib/api";
import type { Observation, ObservationVersion } from "../lib/api";
import { Layout } from "../components/Layout";
import { Sparkles } from "lucide-react";

export default function ObservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [observation, setObservation] = useState<Observation | null>(null);
  const [versions, setVersions] = useState<ObservationVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const obs = await fetchObservation(id!);
        setObservation(obs.data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load observation");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function loadVersionHistory() {
    if (!id || versions.length > 0) {
      setShowVersions(!showVersions);
      return;
    }
    try {
      const verRes = await fetchObservationVersions(id);
      setVersions(verRes.data || []);
      setShowVersions(true);
    } catch (err) {
      console.error("Failed to load version history", err);
    }
  }

  async function handleDiscussWithAI() {
    if (!observation) return;
    setStartingChat(true);
    try {
      const res = await createConversation({
        title: `Discussion: ${observation.title}`,
        contextType: "observation",
        contextId: observation.id,
      });
      navigate(`/conversations?id=${res.data.id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to start AI discussion");
      setStartingChat(false);
    }
  }

  async function handleDelete() {
    if (!id || !window.confirm("Are you sure you want to delete this observation? This action cannot be undone.")) {
      return;
    }
    setDeleting(true);
    try {
      await deleteObservation(id);
      navigate("/observations");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete observation");
      setDeleting(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <Link to="/observations" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            &larr; Back to Observations
          </Link>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDiscussWithAI}
              disabled={startingChat || !observation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {startingChat ? "Opening Chat..." : "Discuss with AI"}
            </button>
            <Link
              to={`/observations/${id}/edit`}
              className="px-3.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3.5 py-1.5 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading observation...</div>
        ) : error || !observation ? (
          <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error || "Observation not found."}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mb-2 ${
                    observation.status === "draft"
                      ? "bg-amber-100 text-amber-800"
                      : observation.status === "analyzed"
                      ? "bg-purple-100 text-purple-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {observation.status}
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{observation.title}</h1>
                <p className="text-xs text-slate-400 mt-1">
                  Observed: {new Date(observation.observedAt).toLocaleString()} &bull; Version: v{observation.version}
                </p>
              </div>

              <button
                onClick={loadVersionHistory}
                className="text-xs text-indigo-600 hover:text-indigo-800 border border-indigo-200 px-2.5 py-1.5 rounded"
              >
                {showVersions ? "Hide Version History" : "View Version History"}
              </button>
            </div>

            {/* Version History Drawer/Section */}
            {showVersions && (
              <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Version History Snapshots</h3>
                {versions.length === 0 ? (
                  <p className="text-xs text-slate-500">No previous edit snapshots for this observation.</p>
                ) : (
                  <ul className="space-y-3">
                    {versions.map((ver) => (
                      <li key={ver.id} className="p-3 bg-white rounded border border-slate-200 text-xs space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>Revision v{ver.version}</span>
                          <span className="text-slate-400">{new Date(ver.editedAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-700"><strong>Title:</strong> {ver.title}</p>
                        <p className="text-slate-600 line-clamp-2"><strong>Description:</strong> {ver.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-700">Description</h2>
              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{observation.description}</p>
            </div>

            {/* Hypothesis */}
            {observation.hypothesis && (
              <div className="space-y-2 bg-indigo-50/50 p-4 rounded-md border border-indigo-100">
                <h2 className="text-sm font-semibold text-indigo-900">User Hypothesis</h2>
                <p className="text-indigo-950 text-sm leading-relaxed">{observation.hypothesis}</p>
              </div>
            )}

            {/* Notes */}
            {observation.notes && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-700">Supplementary Notes</h2>
                <p className="text-slate-700 text-sm whitespace-pre-wrap">{observation.notes}</p>
              </div>
            )}

            {/* Measurements Table */}
            {observation.measurements.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700">Measurements</h2>
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Value</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Unit</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {observation.measurements.map((m, idx) => (
                        <tr key={m.id || idx}>
                          <td className="px-4 py-2 font-medium text-slate-800">{m.name}</td>
                          <td className="px-4 py-2 text-slate-700">{m.value}</td>
                          <td className="px-4 py-2 text-slate-500">{m.unit}</td>
                          <td className="px-4 py-2 text-slate-400">{m.notes || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Location & Tags Footer */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
              <div>
                {observation.location && (
                  <span>
                    Location: <strong>{observation.location.label || "Pinned"}</strong> (
                    {observation.location.precision === "hidden"
                      ? "Coordinates Hidden"
                      : `${observation.location.latitude.toFixed(4)}, ${observation.location.longitude.toFixed(4)}`}
                    )
                  </span>
                )}
              </div>

              {observation.tags.length > 0 && (
                <div className="flex gap-1.5">
                  {observation.tags.map((t) => (
                    <span key={t} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
