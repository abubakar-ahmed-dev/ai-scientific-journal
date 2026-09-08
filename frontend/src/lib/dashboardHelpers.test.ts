import { describe, it, expect } from "vitest";
import {
  pickCurrentResearch,
  summarizeTasks,
  buildActivity,
  nextStepSuggestion,
} from "./dashboardHelpers";
import type { Analysis, Observation, Project, ResearchTask } from "./api";

const OBS = (over: Partial<Observation> = {}): Observation => ({
  id: "obs_1",
  ownerId: "u",
  projectId: null,
  title: "Observation",
  description: "d",
  observedAt: "2026-09-01T10:00:00Z",
  hypothesis: null,
  notes: null,
  tags: [],
  status: "recorded",
  measurements: [],
  location: null,
  version: 1,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-01T10:00:00Z",
  ...over,
});

const PROJECT = (over: Partial<Project> = {}): Project => ({
  id: "proj_1",
  ownerId: "u",
  title: "Project",
  description: null,
  field: null,
  status: "active",
  tags: [],
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-01T10:00:00Z",
  ...over,
});

const TASK = (over: Partial<ResearchTask> = {}): ResearchTask => ({
  id: "task_1",
  ownerId: "u",
  projectId: null,
  title: "Task",
  description: "d",
  source: "user",
  sourceAnalysisId: null,
  status: "planned",
  relatedObservationIds: [],
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-01T10:00:00Z",
  ...over,
});

const ANALYSIS = (over: Partial<Analysis> = {}): Analysis => ({
  id: "anl_1",
  ownerId: "u",
  projectId: null,
  observationIds: ["obs_1"],
  conversationId: null,
  type: "analysis",
  summary: "s",
  keyFindings: [],
  hypotheses: [],
  uncertainties: [],
  suggestedQuestions: [],
  openQuestions: [],
  suggestedNextSteps: [],
  model: "gemini",
  promptVersion: "v1",
  createdAt: "2026-09-01T09:00:00Z",
  ...over,
});

describe("pickCurrentResearch", () => {
  it("returns the most recently updated active project", () => {
    const older = PROJECT({ id: "p_old", updatedAt: "2026-09-01T10:00:00Z" });
    const newer = PROJECT({ id: "p_new", updatedAt: "2026-09-02T10:00:00Z" });
    const archived = PROJECT({ id: "p_arch", status: "archived", updatedAt: "2026-09-03T10:00:00Z" });
    expect(pickCurrentResearch([older, archived, newer])?.id).toBe("p_new");
  });

  it("returns null when there is no active project", () => {
    expect(pickCurrentResearch([PROJECT({ status: "archived" })])).toBeNull();
  });
});

describe("summarizeTasks", () => {
  it("sorts by status priority then recency and respects max", () => {
    const suggested = TASK({ id: "t_sug", status: "suggested", updatedAt: "2026-09-02T10:00:00Z" });
    const planned = TASK({ id: "t_pla", status: "planned", updatedAt: "2026-09-02T11:00:00Z" });
    const inProgress = TASK({ id: "t_inp", status: "in_progress", updatedAt: "2026-09-01T10:00:00Z" });
    const top = summarizeTasks([suggested, planned, inProgress], 2);
    expect(top.map((t) => t.id)).toEqual(["t_inp", "t_pla"]);
  });
});

describe("buildActivity", () => {
  it("merges records newest-first with working links, capped at max", () => {
    const items = buildActivity(
      [OBS({ id: "o1", updatedAt: "2026-09-03T10:00:00Z" })],
      [TASK({ id: "t1", status: "completed", updatedAt: "2026-09-04T10:00:00Z" })],
      [ANALYSIS({ id: "a1", createdAt: "2026-09-02T10:00:00Z", observationIds: ["o1"] })],
      2
    );
    expect(items.map((i) => i.id)).toEqual(["task-t1", "obs-o1"]);
    expect(items[0].to).toBe("/tasks");
    expect(items[1].to).toBe("/observations/o1");
  });

  it("links analyses to their source observation", () => {
    const items = buildActivity([], [], [ANALYSIS({ observationIds: ["o9"] })], 6);
    expect(items[0].to).toBe("/observations/o9");
  });
});

describe("nextStepSuggestion", () => {
  it("prefers a fresh analysis suggestion, explicitly labeled as AI-sourced", () => {
    const step = nextStepSuggestion({
      observations: [OBS({ createdAt: "2026-09-01T10:00:00Z" })],
      openTasks: [],
      analyses: [
        ANALYSIS({
          createdAt: "2026-09-02T10:00:00Z",
          suggestedNextSteps: ["Replicate with control group"],
          observationIds: ["obs_1"],
        }),
      ],
      hasActiveProject: true,
    });
    expect(step.source).toBe("analysis");
    expect(step.label).toBe("From your last analysis");
    expect(step.text).toBe("Replicate with control group");
    expect(step.to).toBe("/observations/obs_1");
  });

  it("suggests analyzing the latest unanalyzed observation", () => {
    const step = nextStepSuggestion({
      observations: [OBS({ id: "obs_2", status: "recorded" })],
      openTasks: [],
      analyses: [ANALYSIS({ createdAt: "2026-09-01T09:00:00Z" })],
      hasActiveProject: true,
    });
    expect(step.source).toBe("rule");
    expect(step.to).toBe("/observations/obs_2");
    expect(step.text).toMatch(/analyze your latest observation/i);
  });

  it("points to AI task suggestions before plain open tasks", () => {
    const step = nextStepSuggestion({
      observations: [OBS({ status: "analyzed" })],
      openTasks: [
        TASK({ source: "gemini", status: "suggested" }),
        TASK({ id: "t2", source: "user", status: "planned" }),
      ],
      analyses: [],
      hasActiveProject: true,
    });
    expect(step.to).toBe("/tasks");
    expect(step.text).toContain("1 task suggestion");
  });

  it("reports open tasks when none are AI suggestions", () => {
    const step = nextStepSuggestion({
      observations: [OBS({ status: "analyzed" })],
      openTasks: [TASK({ source: "user", status: "in_progress" })],
      analyses: [],
      hasActiveProject: true,
    });
    expect(step.text).toContain("1 open task");
    expect(step.to).toBe("/tasks");
  });

  it("suggests grouping into a project when observations exist unanchored", () => {
    const step = nextStepSuggestion({
      observations: [OBS({ status: "analyzed" })],
      openTasks: [],
      analyses: [],
      hasActiveProject: false,
    });
    expect(step.to).toBe("/projects");
    expect(step.text).toMatch(/project/i);
  });

  it("falls back to recording a new observation", () => {
    const step = nextStepSuggestion({
      observations: [OBS({ status: "analyzed" })],
      openTasks: [],
      analyses: [],
      hasActiveProject: true,
    });
    expect(step.to).toBe("/observations/new");
  });
});
