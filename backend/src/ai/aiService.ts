import { IAIService } from "./types";
import { GeminiAdapter } from "./adapters/geminiAdapter";
import { fakeAiService } from "./adapters/fakeAiService";
import { env } from "../config/env";

let activeAiService: IAIService | null = null;

export function getAiService(): IAIService {
  if (activeAiService) {
    return activeAiService;
  }

  // The fake service is a local-development/test affordance (TESTING.md §13);
  // env validation forbids it in production (NODE_ENV=production + USE_FAKE_AI
  // fails fast in config/env.ts), so this branch is unreachable there.
  if (env.NODE_ENV === "test" || env.USE_FAKE_AI) {
    activeAiService = fakeAiService;
  } else {
    activeAiService = new GeminiAdapter();
  }

  return activeAiService;
}

export function setAiService(service: IAIService | null): void {
  activeAiService = service;
}
