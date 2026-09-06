import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "../../src/schemas/paginationSchema";
import { serializeTimestamps } from "../../src/lib/serialize";
import { Timestamp } from "firebase-admin/firestore";

describe("pagination cursor contract (API.md §5.3)", () => {
  it("round-trips id and sortField", () => {
    const cursor = encodeCursor({ id: "obs_1", sortField: "updatedAt", sortValue: "2026-09-02T00:00:00Z" });
    expect(decodeCursor(cursor)).toMatchObject({ id: "obs_1", sortField: "updatedAt" });
  });

  it("returns null for garbage cursors (stale/invalid → client restarts)", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(decodeCursor(Buffer.from('{"sortField":"updatedAt"}').toString("base64url"))).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe("timestamp serialization (F1 regression — raw Timestamps must not leak)", () => {
  it("converts Firestore Timestamps to ISO strings", () => {
    const ts = Timestamp.fromDate(new Date("2026-09-02T12:00:00Z"));
    const out = serializeTimestamps({ createdAt: ts, title: "x", projectId: null });
    expect(out.createdAt).toBe("2026-09-02T12:00:00.000Z");
    expect(typeof out.createdAt).toBe("string");
    expect(out.title).toBe("x");
    expect(out.projectId).toBeNull();
  });

  it("leaves non-timestamp values untouched", () => {
    const out = serializeTimestamps({
      a: 1,
      b: "text",
      c: { nested: true },
      d: [Timestamp.fromDate(new Date("2026-01-01T00:00:00Z"))], // arrays untouched (not a Timestamp)
    });
    expect(out.a).toBe(1);
    expect(out.c).toEqual({ nested: true });
    expect(Array.isArray(out.d)).toBe(true);
  });
});
