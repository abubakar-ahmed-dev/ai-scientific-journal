import { z } from "zod";

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
