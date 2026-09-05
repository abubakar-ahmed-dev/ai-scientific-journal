import pino from "pino";
import { env } from "../config/env";

// LOG_LEVEL overrides the per-environment default so local development can
// quiet request logging (e.g. LOG_LEVEL=warn) without touching code.
export const logger = pino({
  level: env.LOG_LEVEL ?? (env.NODE_ENV === "development" ? "debug" : "info"),
});
