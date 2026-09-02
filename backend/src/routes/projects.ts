import { Router, Request, Response, NextFunction } from "express";
import { projectRepository } from "../repository/projectRepository";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ListProjectsQuerySchema,
} from "../schemas/projectSchema";
import { AppError } from "../types/errors";

export const projectsRouter = Router();

// POST /api/v1/projects
projectsRouter.post("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = CreateProjectSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const project = await projectRepository.create(req.user!.uid, parseResult.data);
    res.status(201).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects
projectsRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryResult = ListProjectsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const issues = queryResult.error.issues
        .map((i) => `${i.path.join(".") || "query"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Invalid query parameters: ${issues}`);
    }

    const result = await projectRepository.list(req.user!.uid, queryResult.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:projectId
projectsRouter.get("/:projectId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    if (!projectId) {
      throw new AppError("VALIDATION_ERROR", "projectId parameter is required");
    }
    const project = await projectRepository.findById(req.user!.uid, projectId);

    if (!project) {
      throw new AppError("NOT_FOUND", `Project '${projectId}' not found`);
    }

    res.status(200).json({ data: project });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/projects/:projectId
projectsRouter.patch("/:projectId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    if (!projectId) {
      throw new AppError("VALIDATION_ERROR", "projectId parameter is required");
    }
    const parseResult = UpdateProjectSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const updated = await projectRepository.update(req.user!.uid, projectId, parseResult.data);
    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/projects/:projectId
projectsRouter.delete("/:projectId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
    if (!projectId) {
      throw new AppError("VALIDATION_ERROR", "projectId parameter is required");
    }
    await projectRepository.delete(req.user!.uid, projectId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
