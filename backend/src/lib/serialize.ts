import { Timestamp } from "firebase-admin/firestore";

/**
 * Convert Firestore Timestamps to ISO-8601 strings for API responses.
 * API.md §1.3: responses are JSON; raw Timestamp objects leak
 * `{_seconds, _nanoseconds}` objects that clients cannot parse (and the
 * frontend renders as "Invalid Date"). Applied to every document the
 * repositories return.
 */
export type Serialized<T> = {
  [K in keyof T]: T[K] extends Timestamp | null
    ? string | null
    : T[K] extends Timestamp | undefined
      ? string | undefined
      : T[K];
};

export function serializeTimestamps<T extends Record<string, unknown>>(doc: T): Serialized<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    out[key] = value instanceof Timestamp ? value.toDate().toISOString() : value;
  }
  return out as Serialized<T>;
}
