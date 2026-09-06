import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";

describe("GET /api/health", () => {
  it("returns 200 {status: ok} with no auth and no detail", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("unknown routes", () => {
  it("returns the canonical error envelope with a requestId", async () => {
    const res = await request(createApp()).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toBeDefined();
  });
});

describe("request correlation", () => {
  it("honors a client X-Request-Id (API.md §1.3)", async () => {
    const res = await request(createApp())
      .get("/api/health")
      .set("X-Request-Id", "req_test_123");
    expect(res.headers["x-request-id"]).toBe("req_test_123");
  });
});

describe("malformed request handling (SECURITY §31 API matrix)", () => {
  it("malformed JSON body returns 400 VALIDATION_ERROR without parser internals", async () => {
    const res = await request(createApp())
      .post("/api/v1/research-tasks")
      .set("Authorization", "Bearer anything") // auth mock not installed here; parse failure fires first
      .set("Content-Type", "application/json")
      .send("{ not valid json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.requestId).toBeDefined();
    expect(JSON.stringify(res.body)).not.toContain("at position");
    expect(JSON.stringify(res.body)).not.toContain("Unexpected token");
  });
});
