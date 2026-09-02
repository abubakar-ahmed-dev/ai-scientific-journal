import { Router, Request, Response, NextFunction } from "express";
import { conversationRepository } from "../repository/conversationRepository";
import { messageRepository } from "../repository/messageRepository";
import { chatContextBuilder } from "../ai/contextBuilder";
import { getAiService } from "../ai/aiService";
import {
  CreateConversationSchema,
  UpdateConversationSchema,
  ListConversationsQuerySchema,
} from "../schemas/conversationSchema";
import {
  CreateMessageSchema,
  ListMessagesQuerySchema,
} from "../schemas/messageSchema";
import { chatRateLimiter } from "../middleware/rateLimiter";
import { AppError } from "../types/errors";

export const conversationsRouter = Router();

// POST /api/v1/conversations
conversationsRouter.post("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = CreateConversationSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const conversation = await conversationRepository.create(req.user!.uid, parseResult.data);
    res.status(201).json({ data: conversation });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conversations
conversationsRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryResult = ListConversationsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const issues = queryResult.error.issues
        .map((i) => `${i.path.join(".") || "query"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Invalid query parameters: ${issues}`);
    }

    const result = await conversationRepository.list(req.user!.uid, queryResult.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conversations/:conversationId
conversationsRouter.get("/:conversationId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;

    if (!conversationId) {
      throw new AppError("VALIDATION_ERROR", "conversationId parameter is required");
    }

    const conversation = await conversationRepository.findById(req.user!.uid, conversationId);
    if (!conversation) {
      throw new AppError("NOT_FOUND", `Conversation '${conversationId}' not found`);
    }

    res.status(200).json({ data: conversation });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/conversations/:conversationId
conversationsRouter.patch("/:conversationId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;

    if (!conversationId) {
      throw new AppError("VALIDATION_ERROR", "conversationId parameter is required");
    }

    const parseResult = UpdateConversationSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const updated = await conversationRepository.update(req.user!.uid, conversationId, parseResult.data);
    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/conversations/:conversationId
conversationsRouter.delete("/:conversationId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;

    if (!conversationId) {
      throw new AppError("VALIDATION_ERROR", "conversationId parameter is required");
    }

    await conversationRepository.delete(req.user!.uid, conversationId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conversations/:conversationId/messages
conversationsRouter.get("/:conversationId/messages", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;

    if (!conversationId) {
      throw new AppError("VALIDATION_ERROR", "conversationId parameter is required");
    }

    const conversation = await conversationRepository.findById(req.user!.uid, conversationId);
    if (!conversation) {
      throw new AppError("NOT_FOUND", `Conversation '${conversationId}' not found`);
    }

    const queryResult = ListMessagesQuerySchema.safeParse(req.query);
    const limit = queryResult.success ? queryResult.data.limit : 50;
    const cursor = queryResult.success ? queryResult.data.cursor : undefined;

    const result = await messageRepository.list(req.user!.uid, conversationId, limit, cursor);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/conversations/:conversationId/messages — The stateful chat endpoint (ADR-018)
conversationsRouter.post("/:conversationId/messages", chatRateLimiter, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;

    if (!conversationId) {
      throw new AppError("VALIDATION_ERROR", "conversationId parameter is required");
    }

    const parseResult = CreateMessageSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const conversation = await conversationRepository.findById(req.user!.uid, conversationId);
    if (!conversation) {
      throw new AppError("NOT_FOUND", `Conversation '${conversationId}' not found`);
    }

    if (conversation.status === "archived") {
      throw new AppError("VALIDATION_ERROR", "Cannot send messages to an archived conversation");
    }

    // Step 1: Persist user message first (PRD AI-10: user message is durable before model call)
    const userSequence = await messageRepository.getNextSequence(req.user!.uid, conversationId);
    const userMessage = await messageRepository.create(req.user!.uid, conversationId, {
      role: "user",
      content: parseResult.data.content,
      sequence: userSequence,
    });
    await conversationRepository.incrementMessageCount(req.user!.uid, conversationId, 1);

    // Step 2: Assemble bounded context
    const recentMessages = await messageRepository.listRecent(req.user!.uid, conversationId, 20);
    const priorHistory = recentMessages.filter((m) => m.id !== userMessage.id);

    const contextPayload = await chatContextBuilder.buildContext({
      uid: req.user!.uid,
      conversationId,
      contextType: conversation.contextType,
      contextId: conversation.contextId,
      history: priorHistory,
      currentUserMessage: parseResult.data.content,
    });

    // Step 3: Invoke AI Service
    const aiService = getAiService();
    const generationResult = await aiService.generateChatReply(contextPayload);

    // Step 4: Validate output
    if (!generationResult.content || generationResult.content.trim().length === 0) {
      throw new AppError("AI_INVALID_RESPONSE", "Generated reply was empty or invalid");
    }

    // Step 5: Persist assistant message
    const assistantSequence = userSequence + 1;
    const assistantMessage = await messageRepository.create(req.user!.uid, conversationId, {
      role: "assistant",
      content: generationResult.content,
      sequence: assistantSequence,
      model: generationResult.model,
      metadata: generationResult.metadata,
    });
    await conversationRepository.incrementMessageCount(req.user!.uid, conversationId, 1);

    // Step 6: Return response envelope
    res.status(201).json({
      data: {
        userMessage,
        assistantMessage,
      },
    });
  } catch (err) {
    next(err);
  }
});
