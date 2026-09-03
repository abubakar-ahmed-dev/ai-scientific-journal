import { Router, Request, Response, NextFunction } from "express";
import {
  SummarizeRequestSchema,
  AnalyzeRequestSchema,
  SuggestResearchRequestSchema,
} from "../schemas/analysisSchema";
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
import { AppError } from "../types/errors";

export const aiRouter = Router();

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
    const result = await aiService.generateStructuredAnalysis(promptPayload);

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
    const result = await aiService.generateStructuredAnalysis(promptPayload);

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
    const result = await aiService.generateStructuredAnalysis(promptPayload);

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
