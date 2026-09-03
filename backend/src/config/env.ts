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
  AI_MODEL: z.string().default("gemini-3.6-flash"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AI_MAX_CONTEXT_MESSAGES: z.coerce.number().int().positive().default(20),
  AI_SEARCH_MAX_CANDIDATES: z.coerce.number().int().positive().default(500),
  AI_SEARCH_DEFAULT_LIMIT: z.coerce.number().int().positive().default(10),
  AI_RAG_MIN_SCORE: z.coerce.number().default(0.05),
  AI_RAG_MAX_CONTEXT_OBSERVATIONS: z.coerce.number().int().positive().default(5),
  AI_RAG_CONTEXT_CHAR_BUDGET: z.coerce.number().int().positive().default(12000),
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(source);
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
