import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Sparkles,
  Search,
  BookOpen,
  AlertTriangle,
  RotateCw,
  Info,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { askMyJournal, type AskResponse } from "../lib/api";

export const AskMyJournalPage: React.FC = () => {
  const [question, setQuestion] = useState("");
  const [lastAskedQuestion, setLastAskedQuestion] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);

  const askMutation = useMutation({
    mutationFn: (q: string) => askMyJournal({ question: q }),
    onSuccess: (data) => {
      setResult(data);
      setLastAskedQuestion(question);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || askMutation.isPending) return;
    askMutation.mutate(question.trim());
  };

  const handleRetry = () => {
    if (question.trim()) {
      askMutation.mutate(question.trim());
    }
  };

  // Prefer the explicit backend flag (ask-grounded-v2); keep the evidence-empty
  // heuristic as fallback for cached/older responses.
  const isInsufficientEvidence = Boolean(
    result && (result.insufficientEvidence === true || !result.evidence || result.evidence.length === 0)
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-brand-50 border border-brand-200 rounded-lg text-brand-600">
            <Search className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold text-app-heading tracking-tight">Ask My Journal</h1>
        </div>
        <p className="text-sm text-slate-600">
          Ask questions across your entire personal observation history. Answers are evidence-grounded
          directly in your recorded field notes and measurements.
        </p>
      </div>

      {/* Question Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-app-border shadow-xs p-5 space-y-4">
        <div className="space-y-2">
          <label htmlFor="journal-question" className="block text-sm font-semibold text-slate-800">
            Your Research Question
          </label>
          <div className="relative">
            <textarea
              id="journal-question"
              rows={3}
              className="w-full rounded-lg border border-slate-300 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition disabled:bg-slate-50"
              placeholder="e.g., Have I observed any hawks or falcons in the valley during winter? What patterns appeared in feeding times?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={2000}
              disabled={askMutation.isPending}
              required
            />
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>Minimum 1 character, maximum 2,000 characters.</span>
            <span>{question.length} / 2000</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={!question.trim() || askMutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-xs"
          >
            {askMutation.isPending ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Searching & Synthesizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Ask Journal</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Loading Skeleton */}
      {askMutation.isPending && (
        <div className="bg-white rounded-xl border border-app-border shadow-xs p-6 space-y-4 animate-pulse">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-brand-500 animate-spin" />
            <span className="text-sm font-medium text-slate-600">
              Retrieving relevant observations and synthesizing grounded answer...
            </span>
          </div>
          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          <div className="h-4 bg-slate-200 rounded w-2/3"></div>
        </div>
      )}

      {/* Error State */}
      {askMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span>Unable to complete journal query</span>
          </div>
          <p className="text-sm text-red-700">
            {askMutation.error instanceof Error ? askMutation.error.message : "An unexpected error occurred while querying your journal."}
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-800 transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Retry Query</span>
            </button>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && !askMutation.isPending && (
        <div className="space-y-6">
          {/* Main Answer Card */}
          <div className="bg-white rounded-xl border border-app-border shadow-xs p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                  <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                  <span>Grounded Research Answer</span>
                </span>
                {result.model && result.model !== "none" && (
                  <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    {result.model}
                  </span>
                )}
              </div>
              {result.promptVersion && (
                <span className="text-xs text-slate-400 font-mono">
                  {result.promptVersion}
                </span>
              )}
            </div>

            {/* Answer Text */}
            <div className="text-slate-800 leading-relaxed text-base whitespace-pre-line">
              {result.answer}
            </div>

            {/* Partial-coverage notice (fixing-plan #16) */}
            {result.truncated && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex gap-2.5 text-slate-700">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs">
                  Only your most recent observations were searched — older records may not have been
                  considered for this answer.
                </p>
              </div>
            )}
            {/* Insufficient Evidence Notice */}
            {isInsufficientEvidence && (
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-4 flex gap-3 text-amber-900">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <span className="font-semibold block">No direct matches in your journal records</span>
                  <p className="text-amber-800 text-xs">
                    Your journal observations do not currently contain records matching "{lastAskedQuestion}".
                    Consider recording a new field observation or adjusting your search keywords.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Supporting Evidence Section */}
          {result.evidence.length > 0 && (
            <div className="bg-white rounded-xl border border-app-border shadow-xs p-6 space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm border-b border-slate-100 pb-3">
                <BookOpen className="w-4 h-4 text-brand-600" />
                <span>Supporting Journal Evidence ({result.evidence.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.evidence.map((ev) => (
                  <Link
                    key={ev.observationId}
                    to={`/observations/${ev.observationId}`}
                    className="group block p-4 rounded-lg border border-app-border hover:border-brand-300 hover:bg-brand-50/30 transition shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-app-heading group-hover:text-brand-600 transition line-clamp-1">
                        {ev.title}
                      </h4>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-brand-500 shrink-0 mt-0.5" />
                    </div>
                    {ev.observedAt && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>
                          {new Date(ev.observedAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                    {ev.note && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 italic bg-slate-50 p-2 rounded border border-slate-100">
                        "{ev.note}"
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Uncertainties & Caveats */}
          {result.uncertainties && result.uncertainties.length > 0 && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Uncertainties & Research Caveats</span>
              </div>
              <ul className="space-y-1.5 pl-5 list-disc text-xs text-amber-900/90 leading-normal">
                {result.uncertainties.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
