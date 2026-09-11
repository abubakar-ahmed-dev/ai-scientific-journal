import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, USER_B, MOCK_ID_TOKEN_USER_A, MOCK_ID_TOKEN_USER_B } from "../fixtures/userFixtures";
import { fakeAiService } from "../../src/ai/adapters/fakeAiService";
import { setAiService } from "../../src/ai/aiService";
import { retrievalService } from "../../src/ai/retrieval/retrievalService";

const inMemoryDb = new Map<string, Record<string, unknown>>();
const USER_RATE_LIMIT = { uid: "user-rate-limit-uid", email: "limit@example.com" };
const MOCK_ID_TOKEN_RATE_LIMIT = "mock-token-rate-limit";

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
        if (token === MOCK_ID_TOKEN_RATE_LIMIT) {
          return { uid: USER_RATE_LIMIT.uid, email: USER_RATE_LIMIT.email, name: "Rate Limit Tester" };
        }
        throw new Error("Invalid token");
      },
    }),
    getFirebaseFirestore: () => {
      const getDocHandler = (fullPath: string) => {
        const id = fullPath.split("/").pop() || "";
        return {
          id,
          get: async () => {
            const data = inMemoryDb.get(fullPath);
            return {
              exists: !!data,
              id,
              data: () => data,
              get: (field: string) => data?.[field],
            };
          },
          set: async (val: Record<string, unknown>) => {
            inMemoryDb.set(fullPath, { ...val, id });
          },
          update: async (val: Record<string, unknown>) => {
            const current = inMemoryDb.get(fullPath) || {};
            inMemoryDb.set(fullPath, { ...current, ...val });
          },
          delete: async () => {
            inMemoryDb.delete(fullPath);
          },
          collection: (nestedColl: string) => {
            const prefix = `${fullPath}/${nestedColl}`;

            const buildQuery = (
              filters: Array<{ field: unknown; value: unknown }> = [],
              sortField?: string,
              sortDir?: "asc" | "desc",
              limitCount?: number
            ): unknown => {
              return {
                where: (field: unknown, _op: string, value: unknown) =>
                  buildQuery([...filters, { field, value }], sortField, sortDir, limitCount),
                orderBy: (f: string, d?: "asc" | "desc") =>
                  buildQuery(filters, f, d, limitCount),
                limit: (lim: number) =>
                  buildQuery(filters, sortField, sortDir, lim),
                get: async () => {
                  const docs: Array<{
                    id: string;
                    data: () => Record<string, unknown>;
                    get: (f: string) => unknown;
                    ref: unknown;
                  }> = [];

                  inMemoryDb.forEach((val, key) => {
                    if (key.startsWith(`${prefix}/`)) {
                      const docId = key.split("/").pop()!;
                      let matches = true;
                      for (const filter of filters) {
                        if (Array.isArray(filter.value)) {
                          if (
                            !filter.value.includes(docId) &&
                            !(typeof filter.field === "string" && filter.value.includes(val[filter.field]))
                          ) {
                            matches = false;
                            break;
                          }
                        } else if (typeof filter.field === "string" && val[filter.field] !== filter.value) {
                          matches = false;
                          break;
                        }
                      }
                      if (matches) {
                        docs.push({
                          id: docId,
                          data: () => val,
                          get: (f: string) => val[f],
                          ref: getDocHandler(key),
                        });
                      }
                    }
                  });

                  if (sortField) {
                    docs.sort((a, b) => {
                      const aVal = a.data()[sortField] as number;
                      const bVal = b.data()[sortField] as number;
                      return sortDir === "desc" ? (bVal || 0) - (aVal || 0) : (aVal || 0) - (bVal || 0);
                    });
                  }

                  const sliced = limitCount !== undefined ? docs.slice(0, limitCount) : docs;
                  return {
                    empty: sliced.length === 0,
                    size: sliced.length,
                    docs: sliced,
                  };
                },
              };
            };

            const queryObj = buildQuery() as {
              doc: (nestedId?: string) => unknown;
              where: (field: unknown, op: string, value: unknown) => unknown;
              orderBy: (f: string, d?: "asc" | "desc") => unknown;
              limit: (lim: number) => unknown;
              get: () => Promise<unknown>;
            };

            queryObj.doc = (nestedId?: string) => {
              const nid = nestedId || `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              return getDocHandler(`${prefix}/${nid}`);
            };

            return queryObj;
          },
        };
      };

      return {
        collection: (rootColl: string) => ({
          doc: (docId?: string) => {
            const did = docId || `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            return getDocHandler(`${rootColl}/${did}`);
          },
        }),
        batch: () => ({
          update: (ref: { update: (data: Record<string, unknown>) => Promise<void> }, data: Record<string, unknown>) => {
            ref.update(data);
          },
          delete: (ref: { delete: () => Promise<void> }) => {
            ref.delete();
          },
          commit: async () => {},
        }),
      };
    },
  };
});

describe("Phase 6 RAG Endpoints (POST /api/v1/ai/ask & POST /api/v1/ai/search)", () => {
  beforeEach(() => {
    inMemoryDb.clear();
    fakeAiService.reset();
    setAiService(fakeAiService);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const askRes = await request(app).post("/api/v1/ai/ask").send({ question: "What birds did I see?" });
    expect(askRes.status).toBe(401);
    expect(askRes.body.error.code).toBe("UNAUTHENTICATED");

    const searchRes = await request(app).post("/api/v1/ai/search").send({ query: "birds" });
    expect(searchRes.status).toBe(401);
    expect(searchRes.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("POST /api/v1/ai/search returns ranked, canonical-verified observations", async () => {
    // 1. Create an observation
    const createObs = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Peregrine Falcon Sighting",
        description: "Observed a falcon diving at high speed near the north cliff.",
        tags: ["raptor", "cliff"],
      });
    expect(createObs.status).toBe(201);
    const obsId = createObs.body.data.id;

    // 2. Perform search
    const searchRes = await request(app)
      .post("/api/v1/ai/search")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ query: "falcon cliff" });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data).toBeInstanceOf(Array);
    expect(searchRes.body.data.length).toBe(1);
    expect(searchRes.body.meta.resultCount).toBe(1);
    // Candidate cap not hit in this small journal (fixing-plan #16)
    expect(searchRes.body.meta.truncated).toBe(false);

    const match = searchRes.body.data[0];
    expect(match.observationId).toBe(obsId);
    expect(match.title).toBe("Peregrine Falcon Sighting");
    expect(match.score).toBeGreaterThan(0);
    expect(typeof match.observedAt).toBe("string");
    expect(match.snippet).toContain("falcon");
  });

  it("POST /api/v1/ai/search returns empty result when no records match query", async () => {
    const searchRes = await request(app)
      .post("/api/v1/ai/search")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ query: "completely unrelated query without matches" });

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data).toEqual([]);
    expect(searchRes.body.meta.resultCount).toBe(0);
  });

  it("POST /api/v1/ai/ask produces grounded answer with canonical evidence attribution", async () => {
    // 1. Seed observation
    const createObs = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Northern Cardinal Nesting",
        description: "Pair of cardinals building a nest in the hawthorn bush.",
        tags: ["cardinal", "nest"],
      });
    expect(createObs.status).toBe(201);
    const obsId = createObs.body.data.id;

    // 2. Ask question
    const askRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ question: "Have I observed any nesting cardinals?" });

    expect(askRes.status).toBe(200);
    expect(askRes.body.data).toHaveProperty("answer");
    expect(askRes.body.data).toHaveProperty("evidence");
    expect(askRes.body.data).toHaveProperty("uncertainties");
    expect(askRes.body.data.insufficientEvidence).toBe(false);
    expect(askRes.body.data.model).toBe("fake-gemini-model");
    expect(askRes.body.data.promptVersion).toBe("ask-grounded-v3");

    expect(askRes.body.data.evidence.length).toBeGreaterThan(0);
    expect(askRes.body.data.evidence[0].observationId).toBe(obsId);
    expect(askRes.body.data.evidence[0].title).toBe("Northern Cardinal Nesting");
    expect(typeof askRes.body.data.evidence[0].observedAt).toBe("string");
  });

  it("POST /api/v1/ai/ask triggers deterministic insufficient evidence gate when no matches exist", async () => {
    const askRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ question: "What is the speed of an unladen swallow?" });

    expect(askRes.status).toBe(200);
    expect(askRes.body.data.answer).toContain("could not find any relevant observations");
    expect(askRes.body.data.evidence).toEqual([]);
    expect(askRes.body.data.uncertainties.length).toBeGreaterThan(0);
    expect(askRes.body.data.insufficientEvidence).toBe(true);
    expect(askRes.body.data.model).toBe("none");
    expect(askRes.body.data.promptVersion).toBe("ask-grounded-v3");

    // Model must not have been invoked
    expect(fakeAiService.groundedHistory.length).toBe(0);
  });

  it("POST /api/v1/ai/ask triggers the weak-evidence gate when the best candidate score is below threshold", async () => {
    // One matching token ("temperature") out of seven unique query tokens,
    // with the title boost: 1.5 / (7 * 1.8) = 0.119 — above AI_RAG_MIN_SCORE
    // (0.1) so it survives retrieval, but below AI_RAG_WEAK_EVIDENCE_SCORE
    // (0.12), so generation must be gated deterministically (fixing-plan #18).
    const createObs = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Weather Diary",
        description: "Recorded temperature hourly.",
      });
    expect(createObs.status).toBe(201);

    const askRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        question: "temperature geology archaeology astronomy hydrology entomology mythology",
      });

    expect(askRes.status).toBe(200);
    expect(askRes.body.data.answer).toContain("only weakly relate");
    expect(askRes.body.data.evidence).toEqual([]);
    expect(askRes.body.data.insufficientEvidence).toBe(true);
    expect(askRes.body.data.model).toBe("none");
    // Model must not have been invoked on weak evidence
    expect(fakeAiService.groundedHistory.length).toBe(0);
  });

  it("POST /api/v1/ai/ask rejects fabricated citations with 502 AI_INVALID_RESPONSE", async () => {
    // 1. Seed real observation
    const createObs = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Barn Owl Observation",
        description: "Heard barn owl screech near old barn.",
      });
    expect(createObs.status).toBe(201);

    // 2. Configure FakeAI to inject a hallucinated/foreign observationId
    fakeAiService.setCustomGroundedOutput({
      answer: "I found an owl.",
      evidence: [{ observationId: "hallucinated_obs_999", note: "Invented reference" }],
      uncertainties: [],
    });

    const askRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ question: "Did I record any owl activity?" });

    expect(askRes.status).toBe(502);
    expect(askRes.body.error.code).toBe("AI_INVALID_RESPONSE");
  });

  it("POST /api/v1/ai/ask with conversationId persists question and answer to conversation history", async () => {
    // 1. Create conversation
    const createConv = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ title: "Bird Research Q&A", contextType: "general" });
    expect(createConv.status).toBe(201);
    const convId = createConv.body.data.id;

    // 2. Seed observation
    await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Blue Jay Foraging",
        description: "Blue jays caching acorns near the oak grove.",
      });

    // 3. Ask question linked to conversationId
    const askRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", "idemp_ask_123")
      .send({
        question: "Where were blue jays foraging?",
        conversationId: convId,
      });

    expect(askRes.status).toBe(200);

    // 4. Verify conversation messages exist
    const messagesRes = await request(app)
      .get(`/api/v1/conversations/${convId}/messages`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(messagesRes.status).toBe(200);
    expect(messagesRes.body.data.length).toBe(2);
    expect(messagesRes.body.data[0].role).toBe("user");
    expect(messagesRes.body.data[0].content).toBe("Where were blue jays foraging?");
    expect(messagesRes.body.data[1].role).toBe("assistant");

    // 5. Test idempotency replay
    const replayRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", "idemp_ask_123")
      .send({
        question: "Where were blue jays foraging?",
        conversationId: convId,
      });

    expect(replayRes.status).toBe(200);
    expect(replayRes.body.data.answer).toBe(askRes.body.data.answer);
  });

  it("POST /api/v1/ai/ask with foreign conversationId returns 404 NOT_FOUND", async () => {
    // Create conversation as User B
    const createConvB = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`)
      .send({ title: "Bob's Conversation", contextType: "general" });
    const convIdB = createConvB.body.data.id;

    // User A attempts to ask linked to User B's conversation
    const askRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        question: "Can I access Bob's chat?",
        conversationId: convIdB,
      });

    expect(askRes.status).toBe(404);
    expect(askRes.body.error.code).toBe("NOT_FOUND");
  });

  it("POST /api/v1/ai/ask with archived conversation returns 400 VALIDATION_ERROR", async () => {
    // 1. Create conversation
    const createConv = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ title: "Archived Conversation", contextType: "general" });
    const convId = createConv.body.data.id;

    // 2. Archive it
    await request(app)
      .patch(`/api/v1/conversations/${convId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ status: "archived" });

    // 3. Attempt ask
    const askRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        question: "Test question in archived conversation",
        conversationId: convId,
      });

    expect(askRes.status).toBe(400);
    expect(askRes.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/ai/ask fails with 503 AI_UNAVAILABLE when retrieval fails, preserving model integrity", async () => {
    const spyRetrieve = vi.spyOn(retrievalService, "retrieve").mockRejectedValue(new Error("Index database down"));

    const askRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({ question: "Will this fail gracefully?" });

    expect(askRes.status).toBe(503);
    expect(askRes.body.error.code).toBe("AI_UNAVAILABLE");
    // Model was never called
    expect(fakeAiService.groundedHistory.length).toBe(0);

    spyRetrieve.mockRestore();
  });

  it("Cross-user isolation: User B search and ask never retrieve User A's observations", async () => {
    // 1. User A seeds unique private observation
    const createObsA = await request(app)
      .post("/api/v1/observations")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .send({
        title: "Alice Top Secret Quantum Experiment",
        description: "Confidential optical quantum teleportation measurements.",
        tags: ["quantum", "teleportation"],
      });
    expect(createObsA.status).toBe(201);
    const obsIdA = createObsA.body.data.id;

    // 2. User B searches for Alice's unique keywords
    const searchResB = await request(app)
      .post("/api/v1/ai/search")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`)
      .send({ query: "quantum teleportation" });

    expect(searchResB.status).toBe(200);
    expect(searchResB.body.data).toEqual([]);
    expect(searchResB.body.meta.resultCount).toBe(0);

    // 3. User B asks a question specifically targeting Alice's research
    const askResB = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`)
      .send({ question: "What were my optical quantum teleportation measurements?" });

    expect(askResB.status).toBe(200);
    // Insufficient evidence gate triggers because User B has no matching observations
    expect(askResB.body.data.evidence).toEqual([]);
    expect(askResB.body.data.model).toBe("none");
    expect(JSON.stringify(askResB.body)).not.toContain(obsIdA);
  });

  it("Enforces the retrieval tier on /ai/search (60 requests / min / user)", async () => {
    // /ai/search is a cheap non-generative read (API.md §4.1): browsing
    // related observations must not consume the 10/5-min generation bucket.
    let limitedSeen = false;
    for (let i = 0; i < 61; i++) {
      const res = await request(app)
        .post("/api/v1/ai/search")
        .set("Authorization", `Bearer ${MOCK_ID_TOKEN_RATE_LIMIT}`)
        .send({ query: "test rate limit" });
      if (res.status === 429) {
        limitedSeen = true;
        expect(res.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
        expect(res.header["retry-after"]).toBeDefined();
        break;
      }
      expect(res.status).toBe(200);
    }
    expect(limitedSeen).toBe(true);
  });

  it("Keeps the generation AI tier (10 requests / 5 min / user) on /ai/ask", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post("/api/v1/ai/ask")
        .set("Authorization", `Bearer ${MOCK_ID_TOKEN_RATE_LIMIT}`)
        .send({ question: "rate limit probe" });
      expect(res.status).toBe(200);
    }

    // 11th generation request for USER_RATE_LIMIT must return 429
    const limitedRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_RATE_LIMIT}`)
      .send({ question: "rate limit probe" });

    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(limitedRes.header["retry-after"]).toBeDefined();

    // User B should remain unaffected (per-user rate limit)
    const userBRes = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`)
      .send({ question: "rate limit probe" });

    expect(userBRes.status).toBe(200);
  });
});
