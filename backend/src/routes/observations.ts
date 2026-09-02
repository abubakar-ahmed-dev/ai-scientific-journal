import { Router, Request, Response, NextFunction } from "express";
import { observationRepository } from "../repository/observationRepository";
import { observationVersionRepository } from "../repository/observationVersionRepository";
import {
  CreateObservationSchema,
  UpdateObservationSchema,
  ListObservationsQuerySchema,
} from "../schemas/observationSchema";
import { PaginationQuerySchema } from "../schemas/paginationSchema";
import { AppError } from "../types/errors";

export const observationsRouter = Router();

// POST /api/v1/observations
observationsRouter.post("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = CreateObservationSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const observation = await observationRepository.create(req.user!.uid, parseResult.data);
    res.status(201).json({ data: observation });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/observations
observationsRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryResult = ListObservationsQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const issues = queryResult.error.issues
        .map((i) => `${i.path.join(".") || "query"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Invalid query parameters: ${issues}`);
    }

    const result = await observationRepository.list(req.user!.uid, queryResult.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/observations/:observationId
observationsRouter.get("/:observationId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const observationId = Array.isArray(req.params.observationId) ? req.params.observationId[0] : req.params.observationId;
    if (!observationId) {
      throw new AppError("VALIDATION_ERROR", "observationId parameter is required");
    }
    const observation = await observationRepository.findById(req.user!.uid, observationId);

    if (!observation) {
      throw new AppError("NOT_FOUND", `Observation '${observationId}' not found`);
    }

    res.status(200).json({ data: observation });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/observations/:observationId
observationsRouter.patch("/:observationId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const observationId = Array.isArray(req.params.observationId) ? req.params.observationId[0] : req.params.observationId;
    if (!observationId) {
      throw new AppError("VALIDATION_ERROR", "observationId parameter is required");
    }
    const parseResult = UpdateObservationSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
    }

    const updated = await observationRepository.update(
      req.user!.uid,
      observationId,
      parseResult.data,
      req.user!.uid
    );
    res.status(200).json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/observations/:observationId
observationsRouter.delete("/:observationId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const observationId = Array.isArray(req.params.observationId) ? req.params.observationId[0] : req.params.observationId;
    if (!observationId) {
      throw new AppError("VALIDATION_ERROR", "observationId parameter is required");
    }
    await observationRepository.delete(req.user!.uid, observationId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/observations/:observationId/versions
observationsRouter.get("/:observationId/versions", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const observationId = Array.isArray(req.params.observationId) ? req.params.observationId[0] : req.params.observationId;
    if (!observationId) {
      throw new AppError("VALIDATION_ERROR", "observationId parameter is required");
    }
    const parentObservation = await observationRepository.findById(req.user!.uid, observationId);

    if (!parentObservation) {
      throw new AppError("NOT_FOUND", `Observation '${observationId}' not found`);
    }

    const paginationResult = PaginationQuerySchema.safeParse(req.query);
    const limit = paginationResult.success ? paginationResult.data.limit : 20;
    const cursor = paginationResult.success ? paginationResult.data.cursor : undefined;

    const result = await observationVersionRepository.list(req.user!.uid, observationId, limit, cursor);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/observations/:observationId/versions/:versionId
observationsRouter.get("/:observationId/versions/:versionId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const observationId = Array.isArray(req.params.observationId) ? req.params.observationId[0] : req.params.observationId;
    const versionId = Array.isArray(req.params.versionId) ? req.params.versionId[0] : req.params.versionId;
    if (!observationId || !versionId) {
      throw new AppError("VALIDATION_ERROR", "observationId and versionId parameters are required");
    }
    const parentObservation = await observationRepository.findById(req.user!.uid, observationId);

    if (!parentObservation) {
      throw new AppError("NOT_FOUND", `Observation '${observationId}' not found`);
    }

    const version = await observationVersionRepository.findById(req.user!.uid, observationId, versionId);
    if (!version) {
      throw new AppError("NOT_FOUND", `Version '${versionId}' not found for observation '${observationId}'`);
    }

    res.status(200).json({ data: version });
  } catch (err) {
    next(err);
  }
});
