import { describe, it, expect } from "vitest";
import {
  encodeCursor,
  decodeCursor,
  assertCursorSort,
  CursorPayload,
} from "../../src/schemas/paginationSchema";
import { AppError } from "../../src/types/errors";
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

describe("assertCursorSort (API.md §5.3 — cursors bound to their sort)", () => {
  const cursorFor = (sortField: string): CursorPayload =>
    decodeCursor(encodeCursor({ id: "doc_1", sortField, sortValue: "1" }))!;

  it("accepts a cursor whose sortField matches the requested sort", () => {
    expect(() => assertCursorSort(cursorFor("updatedAt"), "updatedAt")).not.toThrow();
  });

  it("accepts a null cursor (first page)", () => {
    expect(() => assertCursorSort(null, "updatedAt")).not.toThrow();
  });

  it("rejects a cursor minted for a different sort with VALIDATION_ERROR", () => {
    expect(() => assertCursorSort(cursorFor("observedAt"), "updatedAt")).toThrowError(AppError);
    try {
      assertCursorSort(cursorFor("sequence"), "updatedAt");
    } catch (err) {
      expect((err as AppError).status).toBe(400);
      expect((err as AppError).code).toBe("VALIDATION_ERROR");
    }
  });

  it("guards every endpoint's fixed sort field", () => {
    // conversations/researchTasks: updatedAt; analyses: createdAt;
    // messages: sequence; observation versions: editedAt
    expect(() => assertCursorSort(cursorFor("createdAt"), "updatedAt")).toThrowError(AppError);
    expect(() => assertCursorSort(cursorFor("updatedAt"), "createdAt")).toThrowError(AppError);
    expect(() => assertCursorSort(cursorFor("updatedAt"), "sequence")).toThrowError(AppError);
    expect(() => assertCursorSort(cursorFor("updatedAt"), "editedAt")).toThrowError(AppError);
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
