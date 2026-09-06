import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  Check,
  ListChecks,
  Link2,
  FolderKanban,
} from "lucide-react";
import type { Analysis } from "../lib/api";
import { createResearchTask, fetchProject, fetchAnalysis } from "../lib/api";

interface AnalysisViewerProps {
  analysis: Analysis;
  onTaskCreated?: () => void;
}

export const AnalysisViewer: React.FC<AnalysisViewerProps> = ({ analysis, onTaskCreated }) => {
  const [acceptedIndices, setAcceptedIndices] = useState<number[]>([]);
  const [acceptingIndex, setAcceptingIndex] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Source summaries state (derived from prop or lazily hydrated)
  const [sourceSummaries, setSourceSummaries] = useState<NonNullable<Analysis["sourceSummaries"]>>(
    analysis.sourceSummaries || []
  );

  // Project existence state (dangling project resilience per API.md §7.2 / Plan §3.3)
  const [projectState, setProjectState] = useState<{
    loading: boolean;
    exists: boolean;
    title?: string;
  }>({
    loading: Boolean(analysis.projectId),
    exists: false,
  });

  // Resolve sourceSummaries if not already provided on the analysis object
  useEffect(() => {
    if (analysis.sourceSummaries && analysis.sourceSummaries.length > 0) {
      setSourceSummaries(analysis.sourceSummaries);
      return;
    }

    let isMounted = true;
    if (analysis.id && analysis.observationIds && analysis.observationIds.length > 0) {
      fetchAnalysis(analysis.id, true)
        .then((res) => {
          if (isMounted && res.data.sourceSummaries) {
            setSourceSummaries(res.data.sourceSummaries);
          }
        })
        .catch(() => {
          // If detailed fetch fails, fall back to empty
        });
    }

    return () => {
      isMounted = false;
    };
  }, [analysis.id, analysis.sourceSummaries, analysis.observationIds]);

  // Resolve projectId existence (API.md §7.2: project deletion retains analyses' projectId)
  useEffect(() => {
    if (!analysis.projectId) {
      setProjectState({ loading: false, exists: false });
      return;
    }

    let isMounted = true;
    setProjectState({ loading: true, exists: false });

    fetchProject(analysis.projectId)
      .then((res) => {
        if (isMounted) {
          setProjectState({
            loading: false,
            exists: true,
            title: res.data.title,
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          // 404 or fetch failure means the project was deleted -> [Unfiled project]
          setProjectState({
            loading: false,
            exists: false,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [analysis.projectId]);

  const handleAcceptSuggestion = async (index: number) => {
    try {
      setAcceptingIndex(index);
      setActionError(null);
      await createResearchTask({
        source: "gemini",
        sourceAnalysisId: analysis.id,
        suggestionIndex: index,
        projectId: analysis.projectId,
      });
      setAcceptedIndices((prev) => [...prev, index]);
      onTaskCreated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to accept research suggestion as task";
      setActionError(msg);
    } finally {
      setAcceptingIndex(null);
    }
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "high":
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">High Confidence</span>;
      case "medium":
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">Medium Confidence</span>;
      case "low":
        return <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-app-border">Low Confidence</span>;
      default:
        return null;
    }
  };

  // Build a list of all referenced observations, merging observationIds with sourceSummaries
  const allReferencedObs = (analysis.observationIds || []).map((obsId) => {
    const foundSummary = sourceSummaries.find((s) => s.observationId === obsId);
    return {
      observationId: obsId,
      found: foundSummary ? foundSummary.found : true,
      title: foundSummary?.title,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-app-border shadow-xs overflow-hidden space-y-5 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" />
            <span className="capitalize">{analysis.type.replace("_", " ")}</span>
          </span>
          <span className="text-xs text-slate-400">
            {new Date(analysis.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
            {analysis.model}
          </span>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {actionError}
        </div>
      )}

      {/* Summary */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          AI Interpretation Summary
        </h4>
        <p className="text-sm text-slate-800 leading-relaxed bg-slate-50/60 p-3.5 rounded-lg border border-slate-100">
          {analysis.summary}
        </p>
      </div>

      {/* Key Findings */}
      {analysis.keyFindings && analysis.keyFindings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Key Findings
          </h4>
          <ul className="space-y-1.5">
            {analysis.keyFindings.map((finding, idx) => (
              <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hypotheses */}
      {analysis.hypotheses && analysis.hypotheses.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-600" /> Formulated Hypotheses
          </h4>
          <div className="space-y-2.5">
            {analysis.hypotheses.map((h, idx) => (
              <div key={idx} className="p-3 bg-brand-50/40 border border-brand-100 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">{h.statement}</span>
                  {getConfidenceBadge(h.confidence)}
                </div>
                {h.supportingObservationIds && h.supportingObservationIds.length > 0 && (
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-1">
                    <span>Supporting observations:</span>
                    {h.supportingObservationIds.map((obsId) => {
                      const summary = sourceSummaries.find((s) => s.observationId === obsId);
                      if (summary && !summary.found) {
                        return (
                          <span
                            key={obsId}
                            className="text-slate-400 bg-slate-100 italic px-1.5 py-0.5 rounded border border-app-border"
                            title={`Observation ${obsId} was deleted`}
                          >
                            [Observation deleted]
                          </span>
                        );
                      }
                      return (
                        <Link
                          key={obsId}
                          to={`/observations/${obsId}`}
                          className="font-mono text-brand-700 bg-white hover:bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100 transition"
                        >
                          {summary?.title || obsId}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uncertainties & Data Limitations */}
      {analysis.uncertainties && analysis.uncertainties.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Scientific Uncertainties & Limitations
          </h4>
          <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg space-y-1">
            {analysis.uncertainties.map((unc, idx) => (
              <div key={idx} className="text-xs text-amber-900 flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>{unc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      {analysis.suggestedQuestions && analysis.suggestedQuestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-brand-600" /> Follow-up Questions
          </h4>
          <ul className="space-y-1">
            {analysis.suggestedQuestions.map((q, idx) => (
              <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-brand-500 mt-0.5 shrink-0" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Next Steps (Tasks) */}
      {analysis.suggestedNextSteps && analysis.suggestedNextSteps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5 text-brand-600" /> Recommended Experimental Tasks
          </h4>
          <div className="space-y-2">
            {analysis.suggestedNextSteps.map((step, idx) => {
              const isAccepted = acceptedIndices.includes(idx);
              const isAccepting = acceptingIndex === idx;

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-app-border rounded-lg transition-colors"
                >
                  <span className="text-xs text-slate-800 flex-1">{step}</span>
                  {isAccepted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md shrink-0">
                      <Check className="w-3 h-3" /> Added to Tasks
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAcceptSuggestion(idx)}
                      disabled={isAccepting}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-md transition-colors shadow-xs shrink-0"
                    >
                      {isAccepting ? "Adding..." : "+ Accept as Task"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Referenced Sources Section (Dangling source resilience per API.md §7.2 / Plan §3.3) */}
      <div className="pt-3 border-t border-slate-100 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-slate-400" /> Referenced Sources & Scope
        </h4>

        {/* Project reference (F2: live link or [Unfiled project] pill) */}
        {analysis.projectId && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Initiative / Project:</span>
            {projectState.loading ? (
              <span className="text-slate-400 text-xs">Checking project...</span>
            ) : projectState.exists ? (
              <Link
                to={`/projects/${analysis.projectId}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50/70 hover:bg-brand-100 text-brand-700 rounded border border-brand-200 text-xs transition"
              >
                <FolderKanban className="w-3 h-3" />
                <span>{projectState.title || analysis.projectId}</span>
              </Link>
            ) : (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-400 italic rounded border border-app-border text-xs"
                title={`Project ${analysis.projectId} was deleted from canonical records`}
              >
                [Unfiled project]
              </span>
            )}
          </div>
        )}

        {/* Observation references (F1: live link or [Observation deleted] pill) */}
        {allReferencedObs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Observations:</span>
            {allReferencedObs.map((src) => {
              if (!src.found) {
                return (
                  <span
                    key={src.observationId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-400 italic rounded border border-app-border text-xs"
                    title={`Observation ${src.observationId} was deleted from canonical records`}
                  >
                    [Observation {src.observationId.slice(0, 8)}... deleted]
                  </span>
                );
              }
              return (
                <Link
                  key={src.observationId}
                  to={`/observations/${src.observationId}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50/70 hover:bg-brand-100 text-brand-700 rounded border border-brand-200 text-xs transition"
                >
                  <span>{src.title || src.observationId}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Provenance Footer */}
      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
        <span>Prompt Version: <code className="text-slate-600 font-mono">{analysis.promptVersion}</code></span>
        <span>ID: <code className="text-slate-600 font-mono">{analysis.id}</code></span>
      </div>
    </div>
  );
};
