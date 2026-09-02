import fs from "fs";
import path from "path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { requestId } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { apiRateLimiter } from "./middleware/rateLimit";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { apiV1Router } from "./routes";

export function createApp(): express.Express {
  const app = express();

  // Cloud Run terminates TLS behind a load balancer (DEPLOYMENT.md §6)
  app.set("trust proxy", 1);

  // Canonical middleware order (TA §77): requestId → headers → CORS → body → logging → rate limit
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(apiRateLimiter);

  // Liveness — public, deliberately unversioned, zero infrastructure detail (API.md §6.1)
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // All business endpoints (ADR-018)
  app.use("/api/v1", apiV1Router);

  // Production: this service serves the built SPA — one container, one service (DEPLOYMENT.md §2)
  const staticRoot = path.resolve(__dirname, "../../frontend/dist");
  if (env.NODE_ENV === "production" && fs.existsSync(staticRoot)) {
    app.use(express.static(staticRoot));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(staticRoot, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
