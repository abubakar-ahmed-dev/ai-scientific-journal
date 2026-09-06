import { observationRepository } from "../repository/observationRepository";
import { projectRepository } from "../repository/projectRepository";
import { analysisRepository } from "../repository/analysisRepository";
import { CHAT_SYSTEM_INSTRUCTION } from "./prompts/systemPrompt";
import { ChatContextPayload, ChatEntityContext, ChatMessageContext } from "./types";
import { env } from "../config/env";
import { AppError } from "../types/errors";

export interface BuildChatContextParams {
  uid: string;
  conversationId: string;
  contextType: "general" | "observation" | "project" | "research";
  contextId?: string | null;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  currentUserMessage: string;
}

export class ChatContextBuilder {
  async buildContext(params: BuildChatContextParams): Promise<ChatContextPayload> {
    const { uid, contextType, contextId, history, currentUserMessage } = params;

    let contextualData: ChatEntityContext | null = null;

    if (contextType !== "general" && contextId) {
      if (contextType === "observation") {
        const obs = await observationRepository.findById(uid, contextId);
        if (!obs) {
          throw new AppError("NOT_FOUND", `Referenced observation '${contextId}' not found.`);
        }
        contextualData = {
          type: "observation",
          id: obs.id,
          title: obs.title,
          description: obs.description,
          notes: obs.notes,
          hypothesis: obs.hypothesis,
          tags: obs.tags,
          measurements: obs.measurements.map((m) => ({
            name: m.name,
            value: m.value,
            unit: m.unit,
            notes: m.notes,
          })),
        };
      } else if (contextType === "project") {
        const proj = await projectRepository.findById(uid, contextId);
        if (!proj) {
          throw new AppError("NOT_FOUND", `Referenced project '${contextId}' not found.`);
        }
        contextualData = {
          type: "project",
          id: proj.id,
          title: proj.title,
          description: proj.description || undefined,
          field: proj.field || undefined,
          tags: proj.tags,
        };
      } else if (contextType === "research") {
        // Research context references a caller-owned analysis (API.md §6.10);
        // analyses exist since Phase 5, so the Phase 4 deferral is lifted.
        const analysis = await analysisRepository.findById(uid, contextId);
        if (!analysis) {
          throw new AppError("NOT_FOUND", `Referenced analysis '${contextId}' not found.`);
        }
        contextualData = {
          type: "research",
          id: analysis.id,
          title: analysis.summary.slice(0, 200),
          description: [analysis.summary, ...analysis.keyFindings].join(" • ").slice(0, 4000),
          tags: [],
        };
      }
    }

    // Sliding window of recent messages
    const maxMessages = env.AI_MAX_CONTEXT_MESSAGES || 20;
    const boundedHistory: ChatMessageContext[] = history.slice(-maxMessages).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    return {
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      conversationHistory: boundedHistory,
      contextualData,
      currentUserMessage,
    };
  }
}

export const chatContextBuilder = new ChatContextBuilder();
