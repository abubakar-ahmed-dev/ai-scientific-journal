import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, USER_B, MOCK_ID_TOKEN_USER_A, MOCK_ID_TOKEN_USER_B } from "../fixtures/userFixtures";
import { MockStorageService, setStorageService } from "../../src/storage/storageService";

// In-memory Firestore store for integration testing
const inMemoryStore = new Map<string, Record<string, unknown>>();
let mockStorage: MockStorageService;

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
      const getDocHandler = (fullPath: string) => {
        const id = fullPath.split("/").pop() || "";
        return {
          id,
          get: async () => {
            const data = inMemoryStore.get(fullPath);
            return {
              exists: !!data,
              id,
              data: () => data,
              get: (f: string) => data?.[f],
            };
          },
          set: async (val: Record<string, unknown>) => {
            inMemoryStore.set(fullPath, { ...val, id });
          },
          update: async (val: Record<string, unknown>) => {
            const cur = inMemoryStore.get(fullPath) || {};
            inMemoryStore.set(fullPath, { ...cur, ...val });
          },
          delete: async () => {
            inMemoryStore.delete(fullPath);
          },
          collection: (nestedColl: string) => {
            const prefix = `${fullPath}/${nestedColl}`;
            const scanPrefix = (filter?: (data: Record<string, unknown>) => boolean) => {
              const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
              inMemoryStore.forEach((val, key) => {
                if (key.startsWith(`${prefix}/`) && (!filter || filter(val))) {
                  docs.push({
                    id: key.split("/").pop()!,
                    data: () => val,
                  });
                }
              });
              return docs;
            };
            return {
              doc: (nestedId?: string) => {
                const nid = nestedId || `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                return getDocHandler(`${prefix}/${nid}`);
              },
              where: (_field: string, _op: string, value: unknown) => {
                const filters: Array<(data: Record<string, unknown>) => boolean> = [
                  (data) => data[_field] === value,
                ];
                const applyAll = () => {
                  let docs = scanPrefix();
                  for (const f of filters) docs = docs.filter((d) => f(d.data()));
                  return docs;
                };
                const chain = {
                  where: (field2: string, _op2: string, value2: unknown) => {
                    filters.push((data) => data[field2] === value2);
                    return chain;
                  },
                  limit: (n: number) => ({
                    get: async () => {
                      const applied = applyAll();
                      return {
                        empty: applied.length === 0,
                        size: applied.length,
                        docs: applied.slice(0, n),
                      };
                    },
                  }),
                  get: async () => {
                    const applied = applyAll();
                    return {
                      empty: applied.length === 0,
                      size: applied.length,
                      docs: applied,
                    };
                  },
                };
                return chain;
              },
              get: async () => {
                const docs = scanPrefix();
                return {
                  empty: docs.length === 0,
                  size: docs.length,
                  docs,
                };
              },
            };
          },
        };
      };

      return {
        collection: (rootColl: string) => ({
          doc: (docId: string) => getDocHandler(`${rootColl}/${docId}`),
        }),
        batch: () => {
          const ops: Array<() => void> = [];
          return {
            set: (ref: { set: (val: Record<string, unknown>) => Promise<void> }, val: Record<string, unknown>) => {
              ops.push(() => {
                ref.set(val);
              });
            },
            update: (ref: { update: (val: Record<string, unknown>) => Promise<void> }, val: Record<string, unknown>) => {
              ops.push(() => {
                ref.update(val);
              });
            },
            delete: (ref: { delete: () => Promise<void> }) => {
              ops.push(() => {
                ref.delete();
              });
            },
            commit: async () => {
              for (const op of ops) op();
            },
          };
        },
      };
    },
    getFirebaseStorage: () => ({
      bucket: () => ({}),
    }),
  };
});

// Real magic-byte signatures (SECURITY §15 content validation is enforced)
const JPEG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.from([0x00, 0x10, 0x00, 0x10, 0x00, 0x10, 0x00, 0x10]),
  Buffer.from("JFIF"),
]);
const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
]);
const MP3_BYTES = Buffer.concat([
  Buffer.from("ID3"),
  Buffer.from([0x04, 0x00, 0x00, 0x00]),
  Buffer.alloc(16, 0x00),
]);
const MP4_BYTES = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x18]),
  Buffer.from("ftypisom"),
  Buffer.from([0x00, 0x00, 0x02, 0x00]),
]);

describe("Phase 7 Media Endpoints (/api/v1/observations/:obsId/media)", () => {
  const obsAId = "obs-user-a-1";

  beforeEach(() => {
    inMemoryStore.clear();
    mockStorage = new MockStorageService();
    setStorageService(mockStorage);

    // Seed observation owned by USER_A
    inMemoryStore.set(`users/${USER_A.uid}/observations/${obsAId}`, {
      id: obsAId,
      ownerId: USER_A.uid,
      title: "Peregrine Falcon Sighting",
      description: "Observed hunting over gorge.",
      observedAt: "2026-05-15T10:00:00Z",
      mediaCount: 0,
      version: 1,
      createdAt: "2026-05-15T10:00:00Z",
      updatedAt: "2026-05-15T10:00:00Z",
    });
  });

  it("POST /media uploads image successfully and omits storagePath from response", async () => {
    const res = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", JPEG_BYTES, {
        filename: "falcon.jpg",
        contentType: "image/jpeg",
      })
      .field("caption", "Falcon perched on limestone rock");

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.type).toBe("image");
    expect(res.body.data.fileName).toBe("falcon.jpg");
    expect(res.body.data.caption).toBe("Falcon perched on limestone rock");
    expect(res.body.data.url).toBeDefined();

    // ADR-016 & SECURITY §15: storagePath must NEVER be present in client API response
    expect(res.body.data.storagePath).toBeUndefined();

    // Verify parent observation mediaCount incremented
    const obs = inMemoryStore.get(`users/${USER_A.uid}/observations/${obsAId}`);
    expect(obs).toBeDefined();
  });

  it("POST /media uploads audio successfully", async () => {
    const res = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", MP3_BYTES, {
        filename: "call.mp3",
        contentType: "audio/mpeg",
      })
      .field("caption", "Vocal call recording");

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe("audio");
    expect(res.body.data.url).toBeDefined();
    expect(res.body.data.storagePath).toBeUndefined();
  });

  it("POST /media uploads video successfully", async () => {
    const res = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", MP4_BYTES, {
        filename: "dive.mp4",
        contentType: "video/mp4",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe("video");
    expect(res.body.data.storagePath).toBeUndefined();
  });

  it("POST /media rejects content whose magic bytes contradict the declared MIME type (SECURITY §15)", async () => {
    // Declared as image/jpeg but content is a plain executable — must be rejected
    const res = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", Buffer.from("MZ..fake-executable-content"), {
        filename: "totally-a-photo.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    // Zero-write: no media doc and no storage object
    expect(mockStorage.files.size).toBe(0);
  });

  it("POST /media rejects a mismatched file extension (extension/MIME consistency)", async () => {
    const res = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", JPEG_BYTES, {
        filename: "photo.exe",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("POST /media honors Idempotency-Key — retry returns the original media without duplicating", async () => {
    const key = "test-idempotency-key-123";

    const first = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", key)
      .attach("file", JPEG_BYTES, { filename: "falcon.jpg", contentType: "image/jpeg" });

    expect(first.status).toBe(201);

    const retry = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", key)
      .attach("file", JPEG_BYTES, { filename: "falcon.jpg", contentType: "image/jpeg" });

    expect(retry.status).toBe(200);
    expect(retry.body.data.id).toBe(first.body.data.id);

    // Only one media document exists
    const listRes = await request(app)
      .get(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);
    expect(listRes.body.data).toHaveLength(1);
    // And only one storage object
    expect(mockStorage.files.size).toBe(1);
  });

  it("POST /media rejects a reused Idempotency-Key with a different file (409 CONFLICT)", async () => {
    const key = "test-idempotency-key-conflict";

    const first = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", key)
      .attach("file", JPEG_BYTES, { filename: "falcon.jpg", contentType: "image/jpeg" });

    expect(first.status).toBe(201);

    const retry = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .set("Idempotency-Key", key)
      .attach("file", PNG_BYTES, { filename: "different.png", contentType: "image/png" });

    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe("CONFLICT");
  });

  it("POST /media rejects unsupported media types with 415", async () => {
    const res = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", Buffer.from("executable"), {
        filename: "malware.exe",
        contentType: "application/x-msdownload",
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("POST /media rejects missing file with 400", async () => {
    const res = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .field("caption", "No file attached");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /media rejects oversized image (>10MB) with 413", async () => {
    // Oversized buffer with valid JPEG magic bytes (must pass content
    // validation and fail on the per-type size limit)
    const largeBuffer = Buffer.concat([
      JPEG_BYTES,
      Buffer.alloc(11 * 1024 * 1024),
    ]);

    const res = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", largeBuffer, {
        filename: "giant.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("GET /media lists all media with short-lived signed URLs", async () => {
    // Upload two files
    await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", JPEG_BYTES, { filename: "photo.jpg", contentType: "image/jpeg" });

    await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", MP3_BYTES, { filename: "audio.mp3", contentType: "audio/mpeg" });

    const listRes = await request(app)
      .get(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.data[0].url).toBeDefined();
    expect(listRes.body.data[1].url).toBeDefined();
    expect(listRes.body.data[0].storagePath).toBeUndefined();
  });

  it("GET /media/:mediaId retrieves single media with signed URL", async () => {
    const uploadRes = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", JPEG_BYTES, { filename: "photo.jpg", contentType: "image/jpeg" });

    const mediaId = uploadRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/v1/observations/${obsAId}/media/${mediaId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(mediaId);
    expect(getRes.body.data.url).toBeDefined();
    expect(getRes.body.data.storagePath).toBeUndefined();
  });

  it("DELETE /media/:mediaId deletes storage object and metadata", async () => {
    const uploadRes = await request(app)
      .post(`/api/v1/observations/${obsAId}/media`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
      .attach("file", JPEG_BYTES, { filename: "delete-me.jpg", contentType: "image/jpeg" });

    const mediaId = uploadRes.body.data.id;

    const deleteRes = await request(app)
      .delete(`/api/v1/observations/${obsAId}/media/${mediaId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(deleteRes.status).toBe(204);

    // Verify subsequent GET returns 404
    const getRes = await request(app)
      .get(`/api/v1/observations/${obsAId}/media/${mediaId}`)
      .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`);

    expect(getRes.status).toBe(404);
  });

  describe("Cross-User Isolation Probes (SECURITY §14, §15)", () => {
    it("User B cannot view or list User A's media (returns 404 NOT_FOUND)", async () => {
      const uploadRes = await request(app)
        .post(`/api/v1/observations/${obsAId}/media`)
        .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
        .attach("file", JPEG_BYTES, { filename: "secret.jpg", contentType: "image/jpeg" });

      const mediaId = uploadRes.body.data.id;

      // User B attempts to list User A's media
      const listRes = await request(app)
        .get(`/api/v1/observations/${obsAId}/media`)
        .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`);
      expect(listRes.status).toBe(404);

      // User B attempts to read User A's media by ID
      const getRes = await request(app)
        .get(`/api/v1/observations/${obsAId}/media/${mediaId}`)
        .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`);
      expect(getRes.status).toBe(404);
    });

    it("User B cannot upload media to User A's observation (returns 404 NOT_FOUND)", async () => {
      const res = await request(app)
        .post(`/api/v1/observations/${obsAId}/media`)
        .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`)
        .attach("file", JPEG_BYTES, { filename: "hack.jpg", contentType: "image/jpeg" });

      expect(res.status).toBe(404);
    });

    it("User B cannot delete User A's media (returns 404 NOT_FOUND)", async () => {
      const uploadRes = await request(app)
        .post(`/api/v1/observations/${obsAId}/media`)
        .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_A}`)
        .attach("file", JPEG_BYTES, { filename: "safe.jpg", contentType: "image/jpeg" });

      const mediaId = uploadRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/v1/observations/${obsAId}/media/${mediaId}`)
        .set("Authorization", `Bearer ${MOCK_ID_TOKEN_USER_B}`);

      expect(deleteRes.status).toBe(404);
    });
  });
});
