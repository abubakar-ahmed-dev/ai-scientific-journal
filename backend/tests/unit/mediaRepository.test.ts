import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory Firestore store for media tests
const inMemoryStore = new Map<string, Record<string, unknown>>();

vi.mock("../../src/lib/firebaseAdmin", () => ({
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
        collection: (subColl: string) => {
          const prefix = `${fullPath}/${subColl}`;
          return {
            doc: (subId?: string) => {
              const sid = subId || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              return getDocHandler(`${prefix}/${sid}`);
            },
            get: async () => {
              const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
              inMemoryStore.forEach((val, key) => {
                if (key.startsWith(`${prefix}/`)) {
                  docs.push({
                    id: key.split("/").pop()!,
                    data: () => val,
                  });
                }
              });
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
        doc: (rootId: string) => getDocHandler(`${rootColl}/${rootId}`),
      }),
      batch: () => {
        const operations: Array<() => void> = [];
        return {
          set: (ref: { set: (val: Record<string, unknown>) => Promise<void> }, val: Record<string, unknown>) => {
            operations.push(() => {
              ref.set(val);
            });
          },
          update: (ref: { update: (val: Record<string, unknown>) => Promise<void> }, val: Record<string, unknown>) => {
            operations.push(() => {
              ref.update(val);
            });
          },
          delete: (ref: { delete: () => Promise<void> }) => {
            operations.push(() => {
              ref.delete();
            });
          },
          commit: async () => {
            for (const op of operations) op();
          },
        };
      },
    };
  },
}));

import { mediaRepository } from "../../src/repository/mediaRepository";

describe("MediaRepository", () => {
  const uid = "user-test-123";
  const obsId = "obs-abc";

  beforeEach(() => {
    inMemoryStore.clear();
    // Seed parent observation
    inMemoryStore.set(`users/${uid}/observations/${obsId}`, {
      id: obsId,
      ownerId: uid,
      title: "Test Observation",
      mediaCount: 0,
    });
  });

  it("creates media document and derives storagePath without 'media/' segment", async () => {
    const media = await mediaRepository.create(uid, obsId, {
      type: "image",
      fileName: "hawk.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
      caption: "Spotted hawk in tree",
    });

    expect(media.id).toBeDefined();
    expect(media.observationId).toBe(obsId);
    expect(media.type).toBe("image");
    expect(media.fileName).toBe("hawk.jpg");
    expect(media.caption).toBe("Spotted hawk in tree");

    // ADR-016: storagePath must be users/{uid}/observations/{observationId}/{mediaId}
    expect(media.storagePath).toBe(`users/${uid}/observations/${obsId}/${media.id}`);
    expect(media.storagePath).not.toContain("/media/");

    // Check parent observation mediaCount was incremented
    const parentObs = inMemoryStore.get(`users/${uid}/observations/${obsId}`);
    expect(parentObs).toBeDefined();
  });

  it("throws NOT_FOUND when parent observation does not exist", async () => {
    await expect(
      mediaRepository.create(uid, "nonexistent-obs", {
        type: "audio",
        fileName: "bird-call.mp3",
        mimeType: "audio/mpeg",
        sizeBytes: 2048,
      })
    ).rejects.toThrow(/Observation 'nonexistent-obs' not found/);
  });

  it("finds media by id", async () => {
    const created = await mediaRepository.create(uid, obsId, {
      type: "video",
      fileName: "dive.mp4",
      mimeType: "video/mp4",
      sizeBytes: 5000,
    });

    const found = await mediaRepository.findById(uid, obsId, created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.type).toBe("video");
  });

  it("returns null when finding non-existent media", async () => {
    const found = await mediaRepository.findById(uid, obsId, "nonexistent-media");
    expect(found).toBeNull();
  });

  it("lists all media for an observation", async () => {
    await mediaRepository.create(uid, obsId, {
      type: "image",
      fileName: "img1.png",
      mimeType: "image/png",
      sizeBytes: 100,
    });
    await mediaRepository.create(uid, obsId, {
      type: "audio",
      fileName: "audio1.mp3",
      mimeType: "audio/mpeg",
      sizeBytes: 200,
    });

    const list = await mediaRepository.listByObservationId(uid, obsId);
    expect(list).toHaveLength(2);
  });

  it("deletes media document", async () => {
    const created = await mediaRepository.create(uid, obsId, {
      type: "image",
      fileName: "to-delete.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 300,
    });

    const deleted = await mediaRepository.delete(uid, obsId, created.id);
    expect(deleted).toBe(true);

    const check = await mediaRepository.findById(uid, obsId, created.id);
    expect(check).toBeNull();
  });
});
