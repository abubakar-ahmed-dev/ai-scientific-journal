import type { Request, Response, NextFunction } from "express";
import { AppError } from "../types/errors";
import { logger } from "../lib/logger";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested resource could not be found.",
      requestId: req.requestId,
    },
  });
}

// Express 5 identifies error middleware by arity — `next` must remain in the signature.
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, requestId: req.requestId },
    });
    return;
  }

  // body-parser failure classes → registry codes (never leak parser internals)
  const type = (err as { type?: string } | null)?.type;
  if (type === "entity.parse.failed") {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body is not valid JSON.",
        requestId: req.requestId,
      },
    });
    return;
  }
  if (type === "entity.too.large") {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the configured size limit.",
        requestId: req.requestId,
      },
    });
    return;
  }

  // Server-side detail only — the client response is always sanitized.
  logger.error(
    { err, requestId: req.requestId, route: req.originalUrl },
    "unhandled error"
  );
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId: req.requestId,
    },
  });
}
