import React, { useState } from "react";
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

type TaskStatusFilter = "all" | "suggested" | "planned" | "in_progress" | "completed" | "dismissed";

export const ResearchTasksPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>("all");
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProjectId, setNewProjectId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const updateStatusMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string;
      status: "suggested" | "planned" | "in_progress" | "completed" | "dismissed";
    }) => updateResearchTask(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["researchTasks"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to update task status";
      setErrorMessage(msg);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteResearchTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["researchTasks"] });
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "suggested":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">Suggested</span>;
      case "planned":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Planned</span>;
      case "in_progress":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">In Progress</span>;
      case "completed":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>;
      case "dismissed":
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">Dismissed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-indigo-600" />
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
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto bg-slate-100/80 p-1 rounded-xl w-fit">
        {(["all", "suggested", "planned", "in_progress", "completed", "dismissed"] as TaskStatusFilter[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
              statusFilter === tab
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Tasks Grid / List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading research tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center space-y-3">
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
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {task.source === "gemini" ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        <Sparkles className="w-3 h-3 text-purple-600" /> AI Suggested
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <User className="w-3 h-3 text-slate-500" /> User Authored
                      </span>
                    )}
                    {getStatusBadge(task.status)}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this research task?")) {
                        deleteTaskMutation.mutate(task.id);
                      }
                    }}
                    className="text-slate-400 hover:text-red-600 p-1 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-sm font-bold text-slate-900 leading-snug">{task.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{task.description}</p>
              </div>

              {/* Action Buttons based on status */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  {new Date(task.updatedAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1.5">
                  {task.status === "suggested" && (
                    <button
                      type="button"
                      onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: "planned" })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5" /> Plan Task
                    </button>
                  )}
                  {task.status === "planned" && (
                    <button
                      type="button"
                      onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: "in_progress" })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" /> Start
                    </button>
                  )}
                  {task.status === "in_progress" && (
                    <button
                      type="button"
                      onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: "completed" })}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                    </button>
                  )}
                  {task.status !== "dismissed" && task.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => updateStatusMutation.mutate({ taskId: task.id, status: "dismissed" })}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 rounded-md transition-colors"
                      title="Dismiss task"
                    >
                      <Archive className="w-3.5 h-3.5" /> Dismiss
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
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> New Research Task
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Project Association (Optional)</label>
                <select
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
                >
                  {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
