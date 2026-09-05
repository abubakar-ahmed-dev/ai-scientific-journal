import React, { useState } from "react";
import { Plus, FolderKanban } from "lucide-react";
import { createProject } from "../lib/api";
import type { Project } from "../lib/api";

interface InlineProjectCreatorProps {
  /** Newly created project is appended to the parent form's project list. */
  onCreated: (project: Project) => void;
  /** Compact style for use inside a dropdown row; normal otherwise. */
  compact?: boolean;
}

/**
 * Inline "+ New Project" affordance for forms whose only project selection is
 * a dropdown (observation form, new-chat modal, research-task creation).
 * Creating a project in place appends it to the list and selects it — the
 * user never loses their in-progress work to visit the projects page.
 */
export const InlineProjectCreator: React.FC<InlineProjectCreatorProps> = ({
  onCreated,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [field, setField] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createProject({
        title: title.trim(),
        field: field.trim() || null,
      });
      onCreated(res.data);
      setTitle("");
      setField("");
      setOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 focus:outline-hidden"
            : "text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 focus:outline-hidden"
        }
      >
        <Plus className="w-3.5 h-3.5" />
        New project
      </button>
    );

  }

  return (
    <form
      onSubmit={handleCreate}
      className={`rounded-md border border-indigo-200 bg-indigo-50/50 ${compact ? "p-2.5 space-y-2" : "p-3 space-y-2.5"}`}
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800">
        <FolderKanban className="w-3.5 h-3.5" />
        Create a new project
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input
        autoFocus
        type="text"
        required
        maxLength={200}
        placeholder="Project title (e.g. Urban Bird Ecology Study)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-500"
      />

      <input
        type="text"
        maxLength={100}
        placeholder="Field / discipline (optional)"
        value={field}
        onChange={(e) => setField(e.target.value)}
        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm"
      />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim() || creating}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {creating ? "Creating..." : "Create & select"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
