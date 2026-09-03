import { describe, it, expect } from "vitest";
import { StructuredAnalysisOutputSchema } from "../../src/ai/parsers/analysisOutputSchema";

describe("StructuredAnalysisOutputSchema", () => {
  it("successfully parses valid structured output", () => {
    const raw = {
      summary: "Bird activity spiked ahead of barometric drop.",
      keyFindings: ["Activity increased 45% 30 mins before front."],
      hypotheses: [
        {
          statement: "Birds feed more heavily ahead of pressure drops.",
          confidence: "high",
          supportingObservationIds: ["obs_1"],
        },
      ],
      uncertainties: ["Wind speed was not recorded."],
      suggestedQuestions: ["How does humidity affect this rate?"],
      openQuestions: [],
      suggestedNextSteps: ["Log barometric pressure continuously for 5 days."],
    };

    const parsed = StructuredAnalysisOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.summary).toBe("Bird activity spiked ahead of barometric drop.");
      expect(parsed.data.hypotheses[0]?.confidence).toBe("high");
    }
  });

  it("applies defaults for missing optional arrays", () => {
    const raw = {
      summary: "Minimal summary",
    };

    const parsed = StructuredAnalysisOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.keyFindings).toEqual([]);
      expect(parsed.data.hypotheses).toEqual([]);
      expect(parsed.data.suggestedNextSteps).toEqual([]);
    }
  });

  it("fails validation when summary is missing", () => {
    const raw = {
      keyFindings: ["Some finding"],
    };

    const parsed = StructuredAnalysisOutputSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
  });
});
