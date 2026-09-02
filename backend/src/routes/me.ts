import { Router, Request, Response, NextFunction } from "express";
import { userRepository } from "../repository/userRepository";
import { UpdateUserSchema } from "../schemas/userSchema";
import { ErrorCode } from "../types/errors";

export const meRouter = Router();

// GET /api/v1/me
meRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED" as ErrorCode,
          message: "Unauthenticated request.",
          requestId: req.requestId,
        },
      });
      return;
    }

    const user = await userRepository.findOrCreateUser(req.user.uid, {
      email: req.user.email,
    });

    res.status(200).json({
      data: user,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/me
meRouter.patch("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED" as ErrorCode,
          message: "Unauthenticated request.",
          requestId: req.requestId,
        },
      });
      return;
    }

    const parseResult = UpdateUserSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");

      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR" as ErrorCode,
          message: `Validation failed: ${issues}`,
          requestId: req.requestId,
        },
      });
      return;
    }

    const user = await userRepository.updateUserProfile(req.user.uid, parseResult.data);

    res.status(200).json({
      data: user,
    });
  } catch (err) {
    next(err);
  }
});
