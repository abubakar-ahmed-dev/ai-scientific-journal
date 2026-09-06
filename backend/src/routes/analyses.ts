import { Router, Request, Response, NextFunction } from "express";
import { ListAnalysesQuerySchema } from "../schemas/analysisSchema";
import { analysisRepository } from "../repository/analysisRepository";
import { AppError } from "../types/errors";

export const analysesRouter = Router();

// GET /api/v1/analyses
analysesRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const queryResult = ListAnalysesQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      const issues = queryResult.error.issues
        .map((i) => `${i.path.join(".") || "query"}: ${i.message}`)
        .join("; ");
      throw new AppError("VALIDATION_ERROR", `Invalid query parameters: ${issues}`);
    }

    const result = await analysisRepository.list(req.user!.uid, queryResult.data);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analyses/:analysisId
analysesRouter.get("/:analysisId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const analysisId = Array.isArray(req.params.analysisId)
      ? req.params.analysisId[0]
      : req.params.analysisId;

    if (!analysisId) {
      throw new AppError("VALIDATION_ERROR", "analysisId parameter is required");
    }

    const includeSources = req.query.includeSources === "summary";

    const analysis = includeSources
      ? await analysisRepository.findByIdWithSourceSummary(req.user!.uid, analysisId)
      : await analysisRepository.findById(req.user!.uid, analysisId);

    if (!analysis) {
      throw new AppError("NOT_FOUND", `Analysis '${analysisId}' not found`);
    }

    res.status(200).json({ data: analysis });
  } catch (err) {
    next(err);
  }
});
