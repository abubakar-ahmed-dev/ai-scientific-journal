import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ListTodo,
  Plus,
  Sparkles,
  User,
  CheckCircle2,
  Clock,
  Archive,
  Trash2,
  X,
  Play,
  Pencil,
  FolderKanban,
} from "lucide-react";
import {
  fetchResearchTasks,
  createResearchTask,
  updateResearchTask,
  deleteResearchTask,
  fetchProjects,
} from "../lib/api";
import type { ResearchTask, Project } from "../lib/api";
import { InlineProjectCreator } from "../components/InlineProjectCreator";
import { Badge } from "../components/ui/Badge";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";

type TaskStatusFilter = "all" | "suggested" | "planned" | "in_progress" | "completed" | "dismissed";
type TaskStatus = Exclude<TaskStatusFilter, "all">;

/**
 * Client mirror of the backend's VALID_TRANSITIONS (researchTaskRepository).
 * API.md §6.14: suggested → planned → in_progress → completed, with dismissed
 * reachable from any state; the select below only offers valid targets so the
 * server-side transition check never surprises the user.
 */
const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  suggested: ["planned", "dismissed"],
  planned: ["suggested", "in_progress", "dismissed"],
  in_progress: ["planned", "completed", "dismissed"],
  completed: ["in_progress", "dismissed"],
  dismissed: ["suggested", "planned", "in_progress"],
};

const statusLabel = (status: TaskStatus): string =>
  status.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const ResearchTasksPage: React.FC = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<ResearchTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("planned");
  const [editProjectId, setEditProjectId] = useState<string>("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [taskPendingDelete, setTaskPendingDelete] = useState<ResearchTask | null>(null);

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ["researchTasks", statusFilter],
    queryFn: () =>
      fetchResearchTasks({
        status: statusFilter === "all" ? undefined : statusFilter,
      }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects({ limit: 100 }),
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: { title: string; description: string; projectId?: string }) =>
      createResearchTask({
        source: "user",
        title: data.title,
        description: data.description,
        projectId: data.projectId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["researchTasks"] });
      setIsNewModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewProjectId("");
      setErrorMessage(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create task";
      setErrorMessage(msg);
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({
      taskId,
      patch,
    }: {
      taskId: string;
      patch: {
        title?: string;
        description?: string;
        status?: TaskStatus;
      };
    }) => updateResearchTask(taskId, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["researchTasks"] });
      setIsEditModalOpen(false);
      setErrorMessage(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update task";
      setErrorMessage(msg);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteResearchTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["researchTasks"] });
      toast.success("Task deleted.");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    },
  });

  const tasks: ResearchTask[] = tasksData?.data || [];
  const projects: Project[] = projectsData?.data || [];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;
    createTaskMutation.mutate({
      title: newTitle.trim(),
      description: newDescription.trim(),
      projectId: newProjectId || undefined,
    });
  };

  const openEditModal = (task: ResearchTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditStatus(task.status);
    setEditProjectId(task.projectId ?? "");
    setIsEditModalOpen(true);
    setErrorMessage(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim() || !editDescription.trim()) return;
    const patch: {
      title?: string;
      description?: string;
      status?: TaskStatus;
      projectId?: string | null;
    } = {};
    if (editTitle.trim() !== editingTask.title) patch.title = editTitle.trim();
    if (editDescription.trim() !== editingTask.description) patch.description = editDescription.trim();
    if (editStatus !== editingTask.status) patch.status = editStatus;
    if ((editProjectId || null) !== (editingTask.projectId ?? null)) {
      patch.projectId = editProjectId || null;
    }
    if (Object.keys(patch).length === 0) {
      setIsEditModalOpen(false);
      return;
    }
    updateTaskMutation.mutate({ taskId: editingTask.id, patch });
  };

  // Current status is always visible as the select's own value in the footer,
  // so a separate status pill on the card would only repeat it.
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-app-heading flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-brand-600" />
            Research Tasks
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track planned experiments, measurement campaigns, and AI-suggested investigation steps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsNewModalOpen(true);
            setErrorMessage(null);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Research Task
        </button>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="p-1 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs (guidelines §51) */}
      <div className="flex items-center gap-3">
        <div
          role="group"
          aria-label="Filter tasks by status"
          className="flex items-center gap-1 overflow-x-auto bg-white border border-app-border shadow-xs p-1 rounded-xl w-fit"
        >
          {(["all", "suggested", "planned", "in_progress", "completed", "dismissed"] as TaskStatusFilter[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              aria-pressed={statusFilter === tab}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                statusFilter === tab
                  ? "bg-brand-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {tab.replace("_", " ")}
            </button>
          ))}
        </div>

        {statusFilter !== "all" && (
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className="text-xs font-semibold text-brand-600 hover:text-brand-800 shrink-0"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Tasks Grid / List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading research tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-app-border p-12 text-center space-y-3">
          <ListTodo className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No research tasks found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Create tasks manually or analyze your observations to receive AI-suggested experimental next steps.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-xl border border-app-border p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-brand-200 transition-colors"
            >
              <div>
                {/* Content first: title and description lead the card; the
                    source pill and project link drop below the text so they
                    stop competing with what the task actually says. */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[22px] font-display font-semibold text-app-heading leading-snug line-clamp-2">
                    {task.title}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditModal(task)}
                      className="text-slate-400 hover:text-brand-600 p-1 transition-colors"
                      aria-label={`Edit task: ${task.title}`}
                      title="Edit task"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskPendingDelete(task)}
                      aria-haspopup="dialog"
                      className="text-slate-400 hover:text-red-600 p-1 transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                      aria-label={`Delete task: ${task.title}`}
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-2.5 text-sm text-slate-600 leading-relaxed line-clamp-3">{task.description}</p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  {task.source === "gemini" ? (
                    <Badge variant="purple" size="sm">
                      <Sparkles className="w-3 h-3 text-purple-600" /> AI Suggested
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      <User className="w-3 h-3 text-slate-500" /> User Authored
                    </Badge>
                  )}
                  {task.projectId && (
                    <Link
                      to={`/projects/${task.projectId}`}
                      className="inline-flex items-center gap-1 max-w-[12rem] rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 transition-colors hover:bg-brand-100 hover:text-brand-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
                      title={`Open project: ${projects.find((p) => p.id === task.projectId)?.title ?? ""}`}
                    >
                      <FolderKanban className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {projects.find((p) => p.id === task.projectId)?.title ?? "Project"}
                      </span>
                    </Link>
                  )}
                </div>
              </div>

              {/* Status controls — wrapping is deliberate: if the footer runs
                  out of width the action buttons drop to their own row instead
                  of squashing or overflowing. */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
                <span className="text-xs text-slate-400 shrink-0">
                  {new Date(task.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <select
                    value={task.status}
                    onChange={(e) =>
                      updateTaskMutation.mutate({
                        taskId: task.id,
                        patch: { status: e.target.value as TaskStatus },
                      })
                    }
                    disabled={updateTaskMutation.isPending}
                    aria-label={`Change status for task: ${task.title}`}
                    className="max-w-[9.5rem] px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-app-border rounded-md hover:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 cursor-pointer"
                  >
                    <option value={task.status}>{statusLabel(task.status)}</option>
                    {STATUS_TRANSITIONS[task.status].map((next) => (
                      <option key={next} value={next}>
                        Move to {statusLabel(next)}
                      </option>
                    ))}
                  </select>
                  {task.status === "suggested" && (
                    <button
                      type="button"
                      onClick={() => updateTaskMutation.mutate({ taskId: task.id, patch: { status: "planned" } })}
                      className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 shadow-xs hover:bg-blue-100 rounded-md transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" /> Plan this task
                    </button>
                  )}
                  {task.status === "planned" && (
                    <button
                      type="button"
                      onClick={() => updateTaskMutation.mutate({ taskId: task.id, patch: { status: "in_progress" } })}
                      className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 shadow-xs hover:bg-amber-100 rounded-md transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" /> Start working
                    </button>
                  )}
                  {task.status === "in_progress" && (
                    <button
                      type="button"
                      onClick={() => updateTaskMutation.mutate({ taskId: task.id, patch: { status: "completed" } })}
                      className="inline-flex shrink-0 items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-xs hover:bg-emerald-100 rounded-md transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark as complete
                    </button>
                  )}
                  {task.status !== "dismissed" && task.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => updateTaskMutation.mutate({ taskId: task.id, patch: { status: "dismissed" } })}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 rounded-md transition-colors"
                      title="Dismiss task"
                    >
                      <Archive className="w-3.5 h-3.5" /> Dismiss task
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Task Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-app-heading flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-600" /> New Research Task
              </h2>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Task Title *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  placeholder="e.g. Conduct second count during rainfall event"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Description / Protocol *</label>
                <textarea
                  required
                  rows={3}
                  maxLength={5000}
                  placeholder="Detail experimental variables, timing, and instruments..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Project Association (Optional)</label>
                <select
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-app-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="">Unfiled (No project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <div className="pt-1">
                  <InlineProjectCreator
                    compact
                    onCreated={(project: Project) => {
                      queryClient.invalidateQueries({ queryKey: ["projects"] });
                      setNewProjectId(project.id);
                    }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTaskMutation.isPending || !newTitle.trim() || !newDescription.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
                >
                  {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {isEditModalOpen && editingTask && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-app-heading flex items-center gap-2">
                <Pencil className="w-4 h-4 text-brand-600" /> Edit Research Task
              </h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Task Title *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Description / Protocol *</label>
                <textarea
                  required
                  rows={4}
                  maxLength={5000}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 text-sm border border-app-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  <option value={editingTask.status}>{statusLabel(editingTask.status)} (current)</option>
                  {STATUS_TRANSITIONS[editingTask.status].map((next) => (
                    <option key={next} value={next}>
                      {statusLabel(next)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-task-project"
                  className="text-xs font-semibold text-slate-700"
                >
                  Project Association
                </label>
                <select
                  id="edit-task-project"
                  value={editProjectId}
                  onChange={(e) => setEditProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-app-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                >
                  <option value="">Unfiled (No project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
                <div className="pt-1">
                  <InlineProjectCreator
                    compact
                    onCreated={(project: Project) => {
                      queryClient.invalidateQueries({ queryKey: ["projects"] });
                      setEditProjectId(project.id);
                    }}
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    updateTaskMutation.isPending || !editTitle.trim() || !editDescription.trim()
                  }
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
                >
                  {updateTaskMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={taskPendingDelete !== null}
        title="Delete task?"
        destructive
        confirmLabel="Delete Task"
        message={
          <p>
            This permanently deletes the task{" "}
            <strong>{taskPendingDelete?.title || ""}</strong>. This action cannot be undone.
          </p>
        }
        onConfirm={() => {
          if (taskPendingDelete) deleteTaskMutation.mutate(taskPendingDelete.id);
          setTaskPendingDelete(null);
        }}
        onCancel={() => setTaskPendingDelete(null)}
      />
    </div>
  );
};
