import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, MOCK_ID_TOKEN_USER_A } from "../fixtures/userFixtures";
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
          where: (field: string, _op: string, value: unknown) => {
            const matches = () => {
              const prefix = `${fullPath}/${nestedColl}/`;
              const docs: Array<{ id?: string; data: () => Record<string, unknown>; get: (f: string) => unknown }> = [];
              inMemoryDb.forEach((val, key) => {
                if (key.startsWith(prefix) && val[field] === value) {
                  docs.push({
                    id: key.split("/").pop(),
                    data: () => val,
                    get: (f: string) => val[f],
                  });
                }
              });
              return docs;
            };
            return {
              where: (f2: string, op2: string, v2: unknown) => ({
                limit: (lim: number) => ({
                  get: async () => {
                    const docs = matches().filter((d) => d.data()[f2] === v2);
                    return { empty: docs.length === 0, docs: docs.slice(0, lim) };
                  },
                }),
              }),
              limit: (lim: number) => ({
                get: async () => {
                  const docs = matches();
                  return { empty: docs.length === 0, docs: docs.slice(0, lim) };
                },
              }),
            };
          },
          orderBy: (sortField: string, sortDir: string = "asc") => ({
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

                docs.sort((a, b) => {
                  const valA = (a.data()[sortField] as number) || 0;
                  const valB = (b.data()[sortField] as number) || 0;
                  return sortDir === "desc" ? valB - valA : valA - valB;
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

describe("Chat Pipeline (POST /api/v1/conversations/:id/messages)", () => {
  beforeEach(() => {
    fakeAiService.reset();
    setAiService(fakeAiService);
  });

  it("persists user message and assistant reply, incrementing sequence and messageCount", async () => {
    // 1. Create active conversation
    const convRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Test Discussion",
        contextType: "general",
      });

    const convId = convRes.body.data.id;

    // 2. Send message
    const msgRes = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        content: "What hypotheses can we explore from the latest bird feeder data?",
      });

    expect(msgRes.status).toBe(201);
    expect(msgRes.body.data).toHaveProperty("userMessage");
    expect(msgRes.body.data).toHaveProperty("assistantMessage");
    expect(msgRes.body.data.userMessage.role).toBe("user");
    expect(msgRes.body.data.userMessage.sequence).toBe(1);
    expect(msgRes.body.data.assistantMessage.role).toBe("assistant");
    expect(msgRes.body.data.assistantMessage.sequence).toBe(2);
  });

  it("preserves user message in storage when AI service fails with 503 AI_UNAVAILABLE", async () => {
    // 1. Create conversation
    const convRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Outage Test",
        contextType: "general",
      });

    const convId = convRes.body.data.id;

    // 2. Inject failure mode in fake AI service
    fakeAiService.setFailureMode("unavailable");

    // 3. Send message during AI outage
    const msgRes = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        content: "This message should be preserved even if Gemini is down.",
      });

    expect(msgRes.status).toBe(503);
    expect(msgRes.body.error.code).toBe("AI_UNAVAILABLE");

    // 4. Verify conversation messages list contains the user's message
    const listRes = await request(app)
      .get(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(listRes.status).toBe(200);
    const userMsg = listRes.body.data.find(
      (m: { role: string; content: string }) =>
        m.role === "user" && m.content === "This message should be preserved even if Gemini is down."
    );
    expect(userMsg).toBeDefined();
  });
});

describe("F2 regression: Idempotency-Key retry semantics (API.md §4.2)", () => {
  beforeEach(() => {
    fakeAiService.reset();
    setAiService(fakeAiService);
  });

  it("retry with the same key after AI failure regenerates the assistant turn WITHOUT duplicating the user message", async () => {
    const convRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ contextType: "general" });
    const convId = convRes.body.data.id;

    // First attempt fails at the AI step
    fakeAiService.setFailureMode("unavailable");
    const failed = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", "retry-key-1")
      .send({ content: "Question that failed first time." });
    expect(failed.status).toBe(503);

    // Recovery: same key, AI is back
    fakeAiService.setFailureMode("none");
    const retry = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", "retry-key-1")
      .send({ content: "Question that failed first time." });
    expect(retry.status).toBe(201);
    expect(retry.body.data.userMessage.sequence).toBe(1);
    expect(retry.body.data.assistantMessage.sequence).toBe(2);

    // The user message must exist exactly once
    const list = await request(app)
      .get(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);
    const userMsgs = list.body.data.filter(
      (m: { role: string; content: string }) => m.role === "user" && m.content === "Question that failed first time."
    );
    expect(userMsgs.length).toBe(1);
    expect(list.body.data.length).toBe(2);
  });

  it("retry with the same key after success returns the stored result without re-executing", async () => {
    const convRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ contextType: "general" });
    const convId = convRes.body.data.id;

    const first = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", "done-key-1")
      .send({ content: "Original question." });
    expect(first.status).toBe(201);

    fakeAiService.setCustomResponse("SHOULD_NOT_APPEAR");
    const replay = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", "done-key-1")
      .send({ content: "Original question." });
    expect(replay.status).toBe(200);
    expect(replay.body.data.assistantMessage.content).not.toContain("SHOULD_NOT_APPEAR");

    // No new messages were created
    const list = await request(app)
      .get(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);
    expect(list.body.data.length).toBe(2);
  });
});
