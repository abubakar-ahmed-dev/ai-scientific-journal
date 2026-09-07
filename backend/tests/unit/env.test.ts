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
      AI_RAG_MIN_SCORE: 0.1,
      AI_RAG_WEAK_EVIDENCE_SCORE: 0.15,
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

  it("parses USE_FAKE_AI=false as false (stringbool, not coerce.boolean)", () => {
    expect(loadEnv({ USE_FAKE_AI: "false" }).USE_FAKE_AI).toBe(false);
    expect(loadEnv({ USE_FAKE_AI: "true" }).USE_FAKE_AI).toBe(true);
    expect(loadEnv({}).USE_FAKE_AI).toBe(false);
  });

  describe("production refinements (phase-4 F5 residual / plan §A2)", () => {
    const productionConfig = {
      NODE_ENV: "production",
      GEMINI_API_KEY: "real-key-from-secret-manager",
      CORS_ORIGIN: "https://ai-scientific-journal.example.run.app",
    };

    it("accepts a fully valid production configuration", () => {
      const env = loadEnv(productionConfig);
      expect(env.NODE_ENV).toBe("production");
      expect(env.USE_FAKE_AI).toBe(false);
    });

    it("fails fast on a missing Gemini key in production", () => {
      expect(() => loadEnv({ NODE_ENV: "production" })).toThrow(
        /GEMINI_API_KEY.*real Gemini API key is required/
      );
    });

    it.each(["test-key", "mock-gemini-key"])(
      "fails fast on the sentinel key '%s' in production",
      (sentinel) => {
        expect(() => loadEnv({ ...productionConfig, GEMINI_API_KEY: sentinel })).toThrow(
          /GEMINI_API_KEY.*real Gemini API key is required/
        );
      }
    );

    it("fails fast on USE_FAKE_AI=true in production", () => {
      expect(() =>
        loadEnv({ ...productionConfig, USE_FAKE_AI: "true" })
      ).toThrow(/USE_FAKE_AI.*forbidden in production/);
    });

    it("fails fast on the localhost CORS default in production", () => {
      expect(() =>
        loadEnv({ NODE_ENV: "production", GEMINI_API_KEY: "real-key" })
      ).toThrow(/CORS_ORIGIN.*forbidden in production/);
    });

    it.each([
      "FIRESTORE_EMULATOR_HOST",
      "FIREBASE_AUTH_EMULATOR_HOST",
      "FIREBASE_STORAGE_EMULATOR_HOST",
    ])("fails fast on %s set in production", (emulatorVar) => {
      expect(() =>
        loadEnv({ ...productionConfig, [emulatorVar]: "localhost:8082" })
      ).toThrow(new RegExp(`${emulatorVar}.*forbidden in production`));
    });
  });
});
