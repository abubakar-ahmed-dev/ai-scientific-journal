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

      const idempotencyLookup = (
        rootColl: string,
        uid: string,
        subColl: string,
        lim: number
      ): Promise<{ docs: Array<{ id?: string; data: () => Record<string, unknown>; get: (f: string) => unknown }> }> => {
        // findByIdempotencyKey: users/{uid}/researchTasks where ownerId==uid
        // AND idempotencyKey==key — filter the in-memory store for tasks
        // carrying a key (the mock does not model field comparators).
        const prefix = `${rootColl}/${uid}/${subColl}/`;
        const docs: Array<{ id?: string; data: () => Record<string, unknown>; get: (f: string) => unknown }> = [];
        inMemoryDb.forEach((val, key) => {
          if (key.startsWith(prefix) && val.idempotencyKey) {
            docs.push({
              id: key.split("/").pop(),
              data: () => val,
              get: (f: string) => val[f],
            });
          }
        });
        return Promise.resolve({ docs: docs.slice(0, lim) });
      };

      const whereChain = (rootColl: string, uid: string, subColl: string): Record<string, unknown> => ({
        where: () => whereChain(rootColl, uid, subColl),
        limit: (lim: number) => ({
          get: async () => {
            const result = await idempotencyLookup(rootColl, uid, subColl, lim);
            return { ...result, empty: result.docs.length === 0 };
          },
        }),
      });

      return {
        collection: (rootColl: string) => ({
          doc: (uid: string) => ({
            collection: (subColl: string) => ({
              where: () => whereChain(rootColl, uid, subColl),
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
      };
    },
  };
});

describe("Research Tasks API (/api/v1/research-tasks)", () => {
  it("unauthenticated request returns 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/v1/research-tasks");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates a user-authored research task with status planned", async () => {
    const res = await request(app)
      .post("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        source: "user",
        title: "Measure soil pH after rainfall",
        description: "Test if soil acidity fluctuates significantly following heavy rain events.",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.source).toBe("user");
    expect(res.body.data.status).toBe("planned");
    expect(res.body.data.title).toBe("Measure soil pH after rainfall");
  });

  it("accepts an AI suggestion into a research task with status suggested", async () => {
    // 1. Seed analysis in memory store
    const aPath = `users/${USER_A.uid}/analyses/anl_test_1`;
    inMemoryDb.set(aPath, {
      id: "anl_test_1",
      ownerId: USER_A.uid,
      type: "research_suggestions",
      summary: "Suggestions for urban feeder studies",
      suggestedNextSteps: [
        "Deploy second feeder 50 meters north",
        "Record temperature and visitor counts at 3 distinct hours",
      ],
      observationIds: ["obs_1"],
    });

    // 2. Accept suggestion 0
    const res = await request(app)
      .post("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        source: "gemini",
        sourceAnalysisId: "anl_test_1",
        suggestionIndex: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.source).toBe("gemini");
    expect(res.body.data.sourceAnalysisId).toBe("anl_test_1");
    expect(res.body.data.status).toBe("suggested");
    expect(res.body.data.title).toContain("Deploy second feeder 50 meters north");
  });

  it("Idempotency-Key on suggestion acceptance prevents double-accepting (API.md §6.14)", async () => {
    // Seed analysis for the acceptance flow
    const aPath = `users/${USER_A.uid}/analyses/anl_idem_1`;
    inMemoryDb.set(aPath, {
      id: "anl_idem_1",
      ownerId: USER_A.uid,
      type: "research_suggestions",
      summary: "Suggestions for idempotency verification",
      suggestedNextSteps: ["Replicate the pH assay with a control group"],
      observationIds: ["obs_1"],
    });

    const key = "idem-accept-123";

    // First acceptance creates the task
    const first = await request(app)
      .post("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", key)
      .send({
        source: "gemini",
        sourceAnalysisId: "anl_idem_1",
        suggestionIndex: 0,
      });
    expect(first.status).toBe(201);

    // Retried acceptance with the same key replays the original task (200, not 201)
    const replay = await request(app)
      .post("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", key)
      .send({
        source: "gemini",
        sourceAnalysisId: "anl_idem_1",
        suggestionIndex: 0,
      });
    expect(replay.status).toBe(200);
    expect(replay.body.data.id).toBe(first.body.data.id);

    // Exactly one task was created for this acceptance
    const list = await request(app)
      .get("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);
    const matching = list.body.data.filter(
      (t: { sourceAnalysisId?: string | null }) => t.sourceAnalysisId === "anl_idem_1"
    );
    expect(matching).toHaveLength(1);
  });

  it("rejects out-of-bounds suggestion index with 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        source: "gemini",
        sourceAnalysisId: "anl_test_1",
        suggestionIndex: 99,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects accepting foreign user analysis with 404 NOT_FOUND", async () => {
    const res = await request(app)
      .post("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`)
      .send({
        source: "gemini",
        sourceAnalysisId: "anl_test_1", // belongs to User A
        suggestionIndex: 0,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("enforces valid status transitions and rejects illegal transitions", async () => {
    // 1. Create task
    const createRes = await request(app)
      .post("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        source: "user",
        title: "Transition Test Task",
        description: "Testing state transitions",
      });

    const taskId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe("planned");

    // 2. Valid transition: planned -> in_progress
    const patchRes1 = await request(app)
      .patch(`/api/v1/research-tasks/${taskId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        status: "in_progress",
      });

    expect(patchRes1.status).toBe(200);
    expect(patchRes1.body.data.status).toBe("in_progress");

    // 3. Valid transition: in_progress -> completed
    const patchRes2 = await request(app)
      .patch(`/api/v1/research-tasks/${taskId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        status: "completed",
      });

    expect(patchRes2.status).toBe(200);
    expect(patchRes2.body.data.status).toBe("completed");

    // 4. Invalid transition: completed -> planned (not directly allowed, must be in_progress or dismissed)
    const patchRes3 = await request(app)
      .patch(`/api/v1/research-tasks/${taskId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        status: "planned",
      });

    expect(patchRes3.status).toBe(400);
    expect(patchRes3.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("User B accessing User A task receives 404 NOT_FOUND", async () => {
    const createRes = await request(app)
      .post("/api/v1/research-tasks")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        source: "user",
        title: "Alice Private Task",
        description: "Confidential research plan",
      });

    const taskId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/v1/research-tasks/${taskId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe("NOT_FOUND");
  });
});
