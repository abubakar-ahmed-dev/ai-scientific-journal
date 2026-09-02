import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, USER_B, MOCK_ID_TOKEN_USER_A, MOCK_ID_TOKEN_USER_B } from "../fixtures/userFixtures";

const inMemoryStore = new Map<string, Record<string, unknown>>();

vi.mock("../../src/lib/firebaseAdmin", () => {
  return {
    getFirebaseAuth: () => ({
      verifyIdToken: async (token: string) => {
        if (token === MOCK_ID_TOKEN_USER_A) {
          return { uid: USER_A.uid, email: USER_A.email, name: USER_A.displayName };
        }
        if (token === MOCK_ID_TOKEN_USER_B) {
          return { uid: USER_B.uid, email: USER_B.email, name: USER_B.displayName };
        }
        throw new Error("Invalid token");
      },
    }),
    getFirebaseFirestore: () => {
      const getDocHandler = (fullPath: string) => ({
        get: async () => {
          const data = inMemoryStore.get(fullPath);
          return {
            exists: !!data,
            id: fullPath.split("/").pop(),
            data: () => data,
            get: (field: string) => data?.[field],
          };
        },
        set: async (val: Record<string, unknown>) => {
          inMemoryStore.set(fullPath, { ...val, id: fullPath.split("/").pop() });
        },
        update: async (val: Record<string, unknown>) => {
          const current = inMemoryStore.get(fullPath) || {};
          inMemoryStore.set(fullPath, { ...current, ...val });
        },
        delete: async () => {
          inMemoryStore.delete(fullPath);
        },
        collection: (nestedColl: string) => ({
          doc: (nestedId?: string) => {
            const nid = nestedId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const nPath = `${fullPath}/${nestedColl}/${nid}`;
            return {
              id: nid,
              ...getDocHandler(nPath),
            };
          },
          orderBy: () => ({
            limit: (lim: number) => ({
              get: async () => {
                const prefix = `${fullPath}/${nestedColl}/`;
                const docs: Array<{ id?: string; data: () => Record<string, unknown>; get: (f: string) => unknown }> = [];
                inMemoryStore.forEach((val, key) => {
                  if (key.startsWith(prefix)) {
                    docs.push({
                      id: key.split("/").pop(),
                      data: () => val,
                      get: (f: string) => val[f],
                    });
                  }
                });
                return { docs: docs.slice(0, lim) };
              },
            }),
          }),
          get: async () => {
            const prefix = `${fullPath}/${nestedColl}/`;
            const docs: Array<{ ref: { delete: () => Promise<void> }; data: () => Record<string, unknown> }> = [];
            inMemoryStore.forEach((val, key) => {
              if (key.startsWith(prefix)) {
                docs.push({
                  ref: { delete: async () => { inMemoryStore.delete(key); } },
                  data: () => val,
                });
              }
            });
            return { empty: docs.length === 0, docs };
          },
        }),
      });

      return {
        collection: (rootColl: string) => ({
          doc: (uid: string) => ({
            collection: (subColl: string) => ({
              doc: (id?: string) => {
                const docId = id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                const fullPath = `${rootColl}/${uid}/${subColl}/${docId}`;
                return {
                  id: docId,
                  ...getDocHandler(fullPath),
                };
              },
              orderBy: () => ({
                limit: (lim: number) => ({
                  get: async () => {
                    const prefix = `${rootColl}/${uid}/${subColl}/`;
                    const docs: Array<{ id?: string; data: () => Record<string, unknown>; get: (f: string) => unknown }> = [];
                    inMemoryStore.forEach((val, key) => {
                      if (key.startsWith(prefix)) {
                        docs.push({
                          id: key.split("/").pop(),
                          data: () => val,
                          get: (f: string) => val[f],
                        });
                      }
                    });
                    return { docs: docs.slice(0, lim) };
                  },
                }),
                where: () => ({
                  limit: () => ({
                    get: async () => ({ docs: [] }),
                  }),
                }),
              }),
              where: () => ({
                get: async () => ({ empty: true, docs: [] }),
              }),
            }),
          }),
        }),
        batch: () => ({
          delete: () => {},
          commit: async () => {},
        }),
      };
    },
  };
});

describe("Conversations API (/api/v1/conversations)", () => {
  it("unauthenticated request returns 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/v1/conversations");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates a general conversation and returns 201", async () => {
    const res = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Brainstorming Session",
        contextType: "general",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.contextType).toBe("general");
    expect(res.body.data.contextId).toBeNull();
    expect(res.body.data.messageCount).toBe(0);
    expect(res.body.data.status).toBe("active");
  });

  it("rejects non-general conversation without contextId (400 VALIDATION_ERROR)", async () => {
    const res = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Invalid Observation Chat",
        contextType: "observation",
        // missing contextId
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists conversations for authenticated user", async () => {
    const res = await request(app)
      .get("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("User B accessing User A's conversation receives 404 NOT_FOUND (existence hiding)", async () => {
    const createRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Alice Confidential Research Chat",
        contextType: "general",
      });

    const convId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe("NOT_FOUND");
  });
});
