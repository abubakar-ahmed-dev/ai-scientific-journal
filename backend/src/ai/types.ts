import { StructuredAnalysisOutput } from "./parsers/analysisOutputSchema";

export interface ChatMessageContext {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatEntityContext {
  type: "observation" | "project" | "research" | "general";
  id?: string;
  title?: string;
  description?: string;
  notes?: string | null;
  hypothesis?: string | null;
  field?: string | null;
  measurements?: Array<{ name: string; value: number; unit: string; notes?: string | null }>;
  tags?: string[];
}

export interface ChatContextPayload {
  systemInstruction: string;
  conversationHistory: ChatMessageContext[];
  contextualData?: ChatEntityContext | null;
  currentUserMessage: string;
}

export interface ChatGenerationResult {
  content: string;
  model: string;
  metadata: {
    latencyMs: number;
    tokenUsage?: {
      promptTokens?: number;
      candidatesTokens?: number;
      totalTokens?: number;
    };
    finishReason?: string;
  };
}

export interface AnalysisPromptPayload {
  systemInstruction: string;
  promptVersion: string;
  contextText: string;
  taskInstruction: string;
}

export interface StructuredAnalysisResult {
  output: StructuredAnalysisOutput;
  model: string;
  promptVersion: string;
  metadata: {
    latencyMs: number;
    tokenUsage?: {
      promptTokens?: number;
      candidatesTokens?: number;
      totalTokens?: number;
    };
  };
}

export interface GroundedAnswerPayload {
  systemInstruction: string;
  promptVersion: string;
  contextText: string;
  question: string;
}

export interface GroundedAnswerOutput {
  answer: string;
  evidence: Array<{ observationId: string; note?: string }>;
  uncertainties: string[];
}

export interface GroundedAnswerResult {
  output: GroundedAnswerOutput;
  model: string;
  promptVersion: string;
  metadata: {
    latencyMs: number;
    tokenUsage?: {
      promptTokens?: number;
      candidatesTokens?: number;
      totalTokens?: number;
    };
  };
}

export interface IAIService {
  generateChatReply(context: ChatContextPayload): Promise<ChatGenerationResult>;
  generateStructuredAnalysis(payload: AnalysisPromptPayload): Promise<StructuredAnalysisResult>;
  generateGroundedAnswer(payload: GroundedAnswerPayload): Promise<GroundedAnswerResult>;
}
