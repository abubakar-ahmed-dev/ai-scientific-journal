import {
  IAIService,
  ChatContextPayload,
  ChatGenerationResult,
  AnalysisPromptPayload,
  StructuredAnalysisResult,
  GroundedAnswerOutput,
  GroundedAnswerPayload,
  GroundedAnswerResult,
} from "../types";
import { StructuredAnalysisOutput } from "../parsers/analysisOutputSchema";
import { AppError } from "../../types/errors";

export class FakeAIService implements IAIService {
  private failureMode: "none" | "unavailable" | "invalid_response" | "timeout" = "none";
  private customChatResponse: string | null = null;
  private customAnalysisOutput: StructuredAnalysisOutput | null = null;
  private customGroundedOutput: GroundedAnswerOutput | null = null;
  public chatHistory: ChatContextPayload[] = [];
  public analysisHistory: AnalysisPromptPayload[] = [];
  public groundedHistory: GroundedAnswerPayload[] = [];

  get invocationHistory(): ChatContextPayload[] {
    return this.chatHistory;
  }

  setFailureMode(mode: "none" | "unavailable" | "invalid_response" | "timeout") {
    this.failureMode = mode;
  }

  setCustomResponse(response: string | null) {
    this.customChatResponse = response;
  }

  setCustomAnalysisOutput(output: StructuredAnalysisOutput | null) {
    this.customAnalysisOutput = output;
  }

  setCustomGroundedOutput(output: GroundedAnswerOutput | null) {
    this.customGroundedOutput = output;
  }

  reset() {
    this.failureMode = "none";
    this.customChatResponse = null;
    this.customAnalysisOutput = null;
    this.customGroundedOutput = null;
    this.chatHistory = [];
    this.analysisHistory = [];
    this.groundedHistory = [];
  }

  async generateChatReply(context: ChatContextPayload): Promise<ChatGenerationResult> {
    this.chatHistory.push(context);

    if (this.failureMode === "unavailable") {
      throw new AppError("AI_UNAVAILABLE", "Simulated Gemini service outage (503)");
    }
    if (this.failureMode === "timeout") {
      throw new AppError("AI_UNAVAILABLE", "Simulated AI generation timeout (503)");
    }
    if (this.failureMode === "invalid_response") {
      throw new AppError("AI_INVALID_RESPONSE", "Simulated malformed model response (502)");
    }

    const reply =
      this.customChatResponse ||
      `Based on the scientific context and your question ("${context.currentUserMessage}"), here is a structured analysis: the observed data shows notable correlations.`;

    return {
      content: reply,
      model: "fake-gemini-model",
      metadata: {
        latencyMs: 42,
        tokenUsage: {
          promptTokens: 120,
          candidatesTokens: 45,
          totalTokens: 165,
        },
        finishReason: "STOP",
      },
    };
  }

  async generateStructuredAnalysis(payload: AnalysisPromptPayload): Promise<StructuredAnalysisResult> {
    this.analysisHistory.push(payload);

    if (this.failureMode === "unavailable") {
      throw new AppError("AI_UNAVAILABLE", "Simulated Gemini service outage (503)");
    }
    if (this.failureMode === "timeout") {
      throw new AppError("AI_UNAVAILABLE", "Simulated AI generation timeout (503)");
    }
    if (this.failureMode === "invalid_response") {
      throw new AppError("AI_INVALID_RESPONSE", "Simulated malformed model response (502)");
    }

    const defaultOutput: StructuredAnalysisOutput = this.customAnalysisOutput || {
      summary: "Empirical analysis reveals consistent patterns across the recorded observations.",
      keyFindings: [
        "Observed values correlate strongly with environmental temperature changes.",
        "Feeding activity reached peak frequencies ahead of recorded weather transitions.",
      ],
      hypotheses: [
        {
          statement: "Pre-frontal barometric drops induce accelerated foraging activity in urban bird species.",
          confidence: "medium",
          supportingObservationIds: [],
        },
      ],
      uncertainties: [
        "Sample size is limited to 2 observation events.",
        "Humidity fluctuations were not isolated during measurements.",
      ],
      suggestedQuestions: [
        "Does temperature drop speed correlate with visitor volume?",
      ],
      openQuestions: [
        "Are neighboring feeding stations observing identical trends?",
      ],
      suggestedNextSteps: [
        "Deploy a secondary sensor array to record ambient pressure continuously.",
        "Conduct morning count measurements across 3 distinct temperature bands.",
      ],
    };

    return {
      output: defaultOutput,
      model: "fake-gemini-model",
      promptVersion: payload.promptVersion,
      metadata: {
        latencyMs: 50,
        tokenUsage: {
          promptTokens: 250,
          candidatesTokens: 180,
          totalTokens: 430,
        },
      },
    };
  }

  async generateGroundedAnswer(payload: GroundedAnswerPayload): Promise<GroundedAnswerResult> {
    this.groundedHistory.push(payload);

    if (this.failureMode === "unavailable") {
      throw new AppError("AI_UNAVAILABLE", "Simulated Gemini service outage (503)");
    }
    if (this.failureMode === "timeout") {
      throw new AppError("AI_UNAVAILABLE", "Simulated AI generation timeout (503)");
    }
    if (this.failureMode === "invalid_response") {
      throw new AppError("AI_INVALID_RESPONSE", "Simulated malformed model response (502)");
    }

    if (this.customGroundedOutput) {
      return {
        output: this.customGroundedOutput,
        model: "fake-gemini-model",
        promptVersion: payload.promptVersion,
        metadata: {
          latencyMs: 35,
          tokenUsage: {
            promptTokens: 180,
            candidatesTokens: 60,
            totalTokens: 240,
          },
        },
      };
    }

    // Default grounded output citing observations from context
    const matches = Array.from(payload.contextText.matchAll(/observationId="([^"]+)"/g));
    const citedIds = matches.map((m) => (m as RegExpMatchArray)[1] as string);

    const defaultOutput: GroundedAnswerOutput = {
      answer:
        citedIds.length > 0
          ? `Based on your journal observations (${citedIds.join(", ")}), the data shows consistent findings addressing your question.`
          : "Based on the provided records, no observations directly answer this question.",
      evidence: citedIds.map((id) => ({
        observationId: id,
        note: "Relevant field observation supporting this finding",
      })),
      uncertainties: [
        "Observations reflect personal journal records and have not been externally replicated.",
      ],
    };

    return {
      output: defaultOutput,
      model: "fake-gemini-model",
      promptVersion: payload.promptVersion,
      metadata: {
        latencyMs: 35,
        tokenUsage: {
          promptTokens: 180,
          candidatesTokens: 60,
          totalTokens: 240,
        },
      },
    };
  }
}

export const fakeAiService = new FakeAIService();
