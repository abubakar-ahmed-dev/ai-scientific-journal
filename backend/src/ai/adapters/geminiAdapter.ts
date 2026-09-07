import { env } from "../../config/env";
import {
  IAIService,
  ChatContextPayload,
  ChatGenerationResult,
  AnalysisPromptPayload,
  StructuredAnalysisResult,
  GroundedAnswerPayload,
  GroundedAnswerResult,
} from "../types";
import { StructuredAnalysisOutputSchema } from "../parsers/analysisOutputSchema";
import { GroundedAnswerOutputSchema } from "../../schemas/askSchema";
import { escapeContextText } from "../prompts/contextSanitizer";
import { AppError } from "../../types/errors";

export class GeminiAdapter implements IAIService {
  private apiKey: string;
  private model: string;
  private timeoutMs: number;

  constructor(
    apiKey: string = env.GEMINI_API_KEY,
    model: string = env.AI_MODEL,
    timeoutMs: number = env.AI_TIMEOUT_MS
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.timeoutMs = timeoutMs;
  }

  async generateChatReply(context: ChatContextPayload): Promise<ChatGenerationResult> {
    const startTime = Date.now();

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (context.contextualData) {
      const data = context.contextualData;
      const contextLines: string[] = [
        `<context_data type="${data.type}" id="${data.id || ""}">`,
      ];
      if (data.title) contextLines.push(`Title: ${escapeContextText(data.title)}`);
      if (data.field) contextLines.push(`Discipline/Field: ${escapeContextText(data.field)}`);
      if (data.description) contextLines.push(`Description: ${escapeContextText(data.description)}`);
      if (data.hypothesis) contextLines.push(`Hypothesis: ${escapeContextText(data.hypothesis)}`);
      if (data.notes) contextLines.push(`Notes: ${escapeContextText(data.notes)}`);
      if (data.tags && data.tags.length > 0) contextLines.push(`Tags: ${escapeContextText(data.tags.join(", "))}`);
      if (data.measurements && data.measurements.length > 0) {
        contextLines.push(
          `Measurements: ${escapeContextText(
            data.measurements
              .map((m) => `${m.name}=${m.value} ${m.unit}${m.notes ? ` (${m.notes})` : ""}`)
              .join("; ")
          )}`
        );
      }
      contextLines.push("</context_data>");

      contents.push({
        role: "user",
        parts: [{ text: `[Attached Context for this conversation]\n${contextLines.join("\n")}` }],
      });
      contents.push({
        role: "model",
        parts: [{ text: "Understood. I will use this scientific context as background information for our discussion." }],
      });
    }

    for (const msg of context.conversationHistory) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: context.currentUserMessage }],
    });

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey: this.apiKey });

      const apiCall = client.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: context.systemInstruction,
          // Cancel the underlying request at the deadline; the race below is
          // the belt-and-suspenders so the caller never waits past timeoutMs.
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });

      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("AI_TIMEOUT"));
        }, this.timeoutMs);
      });

      let response;
      try {
        response = await Promise.race([apiCall, timeoutPromise]);
      } finally {
        clearTimeout(timer!);
      }

      const candidate = response.candidates?.[0];
      const text = response.text || candidate?.content?.parts?.[0]?.text;

      if (!text || text.trim().length === 0) {
        throw new AppError("AI_INVALID_RESPONSE", "Received empty response from AI model");
      }

      const latencyMs = Date.now() - startTime;

      return {
        content: text.trim(),
        model: this.model,
        metadata: {
          latencyMs,
          tokenUsage: {
            promptTokens: response.usageMetadata?.promptTokenCount,
            candidatesTokens: response.usageMetadata?.candidatesTokenCount,
            totalTokens: response.usageMetadata?.totalTokenCount,
          },
          finishReason: candidate?.finishReason || "STOP",
        },
      };
    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  async generateStructuredAnalysis(payload: AnalysisPromptPayload): Promise<StructuredAnalysisResult> {
    const startTime = Date.now();

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `${payload.taskInstruction}\n\n[Scientific Context Data to Analyze]\n${payload.contextText}`,
          },
        ],
      },
    ];

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey: this.apiKey });

      const apiCall = client.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: payload.systemInstruction,
          responseMimeType: "application/json",
          // Cancel the underlying request at the deadline; the race below is
          // the belt-and-suspenders so the caller never waits past timeoutMs.
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });

      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("AI_TIMEOUT"));
        }, this.timeoutMs);
      });

      let response;
      try {
        response = await Promise.race([apiCall, timeoutPromise]);
      } finally {
        clearTimeout(timer!);
      }

      const candidate = response.candidates?.[0];
      const text = response.text || candidate?.content?.parts?.[0]?.text;

      if (!text || text.trim().length === 0) {
        throw new AppError("AI_INVALID_RESPONSE", "Received empty response from AI model");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new AppError("AI_INVALID_RESPONSE", "Model response was not valid JSON");
      }

      const validation = StructuredAnalysisOutputSchema.safeParse(parsedJson);
      if (!validation.success) {
        const issues = validation.error.issues
          .map((i) => `${i.path.join(".") || "output"}: ${i.message}`)
          .join("; ");
        throw new AppError("AI_INVALID_RESPONSE", `Structured analysis schema validation failed: ${issues}`);
      }

      const latencyMs = Date.now() - startTime;

      return {
        output: validation.data,
        model: this.model,
        promptVersion: payload.promptVersion,
        metadata: {
          latencyMs,
          tokenUsage: {
            promptTokens: response.usageMetadata?.promptTokenCount,
            candidatesTokens: response.usageMetadata?.candidatesTokenCount,
            totalTokens: response.usageMetadata?.totalTokenCount,
          },
        },
      };
    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  async generateGroundedAnswer(payload: GroundedAnswerPayload): Promise<GroundedAnswerResult> {
    const startTime = Date.now();

    const contents = [
      {
        role: "user",
        parts: [
          {
            text: `[Retrieved Observation Context Data]\n${payload.contextText}\n\n[User Question]\n${payload.question}`,
          },
        ],
      },
    ];

    try {
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey: this.apiKey });

      const apiCall = client.models.generateContent({
        model: this.model,
        contents,
        config: {
          systemInstruction: payload.systemInstruction,
          responseMimeType: "application/json",
          // Cancel the underlying request at the deadline; the race below is
          // the belt-and-suspenders so the caller never waits past timeoutMs.
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });

      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error("AI_TIMEOUT"));
        }, this.timeoutMs);
      });

      let response;
      try {
        response = await Promise.race([apiCall, timeoutPromise]);
      } finally {
        clearTimeout(timer!);
      }

      const candidate = response.candidates?.[0];
      const text = response.text || candidate?.content?.parts?.[0]?.text;

      if (!text || text.trim().length === 0) {
        throw new AppError("AI_INVALID_RESPONSE", "Received empty response from AI model");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new AppError("AI_INVALID_RESPONSE", "Model response was not valid JSON");
      }

      const validation = GroundedAnswerOutputSchema.safeParse(parsedJson);
      if (!validation.success) {
        const issues = validation.error.issues
          .map((i) => `${i.path.join(".") || "output"}: ${i.message}`)
          .join("; ");
        throw new AppError("AI_INVALID_RESPONSE", `Grounded answer schema validation failed: ${issues}`);
      }

      const latencyMs = Date.now() - startTime;

      return {
        output: validation.data,
        model: this.model,
        promptVersion: payload.promptVersion,
        metadata: {
          latencyMs,
          tokenUsage: {
            promptTokens: response.usageMetadata?.promptTokenCount,
            candidatesTokens: response.usageMetadata?.candidatesTokenCount,
            totalTokens: response.usageMetadata?.totalTokenCount,
          },
        },
      };
    } catch (err: unknown) {
      this.handleError(err);
    }
  }

  private handleError(err: unknown): never {
    if (err instanceof AppError) {
      throw err;
    }

    const errMsg = err instanceof Error ? err.message : String(err);

    if (
      errMsg === "AI_TIMEOUT" ||
      errMsg.includes("timeout") ||
      errMsg.includes("deadline") ||
      // AbortSignal.timeout aborts with a TimeoutError/AbortError
      errMsg.includes("abort")
    ) {
      throw new AppError("AI_UNAVAILABLE", "AI model generation timed out. Please retry.");
    }

    if (
      errMsg.includes("503") ||
      errMsg.includes("UNAVAILABLE") ||
      errMsg.includes("RESOURCE_EXHAUSTED") ||
      errMsg.includes("Overloaded") ||
      errMsg.includes("fetch failed")
    ) {
      throw new AppError("AI_UNAVAILABLE", `Gemini service is temporarily unavailable: ${errMsg}`);
    }

    if (errMsg.includes("SAFETY") || errMsg.includes("blocked")) {
      throw new AppError("AI_INVALID_RESPONSE", "Response was blocked by content safety filters.");
    }

    throw new AppError("AI_UNAVAILABLE", `AI generation error: ${errMsg}`);
  }
}
