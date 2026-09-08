import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../src/app";
import { USER_A, MOCK_ID_TOKEN_USER_A } from "../fixtures/userFixtures";
import { MockStorageService, setStorageService } from "../../src/storage/storageService";

const inMemoryStore = new Map<string, Record<string, unknown>>();
let mockStorage: MockStorageService;
const updateUserMock = vi.fn(async () => ({}));

vi.mock("../../src/lib/firebaseAdmin", () => {
  return {
    getFirebaseAuth: () => ({
      verifyIdToken: async (token: string) => {
        if (token === MOCK_ID_TOKEN_USER_A) {
          return { uid: USER_A.uid, email: USER_A.email, name: USER_A.displayName };
        }
        throw new Error("Invalid token");
      },
      updateUser: (...args: unknown[]) => updateUserMock(...(args as [])),
    }),
    getFirebaseFirestore: () => ({
      collection: (rootColl: string) => ({
        doc: (docId: string) => {
          const fullPath = `${rootColl}/${docId}`;
          return {
            id: docId,
            get: async () => {
              const data = inMemoryStore.get(fullPath);
              return {
                exists: !!data,
                id: docId,
                data: () => data,
                get: (f: string) => data?.[f],
              };
            },
            set: async (val: Record<string, unknown>) => {
              inMemoryStore.set(fullPath, { ...val });
            },
            update: async (val: Record<string, unknown>) => {
              const cur = inMemoryStore.get(fullPath) || {};
              inMemoryStore.set(fullPath, { ...cur, ...val });
            },
          };
        },
      }),
    }),
  };
});

const AUTH = { Authorization: `Bearer ${MOCK_ID_TOKEN_USER_A}` };

function pngBuffer(sizeBytes = 100): Buffer {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(8, 0),
    Buffer.alloc(Math.max(0, sizeBytes - 16), 0x41),
  ]);
  return png;
}

describe("Me endpoints — profile and avatar (settings refactor 2026-09-07)", () => {
  beforeEach(() => {
    inMemoryStore.clear();
    mockStorage = new MockStorageService();
    setStorageService(mockStorage);
    updateUserMock.mockClear();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const getRes = await request(app).get("/api/v1/me");
    expect(getRes.status).toBe(401);

    const patchRes = await request(app).patch("/api/v1/me/avatar").attach("file", pngBuffer(), "a.png");
    expect(patchRes.status).toBe(401);

    const delRes = await request(app).delete("/api/v1/me/avatar");
    expect(delRes.status).toBe(401);
  });

  it("GET /me returns profile without avatarUrl and never exposes avatarPath", async () => {
    const res = await request(app).get("/api/v1/me").set(AUTH);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(USER_A.email);
    expect(res.body.data.avatarUrl).toBeNull();
    expect(res.body.data.avatarPath).toBeUndefined();
  });

  it("PATCH /me updates displayName and propagates it to the Firebase Auth profile", async () => {
    const res = await request(app)
      .patch("/api/v1/me")
      .set(AUTH)
      .send({ displayName: "Dr. Probe" });
    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe("Dr. Probe");
    expect(updateUserMock).toHaveBeenCalledWith(USER_A.uid, { displayName: "Dr. Probe" });
  });

  it("PATCH /me/avatar stores the avatar and returns a signed avatarUrl", async () => {
    const res = await request(app)
      .patch("/api/v1/me/avatar")
      .set(AUTH)
      .attach("file", pngBuffer(), { filename: "me.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.data.avatarUrl).toContain("storage.mock.local");
    expect(res.body.data.avatarPath).toBeUndefined();

    // Fixed object path per ADR-016 extension: users/{uid}/avatar/avatar
    expect(mockStorage.files.has(`users/${USER_A.uid}/avatar/avatar`)).toBe(true);
  });

  it("PATCH /me/avatar rejects non-image content regardless of declared MIME", async () => {
    const fake = Buffer.from("definitely not an image, just plain text content");
    const res = await request(app)
      .patch("/api/v1/me/avatar")
      .set(AUTH)
      .attach("file", fake, { filename: "me.png", contentType: "image/png" });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(mockStorage.files.size).toBe(0);
  });

  it("PATCH /me/avatar rejects files over the 2 MB avatar limit with 413", async () => {
    const res = await request(app)
      .patch("/api/v1/me/avatar")
      .set(AUTH)
      .attach("file", pngBuffer(2 * 1024 * 1024 + 1024), {
        filename: "big.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("PATCH /me/avatar without a file returns VALIDATION_ERROR", async () => {
    const res = await request(app).patch("/api/v1/me/avatar").set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("DELETE /me/avatar clears the avatar and removes the stored object", async () => {
    const upload = await request(app)
      .patch("/api/v1/me/avatar")
      .set(AUTH)
      .attach("file", pngBuffer(), { filename: "me.png", contentType: "image/png" });
    expect(upload.status).toBe(200);

    const del = await request(app).delete("/api/v1/me/avatar").set(AUTH);
    expect(del.status).toBe(200);
    expect(del.body.data.avatarUrl).toBeNull();
    expect(mockStorage.files.has(`users/${USER_A.uid}/avatar/avatar`)).toBe(false);
  });
});
