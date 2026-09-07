import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { createObservation, ApiRequestError } from "../../lib/api";
import { useToast } from "../ui/Toast";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 20000;

/**
 * Quick Capture (plan §5.1): real draft save against the existing
 * POST /observations API (`status: "draft"`). Title + description only —
 * everything else waits for the full form. On success the user is routed to
 * the created record's edit page (reviewer decision 2026-09-07) and the
 * dashboard caches are invalidated so counts stay honest.
 */
export function QuickCaptureForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [touched, setTouched] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (body: { title: string; description: string }) =>
      createObservation({
        title: body.title,
        description: body.description,
        status: "draft",
        observedAt: new Date().toISOString(),
      }),
    onSuccess: async (result) => {
      toast.success("Draft saved to your journal.");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/observations/${result.data.id}/edit`);
    },
  });

  const titleError = touched && !title.trim() ? "Title is required." : null;
  const descriptionError =
    touched && !description.trim() ? "Describe what you observed." : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!title.trim() || !description.trim() || mutation.isPending) return;
    mutation.mutate({ title: title.trim(), description: description.trim() });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-xl border border-app-border p-6 space-y-4"
      aria-labelledby="quick-capture-heading"
    >
      <div>
        <h2 id="quick-capture-heading" className="text-base font-bold text-app-heading">
          Quick Capture
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Saves as a draft — refine it in the full form afterwards.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="qc-title" className="block text-sm font-medium text-slate-700">
          Observation title
        </label>
        <input
          id="qc-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE}
          placeholder="e.g. Fungal growth after rainfall"
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? "qc-title-error" : undefined}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-hidden focus:ring-2 focus:ring-brand-500 ${
            titleError ? "border-red-400" : "border-app-border"
          }`}
        />
        {titleError && (
          <p id="qc-title-error" role="alert" className="text-xs text-red-700">
            {titleError}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="qc-description" className="block text-sm font-medium text-slate-700">
          What did you observe?
        </label>
        <textarea
          id="qc-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_DESCRIPTION}
          rows={3}
          placeholder="Conditions, behavior, measurements worth noting…"
          aria-invalid={Boolean(descriptionError)}
          aria-describedby={descriptionError ? "qc-description-error" : undefined}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-hidden focus:ring-2 focus:ring-brand-500 resize-y ${
            descriptionError ? "border-red-400" : "border-app-border"
          }`}
        />
        {descriptionError && (
          <p id="qc-description-error" role="alert" className="text-xs text-red-700">
            {descriptionError}
          </p>
        )}
      </div>

      {mutation.isError && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          {mutation.error instanceof ApiRequestError
            ? mutation.error.message
            : "Could not save the draft. Try again."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-md text-sm font-semibold hover:bg-brand-700 transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {mutation.isPending ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={() =>
            navigate("/observations/new", {
              // Carry the typed values into the full form without saving a
              // draft — the record only exists once the form is submitted.
              state: {
                quickCapture: { title: title.trim(), description: description.trim() },
              },
            })
          }
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-800 transition-colors ml-2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500 rounded"
        >
          Open Full Form
        </button>
      </div>
    </form>
  );
}
