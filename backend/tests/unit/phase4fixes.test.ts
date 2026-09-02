import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { CreateConversationSchema } from "../../src/schemas/conversationSchema";
import { serializeTimestamps } from "../../src/lib/serialize";

describe("F1 regression: research contextType honestly deferred (API.md §6.10)", () => {
  it("rejects contextType 'research' with 400-class validation error", () => {
    const result = CreateConversationSchema.safeParse({ contextType: "research", contextId: "anl_123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("contextType"))).toBe(true);
    }
  });

  it("still accepts general, observation, project contexts", () => {
    expect(CreateConversationSchema.safeParse({ contextType: "general" }).success).toBe(true);
    expect(CreateConversationSchema.safeParse({ contextType: "observation", contextId: "obs_1" }).success).toBe(true);
    expect(CreateConversationSchema.safeParse({ contextType: "project", contextId: "proj_1" }).success).toBe(true);
  });
});

describe("F3 regression: conversation timestamps serialize to ISO (no raw Timestamp leak)", () => {
  it("serializeTimestamps converts Firestore Timestamps in a conversation-shaped doc", () => {
    const ts = Timestamp.fromDate(new Date("2026-09-02T10:00:00Z"));
    const out = serializeTimestamps({
      ownerId: "u1",
      contextType: "general",
      messageCount: 0,
      createdAt: ts,
      updatedAt: ts,
    });
    expect(out.createdAt).toBe("2026-09-02T10:00:00.000Z");
    expect(out.updatedAt).toBe("2026-09-02T10:00:00.000Z");
  });
});
