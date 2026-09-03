import { describe, it, expect } from "vitest";
import { loadEnv } from "../../src/config/env";

describe("loadEnv", () => {
  it("applies development defaults", () => {
    expect(loadEnv({})).toMatchObject({
      NODE_ENV: "development",
      PORT: 8081,
      AI_MODEL: "gemini-3.6-flash",
      AI_SEARCH_MAX_CANDIDATES: 500,
      AI_SEARCH_DEFAULT_LIMIT: 10,
      AI_RAG_MIN_SCORE: 0.05,
      AI_RAG_MAX_CONTEXT_OBSERVATIONS: 5,
      AI_RAG_CONTEXT_CHAR_BUDGET: 12000,
      STORAGE_BUCKET: "ai-scientific-journal-media",
      MEDIA_MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024,
      MEDIA_MAX_AUDIO_SIZE_BYTES: 25 * 1024 * 1024,
      MEDIA_MAX_VIDEO_SIZE_BYTES: 100 * 1024 * 1024,
      MEDIA_SIGNED_URL_TTL_MINUTES: 15,
    });
  });

  it("fails fast on an invalid PORT (TA §44)", () => {
    expect(() => loadEnv({ PORT: "not-a-number" })).toThrow(
      /Invalid environment configuration/
    );
  });
});
