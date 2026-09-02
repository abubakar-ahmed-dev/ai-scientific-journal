import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { meRouter } from "./me";

export const apiV1Router = Router();

apiV1Router.get("/", (_req, res) => {
  res.status(200).json({ data: { service: "ai-scientific-journal", apiVersion: "v1" } });
});

// Require authentication for all business endpoints beneath /api/v1 (API.md §2)
apiV1Router.use(requireAuth);

apiV1Router.use("/me", meRouter);
