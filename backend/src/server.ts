import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`server listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Cloud Run sends SIGTERM on redeploys — drain in-flight requests
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down");
  server.close(() => process.exit(0));
});
