import { IAIService } from "./types";
import { GeminiAdapter } from "./adapters/geminiAdapter";
import { fakeAiService } from "./adapters/fakeAiService";
import { env } from "../config/env";

let activeAiService: IAIService | null = null;

export function getAiService(): IAIService {
  if (activeAiService) {
    return activeAiService;
  }

  // Default to FakeAIService in test mode or GeminiAdapter in production/development
  if (env.NODE_ENV === "test") {
    activeAiService = fakeAiService;
  } else {
    activeAiService = new GeminiAdapter();
  }

  return activeAiService;
}

export function setAiService(service: IAIService | null): void {
  activeAiService = service;
}
