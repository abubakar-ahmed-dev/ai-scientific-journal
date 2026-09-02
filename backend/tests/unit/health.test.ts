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
