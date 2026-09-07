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

// Retrieval-only tier (API.md §4.1): /ai/search is a cheap non-generative
// read triggered by ordinary page views — browsing related observations must
// not starve the same bucket as Gemini generation.
export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
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
        message: "Too many search requests. Please slow down and try again.",
        requestId: (res.getHeader("x-request-id") as string) || "req_rate_limit",
      },
    });
  },
});

export const mediaRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 uploads per hour (API.md §4.1 media tier)
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
        message: "Too many media uploads. Please try again later.",
        requestId: (res.getHeader("x-request-id") as string) || "req_rate_limit",
      },
    });
  },
});
