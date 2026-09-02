import { Router } from "express";

// Phase 2+: auth middleware, /me, projects, observations, conversations, /ai/* (API.md §6)
export const apiV1Router = Router();

apiV1Router.get("/", (_req, res) => {
  res.status(200).json({ data: { service: "ai-scientific-journal", apiVersion: "v1" } });
});
