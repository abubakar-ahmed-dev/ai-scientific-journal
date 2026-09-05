import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchMessages,
  sendMessage,
  fetchObservation,
  fetchProject,
  ApiRequestError,
} from "../lib/api";
import type { Conversation, Message } from "../lib/api";
import { MarkdownText } from "./MarkdownText";
import {
  Send,
  Sparkles,
  User,
  Bot,
  AlertTriangle,
  RefreshCw,
  Clock,
  Zap,
} from "lucide-react";

interface ChatWindowProps {
  conversation: Conversation;
  onRefreshConversation?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  onRefreshConversation,
}) => {
  const queryClient = useQueryClient();
  const [inputContent, setInputContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedContent, setFailedContent] = useState<string | null>(null);
  const [contextTitle, setContextTitle] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Resolve context title (F8: Discussing Observation/Project: [Title])
  useEffect(() => {
    if (!conversation.contextId || conversation.contextType === "general") {
      setContextTitle(null);
      return;
    }

    let isMounted = true;
    if (conversation.contextType === "observation") {
      fetchObservation(conversation.contextId)
        .then((res) => {
          if (isMounted) setContextTitle(res.data.title);
        })
        .catch(() => {
          if (isMounted) setContextTitle(null);
        });
    } else if (conversation.contextType === "project") {
      fetchProject(conversation.contextId)
        .then((res) => {
          if (isMounted) setContextTitle(res.data.title);
        })
        .catch(() => {
          if (isMounted) setContextTitle(null);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [conversation.contextId, conversation.contextType]);

  const {
    data: messagesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["messages", conversation.id],
    queryFn: () => fetchMessages(conversation.id, { limit: 100 }),
  });

  const messages: Message[] = messagesData?.data || [];

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === "function") {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isLoading]);

  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(conversation.id, content),
    onMutate: () => {
      setErrorMessage(null);
    },
    onSuccess: () => {
      setInputContent("");
      setFailedContent(null);
      queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onRefreshConversation?.();
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : "Failed to send message. Please try again.";
      setErrorMessage(msg);
      setFailedContent(inputContent);
      queryClient.invalidateQueries({ queryKey: ["messages", conversation.id] });
    },
  });

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputContent.trim();
    if (!trimmed || sendMutation.isPending || conversation.status === "archived") return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = () => {
    if (failedContent) {
      sendMutation.mutate(failedContent);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              {conversation.title || "Untitled Conversation"}
            </h2>
            {conversation.status === "archived" && (
              <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 rounded-full">
                Archived
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
            {conversation.contextType === "general" ? (
              <span className="inline-flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                <Sparkles className="w-3 h-3" />
                Context: Global Journal
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>
                  Discussing {conversation.contextType === "observation" ? "Observation" : "Project"}:{" "}
                  <strong>{contextTitle || (conversation.contextId ? `${conversation.contextId.slice(0, 12)}...` : "Unfiled")}</strong>
                </span>
              </span>
            )}
            <span className="text-slate-400">•</span>
            <span>{conversation.messageCount} messages</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading messages...
          </div>
        ) : isError ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center justify-between">
            <span>Failed to load messages: {(error as Error).message}</span>
            <button
              onClick={() => refetch()}
              className="text-xs font-semibold underline hover:text-red-800"
            >
              Retry
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center text-slate-400">
            <Bot className="w-12 h-12 text-indigo-200 mb-3" />
            <p className="text-base font-medium text-slate-700">Start the Discussion</p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Ask questions about your observations, propose hypotheses, or request scientific analysis.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                  }`}
                >
                  {isUser ? (
                    // User-typed content stays plain text; only AI-authored
                    // messages get (untrusted-safe) markdown rendering.
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <MarkdownText content={msg.content} />
                  )}

                  {!isUser && (msg.model || msg.metadata) && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-3 text-[10px] text-slate-400">
                      {msg.model && (
                        <span className="font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {msg.model}
                        </span>
                      )}
                      {msg.metadata?.latencyMs && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {msg.metadata.latencyMs}ms
                        </span>
                      )}
                      {msg.metadata?.tokenUsage?.totalTokens && (
                        <span className="flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          {msg.metadata.tokenUsage.totalTokens} tokens
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {sendMutation.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center gap-2 text-slate-500 text-xs">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" />
              <span>Analyzing context and reasoning...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error & Retry Banner */}
      {errorMessage && (
        <div className="px-6 py-2.5 bg-amber-50 border-t border-amber-200 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {failedContent && (
            <button
              onClick={handleRetry}
              disabled={sendMutation.isPending}
              className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 px-2 py-1 bg-white rounded border border-amber-200 shadow-xs"
            >
              <RefreshCw className="w-3 h-3" />
              Retry AI Generation
            </button>
          )}
        </div>
      )}

      {/* Input Area */}
      {conversation.status === "archived" ? (
        <div className="p-4 bg-slate-100 text-center text-xs text-slate-500 border-t border-slate-200">
          This conversation is archived. Unarchive it or start a new chat to continue.
        </div>
      ) : (
        <form onSubmit={handleSend} className="p-4 border-t border-slate-200 bg-white">
          <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-300 rounded-xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
            <textarea
              rows={2}
              value={inputContent}
              onChange={(e) => setInputContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a scientific question, suggest an experiment, or reflect on observations... (Shift+Enter for newline)"
              className="w-full bg-transparent resize-none border-none outline-none text-sm text-slate-800 placeholder-slate-400 px-2"
              maxLength={8000}
            />
            <div className="flex items-center gap-2 shrink-0 pb-1">
              <span className="text-[10px] text-slate-400">
                {inputContent.length}/8000
              </span>
              <button
                type="submit"
                disabled={!inputContent.trim() || sendMutation.isPending}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-xs"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>AI suggestions should be experimentally verified. Empirical observations remain authoritative ground truth.</span>
            <span>AI replies use light markdown</span>
          </div>
        </form>
      )}
    </div>
  );
};
