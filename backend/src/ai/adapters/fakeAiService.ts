import {
  IAIService,
  ChatContextPayload,
  ChatGenerationResult,
  AnalysisPromptPayload,
  StructuredAnalysisResult,
} from "../types";
import { StructuredAnalysisOutput } from "../parsers/analysisOutputSchema";
import { AppError } from "../../types/errors";

export class FakeAIService implements IAIService {
  private failureMode: "none" | "unavailable" | "invalid_response" | "timeout" = "none";
  private customChatResponse: string | null = null;
  private customAnalysisOutput: StructuredAnalysisOutput | null = null;
  public chatHistory: ChatContextPayload[] = [];
  public analysisHistory: AnalysisPromptPayload[] = [];

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

  reset() {
    this.failureMode = "none";
    this.customChatResponse = null;
    this.customAnalysisOutput = null;
    this.chatHistory = [];
    this.analysisHistory = [];
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
}

export const fakeAiService = new FakeAIService();
