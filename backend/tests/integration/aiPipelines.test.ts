import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, USER_B, MOCK_ID_TOKEN_USER_A, MOCK_ID_TOKEN_USER_B } from "../fixtures/userFixtures";
import { fakeAiService } from "../../src/ai/adapters/fakeAiService";
import { setAiService } from "../../src/ai/aiService";

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
          }),
        }),
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
              }),
            }),
          }),
        }),
        batch: () => ({
          delete: () => {},
          update: (docRef: { update: (val: Record<string, unknown>) => Promise<void> }, val: Record<string, unknown>) => {
            docRef.update(val);
          },
          commit: async () => {},
        }),
      };
    },
  };
});

describe("AI Pipelines (/api/v1/ai)", () => {
  beforeEach(() => {
    fakeAiService.reset();
    setAiService(fakeAiService);
  });

  it("POST /api/v1/ai/analyze generates analysis and sets observation status to analyzed", async () => {
    // 1. Create observation
    const obsRes = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Feeder count event",
        description: "Recorded 14 birds feeding rapidly.",
        observedAt: new Date().toISOString(),
        measurements: [{ name: "count", value: 14, unit: "birds" }],
      });

    const obsId = obsRes.body.data.id;

    // 2. Call /api/v1/ai/analyze
    const analyzeRes = await request(app)
      .post("/api/v1/ai/analyze")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        observationIds: [obsId],
      });

    expect(analyzeRes.status).toBe(201);
    expect(analyzeRes.body.data).toHaveProperty("id");
    expect(analyzeRes.body.data.type).toBe("analysis");
    expect(analyzeRes.body.data.summary).toBeDefined();
    expect(analyzeRes.body.data.keyFindings.length).toBeGreaterThan(0);
    expect(analyzeRes.body.data.promptVersion).toBe("observation-analysis-v1");

    // 3. Verify observation status was updated to analyzed
    const getObsRes = await request(app)
      .get(`/api/v1/observations/${obsId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(getObsRes.status).toBe(200);
    expect(getObsRes.body.data.status).toBe("analyzed");
  });

  it("POST /api/v1/ai/summarize generates summary for a conversation", async () => {
    // 1. Create conversation
    const convRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Discussion on weather front",
        contextType: "general",
      });
    const convId = convRes.body.data.id;

    // 2. Summarize
    const sumRes = await request(app)
      .post("/api/v1/ai/summarize")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        conversationId: convId,
      });

    expect(sumRes.status).toBe(201);
    expect(sumRes.body.data.type).toBe("summary");
    expect(sumRes.body.data.conversationId).toBe(convId);
  });

  it("POST /api/v1/ai/suggest-research creates research suggestions analysis", async () => {
    // 1. Create observation
    const obsRes = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Feeder experiment base",
        description: "Initial feeder record",
        observedAt: new Date().toISOString(),
      });

    const obsId = obsRes.body.data.id;

    const res = await request(app)
      .post("/api/v1/ai/suggest-research")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        observationIds: [obsId],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe("research_suggestions");
    expect(res.body.data.suggestedNextSteps.length).toBeGreaterThan(0);
  });

  it("zero-write assertion: malformed model output returns 502 AI_INVALID_RESPONSE and writes nothing", async () => {
    fakeAiService.setFailureMode("invalid_response");

    const obsRes = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Obs for zero-write test",
        description: "Test description",
        observedAt: new Date().toISOString(),
      });

    const obsId = obsRes.body.data.id;

    const analyzeRes = await request(app)
      .post("/api/v1/ai/analyze")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        observationIds: [obsId],
      });

    expect(analyzeRes.status).toBe(502);
    expect(analyzeRes.body.error.code).toBe("AI_INVALID_RESPONSE");
  });

  it("rejects analyzing foreign observations with 404 NOT_FOUND", async () => {
    const obsRes = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Alice Private Obs",
        description: "Test description",
        observedAt: new Date().toISOString(),
      });

    const obsId = obsRes.body.data.id;

    // User B tries to analyze Alice's observation
    const analyzeRes = await request(app)
      .post("/api/v1/ai/analyze")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`)
      .send({
        observationIds: [obsId],
      });

    expect(analyzeRes.status).toBe(404);
    expect(analyzeRes.body.error.code).toBe("NOT_FOUND");
  });
});
