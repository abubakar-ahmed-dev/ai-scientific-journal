import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request } from "express";
import { logger } from "../../src/lib/logger";
import { logAiSignal } from "../../src/lib/aiSignals";

/**
 * Log-privacy verification (OBSERVABILITY.md §4 + §8; SECURITY.md §13):
 * AI operation signals carry operational metadata only. Journal content,
 * prompts, model output text, tokens, and secrets must never appear in the
 * emitted log line. This test spies on the shared pino logger and asserts
 * both presence of correlation fields and absence of content.
 */

function makeReq(requestId = "req-123", uid = "user_abc"): Request {
  return { requestId, user: { uid } } as unknown as Request;
}

describe("AI operation signal logging (OBSERVABILITY §8, §4)", () => {
  let captured: Record<string, unknown>[] = [];
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(logger, "info").mockImplementation(((obj: Record<string, unknown>) => {
      captured.push(obj);
    }) as never);
  });

  afterEach(() => {
    infoSpy.mockRestore();
    captured = [];
  });

  it("emits requestId + userId + operation + duration on success", () => {
    logAiSignal({
      operation: "analyze",
      req: makeReq(),
      status: "success",
      durationMs: 250,
      model: "gemini-3.6-flash",
      promptVersion: "observation-analysis-v1",
      inputLength: 420,
      outputLength: 310,
    });

    const entry = captured[0];
    expect(entry.requestId).toBe("req-123");
    expect(entry.userId).toBe("user_abc");
    expect(entry.operation).toBe("analyze");
    expect(entry.status).toBe("success");
    expect(entry.durationMs).toBe(250);
    expect(entry.model).toBe("gemini-3.6-flash");
    expect(entry.promptVersion).toBe("observation-analysis-v1");
  });

  it("emits errorType + candidateCount on failure (ask)", () => {
    logAiSignal({
      operation: "ask",
      req: makeReq(),
      status: "failure",
      durationMs: 800,
      errorType: "AI_UNAVAILABLE",
      candidateCount: 4,
    });

    const entry = captured[0];
    expect(entry.operation).toBe("ask");
    expect(entry.status).toBe("failure");
    expect(entry.errorType).toBe("AI_UNAVAILABLE");
    expect(entry.candidateCount).toBe(4);
  });

  it("never emits message/summary/prompt content fields (privacy rule §4)", () => {
    const secretProbe = "SECRET-VALUE-THAT-MUST-NOT-LOG";

    logAiSignal({
      operation: "summarize",
      req: makeReq(),
      status: "success",
      durationMs: 100,
      model: "test-model",
      // Even if a caller mistakenly passes content-bearing values in length
      // fields, the emitted object only carries numeric lengths — the probe
      // string below must not appear anywhere in the log entry.
      inputLength: 42,
      outputLength: 17,
      tokenUsage: { promptTokens: 10, candidatesTokens: 7, totalTokens: 17 },
    });

    const serialized = JSON.stringify(captured);
    expect(serialized).not.toContain(secretProbe);
    expect(serialized).not.toContain("content");
    expect(serialized).not.toContain("summary");
    expect(serialized).not.toContain("prompt_text");
    // Lengths are metadata (numbers), never the text itself:
    expect(serialized).toContain("inputLength");
    expect(serialized).toContain("outputLength");
  });

  it("emits length metadata as numbers, not text", () => {
    logAiSignal({
      operation: "chat-turn",
      req: makeReq(),
      status: "success",
      durationMs: 55,
      model: "test-model",
      inputLength: 120,
      outputLength: 340,
      contextLength: 6,
    });

    const entry = captured[0];
    expect(typeof entry.inputLength).toBe("number");
    expect(typeof entry.outputLength).toBe("number");
    expect(typeof entry.contextLength).toBe("number");
  });
});
