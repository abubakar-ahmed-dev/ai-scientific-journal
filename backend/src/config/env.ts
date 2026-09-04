import { z } from "zod";

// Load backend/.env before validation (development convenience). Real
// environment variables take precedence over file values, and a missing
// file is fine (CI/production inject real env vars instead).
try {
  process.loadEnvFile();
} catch {
  // No .env file present — rely on the actual environment.
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8081),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FIREBASE_PROJECT_ID: z.string().min(1).default(process.env.NODE_ENV === "test" ? "demo-test" : undefined as unknown as string),
  GEMINI_API_KEY: z.string().default(process.env.NODE_ENV === "test" ? "mock-gemini-key" : "test-key"),
  // stringbool (not coerce.boolean) so USE_FAKE_AI=false actually means false.
  USE_FAKE_AI: z.stringbool().default(false),
  // Emulator endpoints are registered so the production refinement can reject
  // them; the Firebase Admin SDK reads them from process.env itself.
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  FIREBASE_STORAGE_EMULATOR_HOST: z.string().optional(),
  AI_MODEL: z.string().default("gemini-3.6-flash"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AI_MAX_CONTEXT_MESSAGES: z.coerce.number().int().positive().default(20),
  AI_SEARCH_MAX_CANDIDATES: z.coerce.number().int().positive().default(500),
  AI_SEARCH_DEFAULT_LIMIT: z.coerce.number().int().positive().default(10),
  AI_RAG_MIN_SCORE: z.coerce.number().default(0.05),
  AI_RAG_MAX_CONTEXT_OBSERVATIONS: z.coerce.number().int().positive().default(5),
  AI_RAG_CONTEXT_CHAR_BUDGET: z.coerce.number().int().positive().default(12000),
  STORAGE_BUCKET: z.string().default("ai-scientific-journal-media"),
  MEDIA_MAX_IMAGE_SIZE_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  MEDIA_MAX_AUDIO_SIZE_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  MEDIA_MAX_VIDEO_SIZE_BYTES: z.coerce.number().int().positive().default(100 * 1024 * 1024),
  MEDIA_SIGNED_URL_TTL_MINUTES: z.coerce.number().int().positive().default(15),
});

// Sentinel values that must never reach production: they exist only so local
// development and tests can boot without real credentials (TESTING.md §13).
const GEMINI_KEY_SENTINELS = new Set(["test-key", "mock-gemini-key"]);

const productionRefinement = (
  data: z.infer<typeof envSchema>,
  ctx: z.RefinementCtx
) => {
  if (data.NODE_ENV !== "production") return;

  if (!data.GEMINI_API_KEY || GEMINI_KEY_SENTINELS.has(data.GEMINI_API_KEY)) {
    ctx.addIssue({
      code: "custom",
      path: ["GEMINI_API_KEY"],
      message:
        "a real Gemini API key is required in production (injected from Secret Manager)",
    });
  }

  if (data.USE_FAKE_AI) {
    ctx.addIssue({
      code: "custom",
      path: ["USE_FAKE_AI"],
      message: "the fake AI service is a local-development affordance and is forbidden in production",
    });
  }

  if (data.CORS_ORIGIN === "http://localhost:5173") {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGIN"],
      message: "the localhost CORS default is forbidden in production",
    });
  }

  const emulatorVars = [
    "FIRESTORE_EMULATOR_HOST",
    "FIREBASE_AUTH_EMULATOR_HOST",
    "FIREBASE_STORAGE_EMULATOR_HOST",
  ] as const;
  for (const key of emulatorVars) {
    if (data[key]) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "emulator endpoints are forbidden in production",
      });
    }
  }
};

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.superRefine(productionRefinement).safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}

// Fail fast at startup — a partially configured application must not start (TA §44).
export const env = loadEnv();
