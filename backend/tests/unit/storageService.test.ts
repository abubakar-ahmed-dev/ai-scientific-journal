import { describe, it, expect, beforeEach } from "vitest";
import { MockStorageService } from "../../src/storage/storageService";

describe("MockStorageService", () => {
  let storage: MockStorageService;

  beforeEach(() => {
    storage = new MockStorageService();
  });

  it("uploads and retrieves signed URL for a file", async () => {
    const buffer = Buffer.from("fake-image-bytes");
    await storage.upload("users/uid-1/observations/obs-1/med-1", buffer, "image/jpeg");

    expect(storage.files.has("users/uid-1/observations/obs-1/med-1")).toBe(true);

    const url = await storage.getSignedReadUrl("users/uid-1/observations/obs-1/med-1", 15);
    expect(url).toContain("users/uid-1/observations/obs-1/med-1");
    expect(url).toContain("expires=");
  });

  it("throws when getting signed URL for non-existent file", async () => {
    await expect(storage.getSignedReadUrl("users/uid-1/observations/obs-1/nonexistent", 15)).rejects.toThrow(
      /File not found/
    );
  });

  it("deletes a specific file by path", async () => {
    const buffer = Buffer.from("data");
    await storage.upload("users/uid-1/observations/obs-1/med-1", buffer, "audio/mpeg");
    expect(storage.files.size).toBe(1);

    await storage.delete("users/uid-1/observations/obs-1/med-1");
    expect(storage.files.size).toBe(0);
  });

  it("deletes all files matching a prefix (cascade cleanup)", async () => {
    const buf = Buffer.from("data");
    await storage.upload("users/uid-1/observations/obs-1/med-1", buf, "image/png");
    await storage.upload("users/uid-1/observations/obs-1/med-2", buf, "video/mp4");
    await storage.upload("users/uid-1/observations/obs-2/med-3", buf, "image/jpeg");

    expect(storage.files.size).toBe(3);

    // Delete prefix for obs-1
    await storage.deletePrefix("users/uid-1/observations/obs-1/");

    expect(storage.files.size).toBe(1);
    expect(storage.files.has("users/uid-1/observations/obs-2/med-3")).toBe(true);
  });
});
