import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { Request, Response } from "express";

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute (API.md §4.1 chat tier)
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    ip: false,
    xForwardedForHeader: false,
  },
  keyGenerator: (req: Request): string => {
    // ipKeyGenerator normalizes IPv6 addresses (subnet-masking) so limits
    // cannot be bypassed via address rotation (express-rate-limit v8
    // ERR_ERL_KEY_GEN_IPV6 validation). UID keying is unaffected.
    return req.user?.uid || (req.ip ? ipKeyGenerator(req.ip) : "unknown");
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many AI chat requests. Please slow down and try again.",
        requestId: (res.getHeader("x-request-id") as string) || "req_rate_limit",
      },
    });
  },
});

export const aiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 requests per 5 minutes (API.md §4.1 AI tier)
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    ip: false,
    xForwardedForHeader: false,
  },
  keyGenerator: (req: Request): string => {
    return req.user?.uid || (req.ip ? ipKeyGenerator(req.ip) : "unknown");
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many AI operations. Please slow down and try again.",
        requestId: (res.getHeader("x-request-id") as string) || "req_rate_limit",
      },
    });
  },
});
