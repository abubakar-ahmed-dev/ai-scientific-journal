import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, MOCK_ID_TOKEN_USER_A } from "../fixtures/userFixtures";

// Mock firebaseAdmin verifyIdToken for hermetic API testing
vi.mock("../../src/lib/firebaseAdmin", () => {
  return {
    getFirebaseAuth: () => ({
      verifyIdToken: async (token: string) => {
        if (token === MOCK_ID_TOKEN_USER_A) {
          return {
            uid: USER_A.uid,
            email: USER_A.email,
            name: USER_A.displayName,
          };
        }
        throw new Error("Invalid token");
      },
    }),
    getFirebaseFirestore: () => {
      const mockUserDoc = {
        ownerId: USER_A.uid,
        displayName: USER_A.displayName,
        email: USER_A.email,
        photoURL: null,
        role: "user",
        accountStatus: "active",
        preferences: {
          theme: "system",
          timezone: "UTC",
          locationEnabled: true,
          aiSuggestionsEnabled: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      return {
        collection: (collName: string) => {
          if (collName === "users") {
            return {
              doc: () => ({
                get: async () => ({
                  exists: true,
                  data: () => mockUserDoc,
                }),
                set: async () => {},
                update: async () => {},
              }),
            };
          }
          return {};
        },
      };
    },
  };
});

describe("API Security & Authorization Middleware", () => {
  it("GET /api/v1/me without token returns 401 UNAUTHENTICATED envelope", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(res.body.error.requestId).toBeDefined();
  });

  it("GET /api/v1/me with invalid Bearer token returns 401 UNAUTHENTICATED envelope", async () => {
    const res = await request(app)
      .get("/api/v1/me")
      .set("Authorization", "Bearer invalid-token-123");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("GET /api/v1/me with valid Bearer token returns 200 and user profile data", async () => {
    const res = await request(app)
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data.ownerId).toBe(USER_A.uid);
    expect(res.body.data.email).toBe(USER_A.email);
    expect(res.body.data.role).toBe("user");
  });

  it("PATCH /api/v1/me with valid partial update returns 200 and updated user data", async () => {
    const res = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        displayName: "Updated Alice Name",
        preferences: {
          theme: "dark",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it("PATCH /api/v1/me attempting to modify immutable fields returns 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        role: "admin",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("PATCH /api/v1/me with unknown properties returns 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        unknownField: "malicious-input",
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
