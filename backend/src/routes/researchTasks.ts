import { Router, Request, Response, NextFunction } from "express";
import {
  CreateResearchTaskSchema,
  UpdateResearchTaskSchema,
  ListResearchTasksQuerySchema,
} from "../schemas/researchTaskSchema";
import { researchTaskRepository } from "../repository/researchTaskRepository";
import { AppError } from "../types/errors";

export const researchTasksRouter = Router();

// POST /api/v1/research-tasks
researchTasksRouter.post("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = CreateResearchTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    // API.md §6.14: Idempotency-Key honored — prevents double-accepting a
    // suggestion (a retried acceptance returns the originally created task).
    const idempotencyKey = req.header("Idempotency-Key");
    if (idempotencyKey) {
      const existing = await researchTaskRepository.findByIdempotencyKey(
        req.user!.uid,
        idempotencyKey
      );
      if (existing) {
        res.status(200).json({ data: existing });
        return;
      }
    }

    const task = await researchTaskRepository.create(req.user!.uid, parseResult.data, idempotencyKey);
    res.status(201).json({ data: task });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/research-tasks
researchTasksRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryResult = ListResearchTasksQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const issues = queryResult.error.issues
        .map((i) => `${i.path.join(".") || "query"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Invalid query parameters: ${issues}`);
    }

    const result = await researchTaskRepository.list(req.user!.uid, queryResult.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/research-tasks/:taskId
researchTasksRouter.get("/:taskId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    if (!taskId) {
      throw new AppError("VALIDATION_ERROR", "taskId parameter is required");
    }

    const task = await researchTaskRepository.findById(req.user!.uid, taskId);
    if (!task) {
      throw new AppError("NOT_FOUND", `Research task '${taskId}' not found`);
    }

    res.status(200).json({ data: task });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/research-tasks/:taskId
researchTasksRouter.patch("/:taskId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    if (!taskId) {
      throw new AppError("VALIDATION_ERROR", "taskId parameter is required");
    }

    const parseResult = UpdateResearchTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const updated = await researchTaskRepository.update(req.user!.uid, taskId, parseResult.data);
    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/research-tasks/:taskId
researchTasksRouter.delete("/:taskId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const taskId = Array.isArray(req.params.taskId) ? req.params.taskId[0] : req.params.taskId;
    if (!taskId) {
      throw new AppError("VALIDATION_ERROR", "taskId parameter is required");
    }

    await researchTaskRepository.delete(req.user!.uid, taskId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
