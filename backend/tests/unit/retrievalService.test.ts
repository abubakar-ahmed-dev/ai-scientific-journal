import { describe, it, expect } from "vitest";
import { tokenize, scoreLexical, buildSnippet } from "../../src/ai/retrieval/retrievalService";

describe("RetrievalService pure functions", () => {
  describe("tokenize", () => {
    it("lowercases and splits text into tokens", () => {
      const tokens = tokenize("Spotted a Red-Tailed Hawk near the ridge!");
      expect(tokens).toContain("red");
      expect(tokens).toContain("tailed");
      expect(tokens).toContain("hawk");
      expect(tokens).toContain("ridge");
      // Stop words like 'a', 'the' should be excluded
      expect(tokens).not.toContain("a");
      expect(tokens).not.toContain("the");
    });

    it("normalizes unicode accents and removes diacritics", () => {
      const tokens = tokenize("Café résumé señor");
      expect(tokens).toContain("cafe");
      expect(tokens).toContain("resume");
      expect(tokens).toContain("senor");
    });

    it("falls back to raw tokens >= 2 chars if all tokens are stop words", () => {
      const tokens = tokenize("who is it");
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toContain("who");
    });

    it("returns an empty array for empty or whitespace string", () => {
      expect(tokenize("")).toEqual([]);
      expect(tokenize("   ")).toEqual([]);
      expect(tokenize("!@#$%")).toEqual([]);
    });
  });

  describe("scoreLexical", () => {
    it("returns 0 for empty query or empty text", () => {
      expect(scoreLexical([], "Some text")).toBe(0);
      expect(scoreLexical(["hawk"], "")).toBe(0);
    });

    it("scores higher when query tokens match in the title prefix", () => {
      const query = ["hawk"];
      const titleMatch = "Hawk observation today. Found in the valley with lots of trees and wind.";
      const bodyMatch = "Today was windy in the valley with lots of trees and wind. After walking five miles we spotted a hawk in the distance.";

      const scoreTitle = scoreLexical(query, titleMatch);
      const scoreBody = scoreLexical(query, bodyMatch);

      expect(scoreTitle).toBeGreaterThan(scoreBody);
    });

    it("scores higher when multiple query tokens match", () => {
      const query = ["red", "tailed", "hawk"];
      const partialMatch = "Found a red fox near the trail.";
      const fullMatch = "Red tailed hawk soaring above the canyon.";

      const scorePartial = scoreLexical(query, partialMatch);
      const scoreFull = scoreLexical(query, fullMatch);

      expect(scoreFull).toBeGreaterThan(scorePartial);
    });

    it("returns a normalized score bounded between 0 and 1", () => {
      const query = ["hawk", "nest"];
      const text = "Hawk hawk hawk nest nest nest in the pine tree.";
      const score = scoreLexical(query, text);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1.0);
    });
  });

  describe("buildSnippet", () => {
    it("returns full text when shorter than max length", () => {
      const text = "Short observation summary.";
      const snippet = buildSnippet(text, ["observation"], 200);
      expect(snippet).toBe(text);
    });

    it("centers the window around the matched query token", () => {
      const prefix = "A".repeat(150);
      const suffix = "B".repeat(150);
      const text = `${prefix} TARGET_WORD ${suffix}`;
      const snippet = buildSnippet(text, ["TARGET_WORD"], 100);

      expect(snippet).toContain("TARGET_WORD");
      expect(snippet.startsWith("...")).toBe(true);
      expect(snippet.endsWith("...")).toBe(true);
    });

    it("falls back to the start of text when no tokens match", () => {
      const text = "C".repeat(300);
      const snippet = buildSnippet(text, ["nonexistent"], 50);
      expect(snippet.length).toBeLessThanOrEqual(55);
      expect(snippet.endsWith("...")).toBe(true);
    });
  });
});
