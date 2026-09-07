import fs from "fs";
import { logger } from "./logger";

// Shared helpers for routes that stage a multipart upload to a temp file
// before streaming it to Cloud Storage (media upload, avatar upload).

/** Reads only the first `bytes` of a staged file — magic-byte sniffing never buffers the body. */
export async function readFileHead(filePath: string, bytes: number): Promise<Buffer> {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Best-effort temp-file cleanup for every exit path of an upload route. */
export function discardStagedFile(filePath?: string): void {
  if (!filePath) return;
  fs.promises.unlink(filePath).catch((err) => {
    logger.warn({ err, filePath }, "Failed to remove staged upload temp file");
  });
}
