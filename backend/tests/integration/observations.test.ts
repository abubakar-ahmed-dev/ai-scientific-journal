import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, USER_B, MOCK_ID_TOKEN_USER_A, MOCK_ID_TOKEN_USER_B } from "../fixtures/userFixtures";
import { observationSearchRepository } from "../../src/repository/observationSearchRepository";

// In-memory mock store
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
            const nid = nestedId || `ver_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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
                const docId = id || `obs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
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

describe("Observations API (/api/v1/observations)", () => {
  it("unauthenticated request returns 401 UNAUTHENTICATED", async () => {
    const res = await request(app).get("/api/v1/observations");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("creates an observation with measurements and location, initializing version 1 and mediaCount 0", async () => {
    const res = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Cold front bird feeding frenzy",
        description: "Observed unusually high activity at the feeder.",
        notes: "Counted 15 birds in 10 minutes",
        hypothesis: "Feeding rate increases before pressure drops.",
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          label: "Backyard Feeder",
          precision: "exact",
        },
        tags: ["birds", "weather"],
        measurements: [
          {
            name: "temperature",
            value: 12.8,
            unit: "°C",
          },
        ],
        status: "observed",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.mediaCount).toBe(0);
    expect(res.body.data.ownerId).toBe(USER_A.uid);
    expect(res.body.data.measurements[0].name).toBe("temperature");
  });

  it("PATCH with matching expectedVersion creates version snapshot and increments version to 2", async () => {
    // 1. Create observation
    const createRes = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Original Observation Title",
        description: "Original description.",
      });

    const obsId = createRes.body.data.id;
    expect(createRes.body.data.version).toBe(1);

    // 2. Update with expectedVersion: 1
    const updateRes = await request(app)
      .patch(`/api/v1/observations/${obsId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Updated Observation Title",
        expectedVersion: 1,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.title).toBe("Updated Observation Title");
    expect(updateRes.body.data.version).toBe(2);

    // 3. Inspect version history
    const versionsRes = await request(app)
      .get(`/api/v1/observations/${obsId}/versions`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(versionsRes.status).toBe(200);
    expect(Array.isArray(versionsRes.body.data)).toBe(true);
  });

  it("PATCH with mismatched expectedVersion returns 409 CONFLICT", async () => {
    // 1. Create observation
    const createRes = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Locking Test",
        description: "Optimistic locking description.",
      });

    const obsId = createRes.body.data.id;

    // 2. Attempt update with stale expectedVersion (e.g. expected 99)
    const updateRes = await request(app)
      .patch(`/api/v1/observations/${obsId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Should Fail",
        expectedVersion: 99,
      });

    expect(updateRes.status).toBe(409);
    expect(updateRes.body.error.code).toBe("CONFLICT");
  });

  it("User B accessing User A's observation receives 404 NOT_FOUND (existence hiding)", async () => {
    const createRes = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Alice Private Observation",
        description: "Top secret scientific note.",
      });

    const obsId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/v1/observations/${obsId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.error.code).toBe("NOT_FOUND");
  });

  it("observation create, update, and delete succeed even if search index fails (ADR-017 best-effort)", async () => {
    const spyUpsert = vi.spyOn(observationSearchRepository, "upsert").mockRejectedValue(new Error("Index write failure"));
    const spyDelete = vi.spyOn(observationSearchRepository, "delete").mockRejectedValue(new Error("Index delete failure"));

    // 1. Create succeeds despite index error
    const createRes = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Resilient Observation",
        description: "Should succeed despite search index failure.",
      });

    expect(createRes.status).toBe(201);
    const obsId = createRes.body.data.id;

    // 2. Update succeeds despite index error
    const updateRes = await request(app)
      .patch(`/api/v1/observations/${obsId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Updated Resilient Observation",
      });

    expect(updateRes.status).toBe(200);

    // 3. Delete succeeds despite index error
    const deleteRes = await request(app)
      .delete(`/api/v1/observations/${obsId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(deleteRes.status).toBe(204);

    spyUpsert.mockRestore();
    spyDelete.mockRestore();
  });
});
