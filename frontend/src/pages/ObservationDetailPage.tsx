import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import {
  fetchObservation,
  deleteObservation,
  fetchObservationVersions,
  createConversation,
  generateAnalysis,
  generateResearchSuggestions,
  fetchAnalyses,
  searchObservations,
} from "../lib/api";
import type { Observation, ObservationVersion, Analysis, SearchResponseItem } from "../lib/api";
import { AnalysisViewer } from "../components/AnalysisViewer";
import { Sparkles, MessageSquare, Lightbulb, ListChecks, BookOpen } from "lucide-react";

export default function ObservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [versions, setVersions] = useState<ObservationVersion[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [relatedObservations, setRelatedObservations] = useState<SearchResponseItem[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function loadRelated(obs: Observation) {
    try {
      const query = `${obs.title} ${(obs.tags || []).join(" ")}`.trim();
      if (!query) return;
      const res = await searchObservations({ query, limit: 5 });
      const filtered = (res || []).filter((item) => item.observationId !== obs.id);
      setRelatedObservations(filtered);
    } catch {
      // Non-blocking for base detail view (PRD NFR-02)
    }
  }

  async function loadObservation() {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchObservation(id);
      setObservation(res.data);
      loadRelated(res.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load observation";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalyses() {
    if (!id) return;
    try {
      const res = await fetchAnalyses({ observationId: id });
      setAnalyses(res.data || []);
    } catch {
      // Non-blocking for base detail view
    }
  }

  useEffect(() => {
    if (!id) return;
    loadObservation();
    loadAnalyses();
  }, [id]);

  const loadVersionHistory = async () => {
    if (!id) return;
    try {
      const res = await fetchObservationVersions(id);
      setVersions(res.data);
      setShowVersions(!showVersions);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load versions";
      setError(msg);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm("Are you sure you want to delete this observation? This action cannot be undone.")) return;
    try {
      setDeleting(true);
      await deleteObservation(id);
      navigate("/observations");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete observation";
      setError(msg);
      setDeleting(false);
    }
  };

  const handleStartDiscussion = async () => {
    if (!observation) return;
    try {
      setStartingChat(true);
      const convRes = await createConversation({
        title: `Discussion: ${observation.title}`,
        projectId: observation.projectId,
        contextType: "observation",
        contextId: observation.id,
      });
      navigate(`/conversations?id=${convRes.data.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start conversation";
      setError(msg);
      setStartingChat(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!id) return;
    try {
      setAnalyzing(true);
      setAiError(null);
      const res = await generateAnalysis({
        observationIds: [id],
        projectId: observation?.projectId || undefined,
      });
      setAnalyses((prev) => [res.data, ...prev]);
      if (observation) {
        setObservation({ ...observation, status: "analyzed" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to run AI analysis";
      setAiError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunSuggestions = async () => {
    if (!id) return;
    try {
      setSuggesting(true);
      setAiError(null);
      const res = await generateResearchSuggestions({
        observationIds: [id],
        projectId: observation?.projectId || undefined,
      });
      setAnalyses((prev) => [res.data, ...prev]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate research suggestions";
      setAiError(msg);
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/observations"
            className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition"
          >
            &larr; Back to Observations
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing || loading || !observation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md shadow-xs transition"
            >
              <Sparkles className="w-4 h-4" />
              {analyzing ? "Analyzing..." : "Analyze with AI"}
            </button>

            <button
              onClick={handleRunSuggestions}
              disabled={suggesting || loading || !observation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 disabled:opacity-50 rounded-md transition"
            >
              <Lightbulb className="w-4 h-4 text-purple-600" />
              {suggesting ? "Generating..." : "Suggest Next Steps"}
            </button>

            <button
              onClick={handleStartDiscussion}
              disabled={startingChat || loading || !observation}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-50 rounded-md transition"
            >
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              {startingChat ? "Opening..." : "Discuss with AI"}
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

        {aiError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {aiError}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading observation...</div>
        ) : error || !observation ? (
          <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error || "Observation not found."}
          </div>
        ) : (
          <div className="space-y-6">
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
                          <tr key={idx}>
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

              {/* Tags Footer */}
              {observation.tags.length > 0 && (
                <div className="pt-4 border-t border-slate-100 flex gap-1.5">
                  {observation.tags.map((t) => (
                    <span key={t} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Related Observations Section */}
            {relatedObservations.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <span>Related Observations ({relatedObservations.length})</span>
                  </h3>
                  <span className="text-xs text-slate-400">Lexical similarity over journal</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {relatedObservations.map((item) => (
                    <Link
                      key={item.observationId}
                      to={`/observations/${item.observationId}`}
                      className="group block p-4 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 transition shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition line-clamp-1">
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded shrink-0">
                          {Math.round(item.score * 100)}% match
                        </span>
                      </div>
                      {item.observedAt && (
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(item.observedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                      {item.snippet && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                          {item.snippet}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analyses Section */}
            {analyses.length > 0 && (
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-indigo-600" />
                    AI Analyses & Structured Insights ({analyses.length})
                  </h2>
                </div>
                <div className="space-y-4">
                  {analyses.map((anl) => (
                    <AnalysisViewer key={anl.id} analysis={anl} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
