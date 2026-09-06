import { logger } from "./logger";
import type { Request } from "express";

/**
 * AI operation signals (OBSERVABILITY.md §8) — the operational view of the
 * AI Service hooks (AI_ARCHITECTURE.md §12). One line per AI operation:
 * operation type, correlation IDs, latency, status class, and lengths.
 *
 * Privacy rule (OBSERVABILITY.md §4): operational metadata only — never
 * journal content, prompts, model output text, tokens, or secrets.
 */

export type AiOperationType =
  | "summarize"
  | "analyze"
  | "suggest-research"
  | "ask"
  | "search"
  | "chat-turn";

export interface AiSignalFields {
  operation: AiOperationType;
  req: Request;
  model?: string;
  promptVersion?: string;
  durationMs?: number;
  status: "success" | "failure";
  errorType?:
    | "AI_UNAVAILABLE"
    | "AI_INVALID_RESPONSE"
    | "RATE_LIMIT_EXCEEDED"
    | "RETRIEVAL_ERROR";
  inputLength?: number;
  outputLength?: number;
  contextLength?: number;
  candidateCount?: number;
  tokenUsage?: {
    promptTokens?: number;
    candidatesTokens?: number;
    totalTokens?: number;
  };
}

export function logAiSignal(fields: AiSignalFields): void {
  const { req, ...rest } = fields;
  logger.info(
    {
      requestId: req.requestId,
      userId: req.user?.uid,
      ...rest,
    },
    "ai operation"
  );
}
