import { describe, it, expect } from "vitest";
import { loadEnv } from "../../src/config/env";

describe("loadEnv", () => {
  it("applies development defaults", () => {
    expect(loadEnv({})).toMatchObject({ NODE_ENV: "development", PORT: 8080 });
  });

  it("fails fast on an invalid PORT (TA §44)", () => {
    expect(() => loadEnv({ PORT: "not-a-number" })).toThrow(
      /Invalid environment configuration/
    );
  });
});
