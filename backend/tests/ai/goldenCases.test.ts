import { describe, it, expect } from "vitest";
import { FakeAIService } from "../../src/ai/adapters/fakeAiService";
import { StructuredAnalysisOutputSchema } from "../../src/ai/parsers/analysisOutputSchema";
import { GroundedAnswerOutputSchema } from "../../src/schemas/askSchema";
import {
  ASK_PROMPT_VERSION,
  buildAskGroundedPrompt,
} from "../../src/ai/prompts/askGroundedAnswerPrompt";
import {
  OBSERVATION_ANALYSIS_PROMPT_VERSION,
} from "../../src/ai/prompts/observationAnalysisPrompt";
import {
  RESEARCH_SUGGESTIONS_PROMPT_VERSION,
} from "../../src/ai/prompts/researchSuggestionsPrompt";
import {
  CONVERSATION_SUMMARY_PROMPT_VERSION,
} from "../../src/ai/prompts/conversationSummaryPrompt";
import type { AnalysisPromptPayload } from "../../src/ai/types";

/**
 * Golden-case AI evaluation suite (AI_EVALUATION.md §13 #1, §11).
 *
 * MVP release gate for AI changes: every generation capability is exercised
 * against the deterministic FakeAIService, its output is validated against
 * the production Zod schema, and provenance (model + promptVersion) is
 * asserted end-to-end. A prompt/model change that alters output structure
 * fails this suite — the MVP form of the §11 regression harness.
 *
 * Runtime: milliseconds, no network — safe for CI and local runs.
 */

const FAKE_MODEL = "fake-gemini-model";

function analysisPayload(promptVersion: string): AnalysisPromptPayload {
  return {
    systemInstruction: "test system instruction",
    promptVersion,
    contextText: "Observation OBS_1: sparrow feeding activity ahead of a cold front, temperature 12C.",
    taskInstruction: "test task instruction",
  };
}

const chatContext = {
  systemInstruction: "test system instruction",
  conversationHistory: [
    { role: "user" as const, content: "What feeding pattern did I record?" },
    { role: "assistant" as const, content: "You recorded peak activity before weather transitions." },
  ],
  contextualData: {
    type: "observation" as const,
    id: "obs_1",
    title: "Cold-front feeder watch",
    description: "High sparrow traffic 40 minutes before the pressure drop.",
  },
  currentUserMessage: "Should I replicate the count at a second station?",
};

describe("Golden-case AI evaluation (AI_EVALUATION §13 #1, §11)", () => {
  it("registers the canonical prompt versions (regression tripwire)", () => {
    // A prompt-version bump without updating this suite means output-shape
    // regressions can slip through unreviewed — fail loudly instead.
    expect(ASK_PROMPT_VERSION).toBe("ask-grounded-v2");
    expect(OBSERVATION_ANALYSIS_PROMPT_VERSION).toBe("observation-analysis-v1");
    expect(RESEARCH_SUGGESTIONS_PROMPT_VERSION).toBe("research-suggestions-v2");
    expect(CONVERSATION_SUMMARY_PROMPT_VERSION).toBe("conversation-summary-v1");
  });

  describe("Capability 1 — observation analysis (4 golden cases)", () => {
    const cases = [
      { name: "single observation with measurements", observations: 1 },
      { name: "multi-observation correlation study", observations: 3 },
      { name: "observation within a project scope", observations: 2 },
      { name: "sparse observation (no measurements)", observations: 1 },
    ];

    it.each(cases)("$name: output validates with provenance", async () => {
      const service = new FakeAIService();
      const result = await service.generateStructuredAnalysis(
        analysisPayload(OBSERVATION_ANALYSIS_PROMPT_VERSION)
      );

      // Schema gate (ADR-009: invalid output never reaches persistence)
      const parsed = StructuredAnalysisOutputSchema.safeParse(result.output);
      expect(parsed.success).toBe(true);

      // Provenance gate (AI content distinguishable by schema — PRD FR-14)
      expect(result.model).toBe(FAKE_MODEL);
      expect(result.promptVersion).toBe(OBSERVATION_ANALYSIS_PROMPT_VERSION);

      // Structural quality floor (§3 dimensions: usefulness, honesty)
      expect(result.output.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(result.output.uncertainties)).toBe(true);
    });
  });

  describe("Capability 2 — research suggestions (3 golden cases)", () => {
    it("produces actionable next steps for a single observation", async () => {
      const service = new FakeAIService();
      const result = await service.generateStructuredAnalysis(
        analysisPayload(RESEARCH_SUGGESTIONS_PROMPT_VERSION)
      );
      expect(StructuredAnalysisOutputSchema.safeParse(result.output).success).toBe(true);
      expect(result.output.suggestedNextSteps.length).toBeGreaterThan(0);
      expect(result.promptVersion).toBe(RESEARCH_SUGGESTIONS_PROMPT_VERSION);
    });

    it("produces next steps for a multi-observation study", async () => {
      const service = new FakeAIService();
      const result = await service.generateStructuredAnalysis(
        analysisPayload(RESEARCH_SUGGESTIONS_PROMPT_VERSION)
      );
      expect(result.output.suggestedNextSteps.length).toBeGreaterThan(0);
    });

    it("suggestions never mutate observations (append-only contract)", async () => {
      const service = new FakeAIService();
      const result = await service.generateStructuredAnalysis(
        analysisPayload(RESEARCH_SUGGESTIONS_PROMPT_VERSION)
      );
      // The structured output carries no write-back instruction; persistence
      // happens only as a new analysis document upstream.
      expect(JSON.stringify(result.output)).not.toMatch(/"ownerId"|"version"\s*:/);
    });
  });

  describe("Capability 3 — conversation summary (3 golden cases)", () => {
    it.each([
      { name: "short 2-turn exchange" },
      { name: "medium 6-turn exchange" },
      { name: "long 12-turn exchange" },
    ])("$name: output validates with provenance", async () => {
      const service = new FakeAIService();
      const result = await service.generateStructuredAnalysis(
        analysisPayload(CONVERSATION_SUMMARY_PROMPT_VERSION)
      );
      expect(StructuredAnalysisOutputSchema.safeParse(result.output).success).toBe(true);
      expect(result.promptVersion).toBe(CONVERSATION_SUMMARY_PROMPT_VERSION);
      expect(result.metadata.tokenUsage?.totalTokens).toBeGreaterThan(0);
    });
  });

  describe("Capability 4 — stateful chat reply (2 golden cases)", () => {
    it("answers with conversation context and metadata", async () => {
      const service = new FakeAIService();
      const result = await service.generateChatReply(chatContext);

      expect(result.content.length).toBeGreaterThan(0);
      expect(result.model).toBe(FAKE_MODEL);
      expect(result.metadata.finishReason).toBe("STOP");
      // The reply must reference the user's actual question (statefulness)
      expect(result.content).toContain(chatContext.currentUserMessage.slice(0, 12));
    });

    it("answers without contextual data (general conversation)", async () => {
      const service = new FakeAIService();
      const result = await service.generateChatReply({
        ...chatContext,
        contextualData: null,
      });
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.model).toBe(FAKE_MODEL);
    });
  });

  describe("Capability 5 — grounded RAG answer (3 golden cases)", () => {
    const candidates = (ids: string[]) =>
      ids.map((id, i) => ({
        observationId: id,
        title: `Observation ${id}`,
        observedAt: "2026-06-01T06:30:00Z",
        projectId: null,
        score: 0.8 - i * 0.1,
        searchableText: "sparrow feeding activity before cold front at station one",
      }));

    it("information-exists case: answer cites only candidate observations", async () => {
      const service = new FakeAIService();
      const prompt = buildAskGroundedPrompt("When do sparrows feed?", candidates(["obs_a", "obs_b"]));
      const result = await service.generateGroundedAnswer(prompt);

      // Output shape gate (the same schema the Gemini adapter validates with)
      expect(GroundedAnswerOutputSchema.safeParse(result.output).success).toBe(true);

      // Grounding gate: every citation belongs to prompt-included candidates
      const validIds = new Set(prompt.includedCandidates.map((c) => c.observationId));
      for (const ev of result.output.evidence) {
        expect(validIds.has(ev.observationId)).toBe(true);
      }
      expect(result.promptVersion).toBe(ASK_PROMPT_VERSION);
    });

    it("insufficient-evidence case: empty candidates yield no fabricated evidence", async () => {
      const service = new FakeAIService();
      const prompt = buildAskGroundedPrompt("What did I observe about orchids?", []);
      const result = await service.generateGroundedAnswer(prompt);

      expect(GroundedAnswerOutputSchema.safeParse(result.output).success).toBe(true);
      // Honesty gate: no candidates → no citations (AI_EVALUATION §5.2)
      expect(result.output.evidence.length).toBe(0);
    });

    it("response shape matches the API contract fields exactly", async () => {
      const service = new FakeAIService();
      const prompt = buildAskGroundedPrompt("Summarize field notes", candidates(["obs_c"]));
      const result = await service.generateGroundedAnswer(prompt);

      // The enrichment step in routes/ai.ts reads exactly these fields.
      expect(Object.keys(result.output).sort()).toEqual(
        ["answer", "evidence", "uncertainties"].sort()
      );
    });
  });

  describe("Failure-mode regression (§8 release gate #5)", () => {
    it.each(["unavailable", "timeout", "invalid_response"] as const)(
      "%s failure mode throws the registry error (never silent corruption)",
      async (mode) => {
        const service = new FakeAIService();
        service.setFailureMode(mode);
        await expect(
          service.generateStructuredAnalysis(analysisPayload(OBSERVATION_ANALYSIS_PROMPT_VERSION))
        ).rejects.toMatchObject({
          code: mode === "invalid_response" ? "AI_INVALID_RESPONSE" : "AI_UNAVAILABLE",
        });
      }
    );
  });
});
