import { describe, it, expect, vi } from "vitest";
import { chatContextBuilder } from "../../src/ai/contextBuilder";
import { observationRepository } from "../../src/repository/observationRepository";
import { projectRepository } from "../../src/repository/projectRepository";

describe("ChatContextBuilder", () => {
  it("builds context with sliding window history and observation data", async () => {
    vi.spyOn(observationRepository, "findById").mockResolvedValueOnce({
      id: "obs_1",
      ownerId: "user_1",
      projectId: null,
      title: "Bird observation",
      description: "Birds at feeder",
      notes: "Clear sky",
      hypothesis: "Activity increases before storm",
      observedAt: "2026-09-02T10:00:00Z",
      location: null,
      tags: ["birds", "weather"],
      measurements: [{ name: "count", value: 15, unit: "birds" }],
      status: "observed",
      mediaCount: 0,
      version: 1,
      createdAt: "2026-09-02T10:00:00Z",
      updatedAt: "2026-09-02T10:00:00Z",
    });

    const history: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello researcher" },
      { role: "user", content: "Can we look at my observations?" },
    ];

    const context = await chatContextBuilder.buildContext({
      uid: "user_1",
      conversationId: "conv_1",
      contextType: "observation",
      contextId: "obs_1",
      history,
      currentUserMessage: "What patterns do you see?",
    });

    expect(context.contextualData).not.toBeNull();
    expect(context.contextualData?.type).toBe("observation");
    expect(context.contextualData?.title).toBe("Bird observation");
    expect(context.contextualData?.measurements?.[0]?.name).toBe("count");
    expect(context.conversationHistory.length).toBe(3);
    expect(context.currentUserMessage).toBe("What patterns do you see?");
    expect(context.systemInstruction).toContain("AI Scientific Journal Assistant");
  });

  it("builds context with project data when contextType is project", async () => {
    vi.spyOn(projectRepository, "findById").mockResolvedValueOnce({
      id: "proj_1",
      ownerId: "user_1",
      title: "Urban Ecology",
      description: "Urban ecology research project",
      field: "Ecology",
      status: "active",
      tags: ["urban"],
      createdAt: "2026-09-02T10:00:00Z",
      updatedAt: "2026-09-02T10:00:00Z",
      archivedAt: null,
    });

    const context = await chatContextBuilder.buildContext({
      uid: "user_1",
      conversationId: "conv_1",
      contextType: "project",
      contextId: "proj_1",
      history: [],
      currentUserMessage: "Outline next steps",
    });

    expect(context.contextualData?.type).toBe("project");
    expect(context.contextualData?.field).toBe("Ecology");
  });

  it("throws 404 NOT_FOUND when referenced context entity is missing or foreign", async () => {
    vi.spyOn(observationRepository, "findById").mockResolvedValueOnce(null);

    await expect(
      chatContextBuilder.buildContext({
        uid: "user_1",
        conversationId: "conv_1",
        contextType: "observation",
        contextId: "nonexistent_obs",
        history: [],
        currentUserMessage: "Hello",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
