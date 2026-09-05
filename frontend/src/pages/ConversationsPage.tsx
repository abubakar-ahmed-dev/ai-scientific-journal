import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  fetchObservations,
  fetchProjects,
} from "../lib/api";
import type { Conversation, Project } from "../lib/api";
import { ChatWindow } from "../components/ChatWindow";
import { InlineProjectCreator } from "../components/InlineProjectCreator";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import {
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Archive,
  Trash2,
  Folder,
  FileText,
  X,
  Bot,
} from "lucide-react";

export const ConversationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConvId = searchParams.get("id");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  // New Chat Form State
  const [newTitle, setNewTitle] = useState("");
  const [newContextType, setNewContextType] = useState<"general" | "observation" | "project">("general");
  const [newContextId, setNewContextId] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  const [conversationPendingDelete, setConversationPendingDelete] = useState<Conversation | null>(null);
  const toast = useToast();

  // Query conversations
  const { data: convsData, isLoading } = useQuery({
    queryKey: ["conversations", statusFilter],
    queryFn: () => fetchConversations({ status: statusFilter, limit: 50 }),
  });

  const conversations: Conversation[] = convsData?.data || [];

  // Query observations and projects for context selection modal
  const { data: obsData } = useQuery({
    queryKey: ["observations-modal"],
    queryFn: () => fetchObservations({ limit: 50 }),
    enabled: isNewChatModalOpen && newContextType === "observation",
  });

  const { data: projData, refetch: refetchProjects } = useQuery({
    queryKey: ["projects-modal"],
    queryFn: () => fetchProjects({ limit: 50 }),
    enabled: isNewChatModalOpen && newContextType === "project",
  });

  // Selected conversation
  const selectedConversation = conversations.find((c) => c.id === activeConvId) || conversations[0];

  const firstConvId = conversations[0]?.id;
  useEffect(() => {
    if (!activeConvId && firstConvId) {
      setSearchParams({ id: firstConvId });
    }
  }, [firstConvId, activeConvId, setSearchParams]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: {
      title?: string | null;
      contextType: "general" | "observation" | "project";
      contextId?: string | null;
    }) => createConversation(data),
    onSuccess: (res) => {
      setIsNewChatModalOpen(false);
      setNewTitle("");
      setNewContextType("general");
      setNewContextId("");
      setModalError(null);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSearchParams({ id: res.data.id });
    },
    onError: (err: Error) => {
      setModalError(err.message || "Failed to create conversation");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "archived" }) =>
      updateConversation(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (activeConvId === selectedConversation?.id) {
        setSearchParams({});
      }
      toast.success("Conversation deleted.");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete conversation");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newContextType !== "general" && !newContextId.trim()) {
      setModalError(`Please select an ${newContextType} for context.`);
      return;
    }
    createMutation.mutate({
      title: newTitle.trim() || undefined,
      contextType: newContextType,
      contextId: newContextType === "general" ? null : newContextId.trim(),
    });
  };

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const title = c.title || "Untitled";
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6">
      {/* Sidebar List */}
      <div className="w-full md:w-80 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              Conversations
            </h1>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New Chat
            </button>
          </div>

          {/* Search & Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-1 bg-slate-200/60 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setStatusFilter("active")}
              className={`flex-1 py-1 text-center rounded-md transition-all ${
                statusFilter === "active" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("archived")}
              className={`flex-1 py-1 text-center rounded-md transition-all ${
                statusFilter === "archived" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Archived
            </button>
          </div>
        </div>

        {/* Conversation Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-slate-400">Loading chats...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No {statusFilter} conversations found.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => setSearchParams({ id: conv.id })}
                  className={`p-3 cursor-pointer transition-colors group flex items-start justify-between gap-2 ${
                    isSelected ? "bg-indigo-50/70 border-l-4 border-indigo-600" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {conv.title || "Untitled Discussion"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                      <span className="capitalize text-indigo-600 bg-indigo-50/80 px-1.5 py-0.2 rounded font-medium">
                        {conv.contextType}
                      </span>
                      <span>{conv.messageCount} msgs</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        archiveMutation.mutate({
                          id: conv.id,
                          status: conv.status === "active" ? "archived" : "active",
                        });
                      }}
                      title={conv.status === "active" ? "Archive" : "Unarchive"}
                      className="p-1 hover:text-indigo-600 text-slate-400 rounded"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConversationPendingDelete(conv);
                      }}
                      aria-haspopup="dialog"
                      title="Delete"
                      className="p-1 hover:text-red-600 text-slate-400 rounded focus:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 min-w-0 h-full">
        {selectedConversation ? (
          <ChatWindow
            conversation={selectedConversation}
            onRefreshConversation={() =>
              queryClient.invalidateQueries({ queryKey: ["conversations"] })
            }
          />
        ) : (
          <div className="h-full bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <Bot className="w-16 h-16 text-indigo-200 mb-4" />
            <h2 className="text-lg font-bold text-slate-800">Select or Start a Conversation</h2>
            <p className="text-sm text-slate-500 max-w-md mt-1 mb-6">
              Discuss research observations, explore hypotheses, and synthesize scientific data with the AI assistant.
            </p>
            <button
              onClick={() => setIsNewChatModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Start New Chat
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Start New AI Discussion
              </h3>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg">{modalError}</div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Feeder Activity & Weather Analysis"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Context Focus
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewContextType("general");
                      setNewContextId("");
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center transition-all ${
                      newContextType === "general"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    General
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewContextType("observation");
                      setNewContextId("");
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center flex items-center justify-center gap-1 transition-all ${
                      newContextType === "observation"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    Observation
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewContextType("project");
                      setNewContextId("");
                    }}
                    className={`py-2 px-3 text-xs font-medium rounded-lg border text-center flex items-center justify-center gap-1 transition-all ${
                      newContextType === "project"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Folder className="w-3 h-3" />
                    Project
                  </button>
                </div>
              </div>

              {/* Context Selector */}
              {newContextType === "observation" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Observation
                  </label>
                  <select
                    value={newContextId}
                    onChange={(e) => setNewContextId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- Choose Observation --</option>
                    {(obsData?.data || []).map((obs) => (
                      <option key={obs.id} value={obs.id}>
                        {obs.title} ({new Date(obs.observedAt).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newContextType === "project" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Project
                  </label>
                  <select
                    value={newContextId}
                    onChange={(e) => setNewContextId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- Choose Project --</option>
                    {(projData?.data || []).map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.title}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <InlineProjectCreator
                      compact
                      onCreated={(project: Project) => {
                        refetchProjects();
                        setNewContextId(project.id);
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewChatModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-colors"
                >
                  {createMutation.isPending ? "Creating..." : "Start Discussion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={conversationPendingDelete !== null}
        title="Delete conversation?"
        destructive
        confirmLabel="Delete Conversation"
        message={
          <p>
            This permanently deletes{" "}
            <strong>{conversationPendingDelete?.title || "this conversation"}</strong> and all of
            its messages. This action cannot be undone.
          </p>
        }
        onConfirm={() => {
          if (conversationPendingDelete) deleteMutation.mutate(conversationPendingDelete.id);
          setConversationPendingDelete(null);
        }}
        onCancel={() => setConversationPendingDelete(null)}
      />
    </div>
  );
};
