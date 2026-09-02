import { describe, it, expect, beforeEach } from "vitest";
import { fakeAiService } from "../../src/ai/adapters/fakeAiService";
import { CHAT_SYSTEM_INSTRUCTION } from "../../src/ai/prompts/systemPrompt";
import { ChatContextPayload } from "../../src/ai/types";

describe("AI Service and Adapters", () => {
  beforeEach(() => {
    fakeAiService.reset();
  });

  it("generates structured chat reply in normal operation", async () => {
    const payload: ChatContextPayload = {
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      conversationHistory: [
        { role: "user", content: "What is the relationship between temperature and feeding?" },
      ],
      contextualData: {
        type: "observation",
        title: "Feeder count",
        measurements: [{ name: "temp", value: 12, unit: "C" }],
      },
      currentUserMessage: "Can you analyze this?",
    };

    const res = await fakeAiService.generateChatReply(payload);
    expect(res).toHaveProperty("content");
    expect(res).toHaveProperty("model");
    expect(res.metadata).toHaveProperty("latencyMs");
    expect(res.metadata).toHaveProperty("tokenUsage");
    expect(fakeAiService.invocationHistory.length).toBe(1);
  });

  it("maps simulated upstream outage to 503 AI_UNAVAILABLE", async () => {
    fakeAiService.setFailureMode("unavailable");

    const payload: ChatContextPayload = {
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      conversationHistory: [],
      currentUserMessage: "Hello",
    };

    await expect(fakeAiService.generateChatReply(payload)).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
      status: 503,
    });
  });

  it("maps simulated timeout to 503 AI_UNAVAILABLE", async () => {
    fakeAiService.setFailureMode("timeout");

    const payload: ChatContextPayload = {
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      conversationHistory: [],
      currentUserMessage: "Hello",
    };

    await expect(fakeAiService.generateChatReply(payload)).rejects.toMatchObject({
      code: "AI_UNAVAILABLE",
      status: 503,
    });
  });

  it("maps simulated safety block/empty output to 502 AI_INVALID_RESPONSE", async () => {
    fakeAiService.setFailureMode("invalid_response");

    const payload: ChatContextPayload = {
      systemInstruction: CHAT_SYSTEM_INSTRUCTION,
      conversationHistory: [],
      currentUserMessage: "Hello",
    };

    await expect(fakeAiService.generateChatReply(payload)).rejects.toMatchObject({
      code: "AI_INVALID_RESPONSE",
      status: 502,
    });
  });
});
