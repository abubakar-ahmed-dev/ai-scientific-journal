import { describe, it, expect } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { serializeTimestamps } from "../../src/lib/serialize";
import { StructuredAnalysisOutputSchema } from "../../src/ai/parsers/analysisOutputSchema";
import { CreateConversationSchema } from "../../src/schemas/conversationSchema";

describe("F1 regression: analysis/task timestamps serialize to ISO", () => {
  it("converts Firestore Timestamps in an analysis-shaped doc", () => {
    const ts = Timestamp.fromDate(new Date("2026-09-02T10:00:00Z"));
    const out = serializeTimestamps({
      ownerId: "u1",
      type: "analysis",
      createdAt: ts,
      summary: "s",
    });
    expect(out.createdAt).toBe("2026-09-02T10:00:00.000Z");
  });

  it("converts Firestore Timestamps in a research-task-shaped doc", () => {
    const ts = Timestamp.fromDate(new Date("2026-09-02T11:30:00Z"));
    const out = serializeTimestamps({
      ownerId: "u1",
      source: "gemini",
      status: "suggested",
      createdAt: ts,
      updatedAt: ts,
    });
    expect(out.createdAt).toBe("2026-09-02T11:30:00.000Z");
    expect(out.updatedAt).toBe("2026-09-02T11:30:00.000Z");
  });
});

describe("F3 regression: research context schema accepts analysis references", () => {
  it("CreateConversationSchema no longer rejects research contextType", () => {
    // Resolution (ownership check) happens in the repository; schema passes it through
    const result = CreateConversationSchema.safeParse({ contextType: "research", contextId: "anl_1" });
    expect(result.success).toBe(true);
  });
});

describe("ADR-009 guard remains intact after fixes", () => {
  it("schema still rejects malformed structured outputs", () => {
    expect(StructuredAnalysisOutputSchema.safeParse({ keyFindings: "nope" }).success).toBe(false);
    expect(
      StructuredAnalysisOutputSchema.safeParse({ summary: "ok", hypotheses: [{ confidence: "invalid-enum" }] }).success
    ).toBe(false);
  });
});
