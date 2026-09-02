import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8081),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  FIREBASE_PROJECT_ID: z.string().min(1).default(process.env.NODE_ENV === "test" ? "demo-test" : undefined as unknown as string),
  GEMINI_API_KEY: z.string().default(process.env.NODE_ENV === "test" ? "mock-gemini-key" : "test-key"),
  AI_MODEL: z.string().default("gemini-2.5-flash"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AI_MAX_CONTEXT_MESSAGES: z.coerce.number().int().positive().default(20),
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
