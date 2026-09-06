import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { CreateConversationSchema } from "../../src/schemas/conversationSchema";
import { serializeTimestamps } from "../../src/lib/serialize";

describe("research contextType (superseded in Phase 5: analyses exist, resolution implemented)", () => {
  // Phase 4 fix deferred `research` context until the analyses collection
  // existed. Phase 5 shipped analyses and the Phase 5 fixes lift the
  // deferral — the schema passes it through and the repository resolves
  // the analysis ownership-checked (see contextBuilder/conversationRepository).
  it("accepts contextType 'research' with a contextId at the schema level", () => {
    const result = CreateConversationSchema.safeParse({ contextType: "research", contextId: "anl_123" });
    expect(result.success).toBe(true);
  });

  it("still accepts general, observation, project contexts", () => {
    expect(CreateConversationSchema.safeParse({ contextType: "general" }).success).toBe(true);
    expect(CreateConversationSchema.safeParse({ contextType: "observation", contextId: "obs_1" }).success).toBe(true);
    expect(CreateConversationSchema.safeParse({ contextType: "project", contextId: "proj_1" }).success).toBe(true);
  });

  it("still rejects general context with a contextId", () => {
    expect(CreateConversationSchema.safeParse({ contextType: "general", contextId: "x" }).success).toBe(false);
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
