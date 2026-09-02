import { IAIService, ChatContextPayload, ChatGenerationResult } from "../types";
import { AppError } from "../../types/errors";

export class FakeAIService implements IAIService {
  private failureMode: "none" | "unavailable" | "invalid_response" | "timeout" = "none";
  private customResponse: string | null = null;
  public invocationHistory: ChatContextPayload[] = [];

  setFailureMode(mode: "none" | "unavailable" | "invalid_response" | "timeout") {
    this.failureMode = mode;
  }

  setCustomResponse(response: string | null) {
    this.customResponse = response;
  }

  reset() {
    this.failureMode = "none";
    this.customResponse = null;
    this.invocationHistory = [];
  }

  async generateChatReply(context: ChatContextPayload): Promise<ChatGenerationResult> {
    this.invocationHistory.push(context);

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
      this.customResponse ||
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
}

export const fakeAiService = new FakeAIService();
