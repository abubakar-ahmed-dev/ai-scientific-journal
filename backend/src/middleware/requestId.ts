import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("X-Request-Id");
  // Cap accepted length — an unbounded echo of a client header is a header-injection vector.
  req.requestId =
    incoming && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
