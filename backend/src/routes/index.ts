import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { meRouter } from "./me";
import { projectsRouter } from "./projects";
import { observationsRouter } from "./observations";
import { conversationsRouter } from "./conversations";
import { aiRouter } from "./ai";
import { analysesRouter } from "./analyses";
import { researchTasksRouter } from "./researchTasks";

export const apiV1Router = Router();

apiV1Router.get("/", (_req, res) => {
  res.status(200).json({ data: { service: "ai-scientific-journal", apiVersion: "v1" } });
});

// Require authentication for all business endpoints beneath /api/v1 (API.md §2)
apiV1Router.use(requireAuth);

apiV1Router.use("/me", meRouter);
apiV1Router.use("/projects", projectsRouter);
apiV1Router.use("/observations", observationsRouter);
apiV1Router.use("/conversations", conversationsRouter);
apiV1Router.use("/ai", aiRouter);
apiV1Router.use("/analyses", analysesRouter);
apiV1Router.use("/research-tasks", researchTasksRouter);
