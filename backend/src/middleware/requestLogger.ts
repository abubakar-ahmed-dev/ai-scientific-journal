import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        route: req.route?.path ?? req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
      },
      "request completed"
    );
  });
  next();
}
