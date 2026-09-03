import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, USER_B, MOCK_ID_TOKEN_USER_A, MOCK_ID_TOKEN_USER_B } from "../fixtures/userFixtures";

const inMemoryDb = new Map<string, Record<string, unknown>>();

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
          const data = inMemoryDb.get(fullPath);
          return {
            exists: !!data,
            id: fullPath.split("/").pop(),
            data: () => data,
            get: (field: string) => data?.[field],
          };
        },
        set: async (val: Record<string, unknown>) => {
          inMemoryDb.set(fullPath, { ...val, id: fullPath.split("/").pop() });
        },
        update: async (val: Record<string, unknown>) => {
          const current = inMemoryDb.get(fullPath) || {};
          inMemoryDb.set(fullPath, { ...current, ...val });
        },
        delete: async () => {
          inMemoryDb.delete(fullPath);
        },
      });

      return {
        collection: (rootColl: string) => ({
          doc: (uid: string) => ({
            collection: (subColl: string) => ({
              doc: (id?: string) => {
                const docId = id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
                    inMemoryDb.forEach((val, key) => {
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
            }),
          }),
        }),
      };
    },
  };
});

describe("Analyses API (/api/v1/analyses)", () => {
  it("unauthenticated request returns 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/v1/analyses");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("lists analyses for authenticated user", async () => {
    const res = await request(app)
      .get("/api/v1/analyses")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("User B accessing User A's analysis receives 404 NOT_FOUND", async () => {
    // Inject User A analysis
    const aPath = `users/${USER_A.uid}/analyses/anl_alice_1`;
    inMemoryDb.set(aPath, {
      ownerId: USER_A.uid,
      type: "analysis",
      summary: "Alice's analysis",
      keyFindings: [],
      hypotheses: [],
      uncertainties: [],
      suggestedNextSteps: [],
      observationIds: ["obs_alice_1"],
    });

    const getRes = await request(app)
      .get("/api/v1/analyses/anl_alice_1")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe("NOT_FOUND");
  });

  it("GET /api/v1/analyses/:id?includeSources=summary expands sources with found status", async () => {
    const aPath = `users/${USER_A.uid}/analyses/anl_alice_2`;
    inMemoryDb.set(aPath, {
      ownerId: USER_A.uid,
      type: "analysis",
      summary: "Alice's second analysis",
      keyFindings: [],
      hypotheses: [],
      uncertainties: [],
      suggestedNextSteps: [],
      observationIds: ["obs_deleted_999"],
    });

    const res = await request(app)
      .get("/api/v1/analyses/anl_alice_2?includeSources=summary")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sourceSummaries).toBeDefined();
    expect(res.body.data.sourceSummaries[0]?.found).toBe(false);
    expect(res.body.data.sourceSummaries[0]?.observationId).toBe("obs_deleted_999");
  });
});
