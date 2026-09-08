import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, USER_B, MOCK_ID_TOKEN_USER_A, MOCK_ID_TOKEN_USER_B } from "../fixtures/userFixtures";

// In-memory mock store for projects and observations
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
      const getDocByPath = (fullPath: string) => ({
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
                  ...getDocByPath(fullPath),
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
                    return {
                      docs: docs.slice(0, lim),
                    };
                  },
                }),
                where: () => ({
                  limit: () => ({
                    get: async () => ({ docs: [] }),
                  }),
                }),
              }),
              where: (field: string, _op: string, value: unknown) => ({
                limit: (lim: number) => ({
                  get: async () => {
                    const prefix = `${rootColl}/${uid}/${subColl}/`;
                    const docs: Array<{
                      id?: string;
                      data: () => Record<string, unknown>;
                      get: (f: string) => unknown;
                      ref: { update: (v: Record<string, unknown>) => Promise<void> };
                    }> = [];
                    inMemoryDb.forEach((val, key) => {
                      if (key.startsWith(prefix) && val[field] === value) {
                        docs.push({
                          id: key.split("/").pop(),
                          data: () => val,
                          get: (f: string) => val[f],
                          ref: {
                            update: async (uv: Record<string, unknown>) => {
                              const current = inMemoryDb.get(key) || {};
                              inMemoryDb.set(key, { ...current, ...uv });
                            },
                          },
                        });
                      }
                    });
                    const page = docs.slice(0, lim);
                    return { docs: page, size: page.length, empty: page.length === 0 };
                  },
                }),
                get: async () => ({ empty: true, docs: [] }),
              }),
            }),
          }),
        }),
        batch: () => {
          const ops: Array<() => Promise<void>> = [];
          return {
            update: (
              ref: { update: (v: Record<string, unknown>) => Promise<void> },
              val: Record<string, unknown>
            ) => {
              ops.push(() => ref.update(val));
            },
            delete: () => {},
            commit: async () => {
              await Promise.all(ops.map((op) => op()));
            },
          };
        },
      };
    },
  };
});

describe("Projects API (/api/v1/projects)", () => {
  it("unauthenticated request returns 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/v1/projects");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates a project with valid payload and returns 201", async () => {
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Urban Bird Ecology",
        description: "Study on urban bird foraging patterns",
        field: "Ornithology",
        tags: ["birds", "urban"],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.title).toBe("Urban Bird Ecology");
    expect(res.body.data.status).toBe("active");
    expect(res.body.data.ownerId).toBe(USER_A.uid);
  });

  it("rejects invalid project creation payload with 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "", // Empty title invalid
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists projects for authenticated user", async () => {
    const res = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty("hasMore");
  });

  it("User B accessing User A's project receives 404 NOT_FOUND (existence hiding)", async () => {
    // 1. User A creates project
    const createRes = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Alice Confidential Project",
      });

    const projectId = createRes.body.data.id;

    // 2. User B attempts GET on Alice's projectId
    const getRes = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe("NOT_FOUND");
  });

  it("delete re-files observations, conversations, and research tasks to null and keeps analyses historical (API.md §6.4)", async () => {
    // 1. User A creates a project
    const createRes = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ title: "Cascade Project" });
    const projectId = createRes.body.data.id;

    // 2. Seed child docs referencing the project (project doc must exist for
    //    the route's existence check, which the repository performs first)
    const uid = USER_A.uid;
    inMemoryDb.set(`users/${uid}/observations/obs-1`, { ownerId: uid, projectId, title: "Obs" });
    inMemoryDb.set(`users/${uid}/conversations/conv-1`, { ownerId: uid, projectId, title: "Conv" });
    inMemoryDb.set(`users/${uid}/researchTasks/task-1`, { ownerId: uid, projectId, title: "Task" });
    inMemoryDb.set(`users/${uid}/analyses/an-1`, { ownerId: uid, projectId, type: "analysis" });

    // 3. Delete the project
    const delRes = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);
    expect(delRes.status).toBe(204);

    // 4. Children re-filed, not deleted
    expect(inMemoryDb.get(`users/${uid}/observations/obs-1`)).toMatchObject({ projectId: null });
    expect(inMemoryDb.get(`users/${uid}/conversations/conv-1`)).toMatchObject({ projectId: null });
    expect(inMemoryDb.get(`users/${uid}/researchTasks/task-1`)).toMatchObject({ projectId: null });

    // 5. Analyses retain the historical reference (append-only, never mutated)
    expect(inMemoryDb.get(`users/${uid}/analyses/an-1`)).toMatchObject({ projectId });

    // 6. Project doc itself is gone
    expect(inMemoryDb.get(`users/${uid}/projects/${projectId}`)).toBeUndefined();
  });

  it("deleting an already-deleted project returns 404 NOT_FOUND (idempotent contract)", async () => {
    const createRes = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ title: "Delete Twice" });
    const projectId = createRes.body.data.id;

    const first = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);
    expect(first.status).toBe(204);

    const second = await request(app)
      .delete(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);
    expect(second.status).toBe(404);
    expect(second.body.error.code).toBe("NOT_FOUND");
  });
});
