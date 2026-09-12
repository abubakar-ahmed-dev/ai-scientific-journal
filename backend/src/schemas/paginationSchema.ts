import { z } from "zod";
import { AppError } from "../types/errors";

export const PaginationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
  })
  .passthrough();

export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  // Exact count of resources matching the filters, independent of the current
  // page. Only present when the endpoint can compute it exactly (see
  // observationRepository.list — omitted when the `q` in-memory prefilter
  // would make a Firestore count inaccurate).
  total?: number;
}

export interface CursorPayload {
  id: string;
  sortField: string;
  sortValue: string | number;
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(cursorStr?: string): CursorPayload | null {
  if (!cursorStr) return null;
  try {
    const raw = Buffer.from(cursorStr, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === "string" && typeof parsed.sortField === "string") {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

// API.md §5.3: cursors are bound to the sort they were minted with — mixing
// sorts between pages (or replaying a cursor from another endpoint) is a
// VALIDATION_ERROR, never a silent mis-ordered page. Call right after
// decodeCursor, before startAfter.
export function assertCursorSort(cursor: CursorPayload | null, expectedField: string): void {
  if (cursor && cursor.sortField !== expectedField) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Cursor does not match the requested sort. Restart the list from the first page."
    );
  }
}
