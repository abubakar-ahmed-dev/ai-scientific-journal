import { Router, Request, Response, NextFunction } from "express";
import {
  SummarizeRequestSchema,
  AnalyzeRequestSchema,
  SuggestResearchRequestSchema,
} from "../schemas/analysisSchema";
import { AskRequestSchema, SearchRequestSchema } from "../schemas/askSchema";
import { observationRepository } from "../repository/observationRepository";
import { conversationRepository } from "../repository/conversationRepository";
import { messageRepository } from "../repository/messageRepository";
import { analysisRepository } from "../repository/analysisRepository";
import { getAiService } from "../ai/aiService";
import {
  buildObservationAnalysisPrompt,
  ObservationPromptData,
} from "../ai/prompts/observationAnalysisPrompt";
import { buildConversationSummaryPrompt } from "../ai/prompts/conversationSummaryPrompt";
import { buildResearchSuggestionsPrompt } from "../ai/prompts/researchSuggestionsPrompt";
import { buildAskGroundedPrompt, ASK_PROMPT_VERSION } from "../ai/prompts/askGroundedAnswerPrompt";
import { retrievalService } from "../ai/retrieval/retrievalService";
import { aiRateLimiter, searchRateLimiter } from "../middleware/rateLimiter";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { logAiSignal } from "../lib/aiSignals";
import { AppError } from "../types/errors";

export const aiRouter = Router();

// /ai/search runs on its own lighter retrieval tier (API.md §4.1): it is a
// non-generative read triggered by ordinary page views, so it must not
// consume the AI-generation bucket below.
aiRouter.use("/search", searchRateLimiter);
// Apply AI rate limiter (10 requests / 5 min / user) to all generation routes
aiRouter.use((req: Request, res: Response, next: NextFunction): void => {
  if (req.path === "/search") {
    next();
    return;
  }
  aiRateLimiter(req, res, next);
});

// POST /api/v1/ai/summarize
aiRouter.post("/summarize", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = SummarizeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const uid = req.user!.uid;
    const { conversationId, observationIds, projectId } = parseResult.data;

    let promptPayload;
    let targetProjectId = projectId ?? null;
    let targetObservationIds: string[] = [];
    let targetConversationId: string | null = null;

    if (conversationId) {
      const conversation = await conversationRepository.findById(uid, conversationId);
      if (!conversation) {
        throw new AppError("NOT_FOUND", `Conversation '${conversationId}' not found`);
      }
      targetConversationId = conversation.id;
      if (!targetProjectId && conversation.projectId) {
        targetProjectId = conversation.projectId;
      }

      const messagesRes = await messageRepository.list(uid, conversationId, 100);
      promptPayload = buildConversationSummaryPrompt(conversation.title, messagesRes.data);
    } else if (observationIds && observationIds.length > 0) {
      const observations: ObservationPromptData[] = [];
      for (const id of observationIds) {
        const obs = await observationRepository.findById(uid, id);
        if (!obs) {
          throw new AppError("NOT_FOUND", `Observation '${id}' not found`);
        }
        observations.push({
          id: obs.id,
          title: obs.title,
          description: obs.description,
          notes: obs.notes,
          hypothesis: obs.hypothesis,
          observedAt: String(obs.observedAt),
          tags: obs.tags,
          measurements: obs.measurements,
        });
      }
      targetObservationIds = observationIds;
      promptPayload = buildObservationAnalysisPrompt(observations);
    } else {
      throw new AppError("VALIDATION_ERROR", "No valid source provided for summarization");
    }

    const aiService = getAiService();
    const aiStart = process.hrtime.bigint();
    let result;
    try {
      result = await aiService.generateStructuredAnalysis(promptPayload);
    } catch (err) {
      logAiSignal({
        operation: "summarize",
        req,
        status: "failure",
        durationMs: Math.round(Number(process.hrtime.bigint() - aiStart) / 1e6),
        errorType:
          err instanceof AppError && (err.code === "AI_INVALID_RESPONSE" || err.code === "AI_UNAVAILABLE")
            ? (err.code as "AI_INVALID_RESPONSE" | "AI_UNAVAILABLE")
            : "RETRIEVAL_ERROR",
      });
      throw err;
    }
    logAiSignal({
      operation: "summarize",
      req,
      status: "success",
      durationMs: Math.round(Number(process.hrtime.bigint() - aiStart) / 1e6),
      model: result.model,
      promptVersion: result.promptVersion,
      inputLength: promptPayload.contextText.length,
      outputLength: result.output.summary.length,
      tokenUsage: result.metadata.tokenUsage,
    });

    const savedAnalysis = await analysisRepository.create(uid, {
      projectId: targetProjectId,
      observationIds: targetObservationIds,
      conversationId: targetConversationId,
      type: "summary",
      output: result.output,
      model: result.model,
      promptVersion: result.promptVersion,
    });

    res.status(201).json({ data: savedAnalysis });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/ai/analyze
aiRouter.post("/analyze", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = AnalyzeRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const uid = req.user!.uid;
    const { observationIds, projectId } = parseResult.data;

    const observations: ObservationPromptData[] = [];
    for (const id of observationIds) {
      const obs = await observationRepository.findById(uid, id);
      if (!obs) {
        throw new AppError("NOT_FOUND", `Observation '${id}' not found`);
      }
      observations.push({
        id: obs.id,
        title: obs.title,
        description: obs.description,
        notes: obs.notes,
        hypothesis: obs.hypothesis,
        observedAt: String(obs.observedAt),
        tags: obs.tags,
        measurements: obs.measurements,
      });
    }

    const promptPayload = buildObservationAnalysisPrompt(observations);
    const aiService = getAiService();
    const aiStart = process.hrtime.bigint();
    let result;
    try {
      result = await aiService.generateStructuredAnalysis(promptPayload);
    } catch (err) {
      logAiSignal({
        operation: "analyze",
        req,
        status: "failure",
        durationMs: Math.round(Number(process.hrtime.bigint() - aiStart) / 1e6),
        errorType:
          err instanceof AppError && (err.code === "AI_INVALID_RESPONSE" || err.code === "AI_UNAVAILABLE")
            ? (err.code as "AI_INVALID_RESPONSE" | "AI_UNAVAILABLE")
            : "RETRIEVAL_ERROR",
      });
      throw err;
    }
    logAiSignal({
      operation: "analyze",
      req,
      status: "success",
      durationMs: Math.round(Number(process.hrtime.bigint() - aiStart) / 1e6),
      model: result.model,
      promptVersion: result.promptVersion,
      inputLength: promptPayload.contextText.length,
      outputLength: result.output.summary.length,
      tokenUsage: result.metadata.tokenUsage,
    });

    // Persist analysis
    const savedAnalysis = await analysisRepository.create(uid, {
      projectId: projectId ?? null,
      observationIds,
      conversationId: null,
      type: "analysis",
      output: result.output,
      model: result.model,
      promptVersion: result.promptVersion,
    });

    // Write-back: mark observations status as analyzed
    await observationRepository.markAsAnalyzed(uid, observationIds);

    res.status(201).json({ data: savedAnalysis });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/ai/suggest-research
aiRouter.post("/suggest-research", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = SuggestResearchRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const uid = req.user!.uid;
    const { observationIds, analysisId, projectId } = parseResult.data;

    const contextDescriptions: string[] = [];
    let priorSummary: string | undefined;
    const targetObservationIds: string[] = observationIds ?? [];

    if (analysisId) {
      const analysis = await analysisRepository.findById(uid, analysisId);
      if (!analysis) {
        throw new AppError("NOT_FOUND", `Analysis '${analysisId}' not found`);
      }
      priorSummary = analysis.summary;
      if (analysis.keyFindings?.length) {
        contextDescriptions.push(`Prior Findings: ${analysis.keyFindings.join("; ")}`);
      }
    }

    if (observationIds && observationIds.length > 0) {
      for (const id of observationIds) {
        const obs = await observationRepository.findById(uid, id);
        if (!obs) {
          throw new AppError("NOT_FOUND", `Observation '${id}' not found`);
        }
        contextDescriptions.push(
          `Observation "${obs.title}": ${obs.description} (Hypothesis: ${obs.hypothesis || "none"})`
        );
      }
    }

    const promptPayload = buildResearchSuggestionsPrompt(contextDescriptions, priorSummary);
    const aiService = getAiService();
    const aiStart = process.hrtime.bigint();
    let result;
    try {
      result = await aiService.generateStructuredAnalysis(promptPayload);
    } catch (err) {
      logAiSignal({
        operation: "suggest-research",
        req,
        status: "failure",
        durationMs: Math.round(Number(process.hrtime.bigint() - aiStart) / 1e6),
        errorType:
          err instanceof AppError && (err.code === "AI_INVALID_RESPONSE" || err.code === "AI_UNAVAILABLE")
            ? (err.code as "AI_INVALID_RESPONSE" | "AI_UNAVAILABLE")
            : "RETRIEVAL_ERROR",
      });
      throw err;
    }
    logAiSignal({
      operation: "suggest-research",
      req,
      status: "success",
      durationMs: Math.round(Number(process.hrtime.bigint() - aiStart) / 1e6),
      model: result.model,
      promptVersion: result.promptVersion,
      inputLength: promptPayload.contextText.length,
      outputLength: result.output.summary.length,
      tokenUsage: result.metadata.tokenUsage,
    });

    const savedAnalysis = await analysisRepository.create(uid, {
      projectId: projectId ?? null,
      observationIds: targetObservationIds,
      conversationId: null,
      type: "research_suggestions",
      output: result.output,
      model: result.model,
      promptVersion: result.promptVersion,
    });

    res.status(201).json({ data: savedAnalysis });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/ai/ask — Ask My Journal (PRD FR-16, API.md §6.15)
aiRouter.post("/ask", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = AskRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const uid = req.user!.uid;
    const { question, conversationId } = parseResult.data;

    let conversation = null;

    if (conversationId) {
      conversation = await conversationRepository.findById(uid, conversationId);
      if (!conversation) {
        throw new AppError("NOT_FOUND", `Conversation '${conversationId}' not found`);
      }
      if (conversation.status === "archived") {
        throw new AppError("VALIDATION_ERROR", "Cannot send questions to an archived conversation");
      }

      // Idempotency check
      const idempotencyKey = req.header("Idempotency-Key");
      const existingUserMessage = idempotencyKey
        ? await messageRepository.findByUserKey(uid, conversationId, idempotencyKey)
        : null;

      if (existingUserMessage) {
        const messages = await messageRepository.listRecent(uid, conversationId, 1);
        const lastMessage = messages[0];
        if (lastMessage && lastMessage.role === "assistant") {
          const metadata = (lastMessage.metadata as Record<string, unknown>) || {};
          res.status(200).json({
            data: {
              answer: lastMessage.content,
              evidence: metadata.evidence || [],
              uncertainties: metadata.uncertainties || [],
              insufficientEvidence: (metadata.insufficientEvidence as boolean | undefined) ?? false,
              model: (metadata.model as string) || "none",
              promptVersion: (metadata.promptVersion as string) || ASK_PROMPT_VERSION,
            },
          });
          return;
        }
      } else {
        const userSequence = await messageRepository.getNextSequence(uid, conversationId);
        await messageRepository.create(uid, conversationId, {
          role: "user",
          content: question,
          sequence: userSequence,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        });
        await conversationRepository.incrementMessageCount(uid, conversationId, 1);
      }
    }

    // Step 1: Retrieval over the derived index (strictly UID-scoped)
    let retrievalResult;
    try {
      retrievalResult = await retrievalService.retrieve(uid, question, {
        limit: env.AI_RAG_MAX_CONTEXT_OBSERVATIONS,
        minScore: env.AI_RAG_MIN_SCORE,
      });
    } catch (err) {
      logger.error({ err, uid }, "Retrieval service failed during /ai/ask");
      throw new AppError("AI_UNAVAILABLE", "Failed to retrieve observation context. Please retry.");
    }

    const { candidates, truncated } = retrievalResult;
    // Candidates arrive score-sorted descending; the top score decides whether
    // the evidence base is strong enough to justify generation at all (#18).
    const topScore = candidates.length > 0 ? candidates[0]!.score : 0;

    // Step 2: Deterministic Insufficient/Weak-Evidence Gate (Rule 8, fixing-plan #18)
    if (candidates.length === 0 || topScore < env.AI_RAG_WEAK_EVIDENCE_SCORE) {
      const insufficientAnswer =
        candidates.length === 0
          ? "I could not find any relevant observations in your journal to answer this question. Please ensure your observations contain the relevant details or try asking a different question."
          : "The observations in your journal only weakly relate to this question, so I cannot answer it from your recorded evidence. Add observations with more relevant detail, or rephrase the question toward what you have actually recorded.";
      const uncertainties =
        candidates.length === 0
          ? ["No matching observations found in journal."]
          : [`Best candidate relevance score (${topScore.toFixed(2)}) is below the evidence threshold.`];

      if (conversationId) {
        const assistantSequence = await messageRepository.getNextSequence(uid, conversationId);
        await messageRepository.create(uid, conversationId, {
          role: "assistant",
          content: insufficientAnswer,
          sequence: assistantSequence,
          metadata: {
            operationType: "ask",
            model: "none",
            promptVersion: ASK_PROMPT_VERSION,
            evidence: [],
            uncertainties,
            insufficientEvidence: true,
          },
        });
        await conversationRepository.incrementMessageCount(uid, conversationId, 1);
      }

      res.status(200).json({
        data: {
          answer: insufficientAnswer,
          evidence: [],
          uncertainties,
          insufficientEvidence: true,
          model: "none",
          promptVersion: ASK_PROMPT_VERSION,
        },
        meta: { truncated },
      });
      return;
    }

    // Step 3: Call AI Service with bounded context
    const promptPayload = buildAskGroundedPrompt(question, candidates);
    const aiService = getAiService();
    const aiStart = process.hrtime.bigint();
    let result;
    try {
      result = await aiService.generateGroundedAnswer(promptPayload);
    } catch (err) {
      logAiSignal({
        operation: "ask",
        req,
        status: "failure",
        durationMs: Math.round(Number(process.hrtime.bigint() - aiStart) / 1e6),
        errorType:
          err instanceof AppError && (err.code === "AI_INVALID_RESPONSE" || err.code === "AI_UNAVAILABLE")
            ? (err.code as "AI_INVALID_RESPONSE" | "AI_UNAVAILABLE")
            : "RETRIEVAL_ERROR",
        candidateCount: candidates.length,
      });
      throw err;
    }
    logAiSignal({
      operation: "ask",
      req,
      status: "success",
      durationMs: Math.round(Number(process.hrtime.bigint() - aiStart) / 1e6),
      model: result.model,
      promptVersion: result.promptVersion,
      inputLength: question.length,
      outputLength: result.output.answer.length,
      contextLength: promptPayload.contextText.length,
      candidateCount: candidates.length,
      tokenUsage: result.metadata.tokenUsage,
    });

    // Step 4: Grounding / Output Validation (Rule 5)
    // Every cited observationId MUST belong to the prompt-included canonical-verified candidates
    const validCandidateIds = new Set(promptPayload.includedCandidates.map((c) => c.observationId));
    const candidateMap = new Map(promptPayload.includedCandidates.map((c) => [c.observationId, c]));

    for (const ev of result.output.evidence) {
      if (!validCandidateIds.has(ev.observationId)) {
        throw new AppError(
          "AI_INVALID_RESPONSE",
          `Model response cited unverified observation reference '${ev.observationId}'`
        );
      }
    }

    // Enrich evidence with canonical observation title and observedAt
    const enrichedEvidence = result.output.evidence.map((ev) => {
      const matched = candidateMap.get(ev.observationId);
      return {
        observationId: ev.observationId,
        title: matched ? matched.title : "Observation",
        observedAt: matched ? matched.observedAt : new Date().toISOString(),
        ...(ev.note ? { note: ev.note } : {}),
      };
    });

    // Step 5: If conversationId, persist assistant message
    if (conversationId) {
      const assistantSequence = await messageRepository.getNextSequence(uid, conversationId);
      await messageRepository.create(uid, conversationId, {
        role: "assistant",
        content: result.output.answer,
        sequence: assistantSequence,
        metadata: {
          operationType: "ask",
          model: result.model,
          promptVersion: result.promptVersion,
          evidence: enrichedEvidence,
          uncertainties: result.output.uncertainties,
          insufficientEvidence: result.output.insufficientEvidence === true,
        },
      });
      await conversationRepository.incrementMessageCount(uid, conversationId, 1);
    }

    res.status(200).json({
      data: {
        answer: result.output.answer,
        evidence: enrichedEvidence,
        uncertainties: result.output.uncertainties,
        // Cross-check (fixing-plan #18): the model's self-report is surfaced
        // verbatim after schema validation; weak/absent candidate evidence
        // never reaches this point (Step 2 gates it deterministically).
        insufficientEvidence: result.output.insufficientEvidence === true,
        model: result.model,
        promptVersion: result.promptVersion,
      },
      meta: { truncated },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/ai/search — Related observations / retrieval-only search (PRD FR-17, API.md §6.15)
aiRouter.post("/search", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = SearchRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const uid = req.user!.uid;
    const { query, limit, projectId } = parseResult.data;

    const retrievalResult = await retrievalService.retrieve(uid, query, {
      limit: limit || env.AI_SEARCH_DEFAULT_LIMIT,
      projectId,
      minScore: env.AI_RAG_MIN_SCORE,
    });

    const results = retrievalResult.candidates.map((c) => ({
      observationId: c.observationId,
      title: c.title,
      observedAt: c.observedAt,
      score: c.score,
      snippet: c.snippet || "",
    }));

    res.status(200).json({
      data: results,
      meta: {
        resultCount: results.length,
        // True when the index scan hit the candidate cap: older observations
        // were never candidates, so coverage is partial (fixing-plan #16).
        truncated: retrievalResult.truncated,
      },
    });
  } catch (err) {
    next(err);
  }
});
