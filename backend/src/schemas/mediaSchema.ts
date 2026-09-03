import { z } from "zod";
import { MediaDocument } from "../repository/mediaRepository";
import { AppError } from "../types/errors";

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

export const ALLOWED_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
] as const;

export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
] as const;

export const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_AUDIO_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
] as const;

export type AllowedMimeType = (typeof ALL_ALLOWED_MIME_TYPES)[number];

export function detectMediaType(mimeType: string): "image" | "audio" | "video" | null {
  const lower = mimeType.toLowerCase();
  if (ALLOWED_IMAGE_MIME_TYPES.some((m) => m === lower)) return "image";
  if (ALLOWED_AUDIO_MIME_TYPES.some((m) => m === lower)) return "audio";
  if (ALLOWED_VIDEO_MIME_TYPES.some((m) => m === lower)) return "video";
  return null;
}

// Extension/MIME consistency (API.md §6.8). Extensions are advisory: a file
// without one passes; a present extension must agree with the sniffed content.
const EXTENSIONS_BY_MEDIA_TYPE: Record<"image" | "audio" | "video", string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "heic", "heif"],
  audio: ["mp3", "wav", "wave", "m4a", "mp4"],
  video: ["mp4", "mov", "m4v"],
};

/** Magic-byte file signatures for the allowed media families (SECURITY §15). */
export function detectMediaTypeFromBuffer(buffer: Buffer): "image" | "audio" | "video" | null {
  if (!buffer || buffer.length < 12) return null;

  const startsWith = (sig: number[], offset = 0): boolean =>
    sig.every((byte, i) => buffer[offset + i] === byte);
  const asciiAt = (offset: number, text: string): boolean =>
    Buffer.from(text, "ascii").equals(buffer.subarray(offset, offset + text.length));

  // JPEG: FF D8 FF
  if (startsWith([0xff, 0xd8, 0xff])) return "image";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image";
  // WebP: "RIFF" .... "WEBP"
  if (asciiAt(0, "RIFF") && asciiAt(8, "WEBP")) return "image";
  // WAV: "RIFF" .... "WAVE"
  if (asciiAt(0, "RIFF") && asciiAt(8, "WAVE")) return "audio";

  // ISO-BMFF container (HEIC/MP4/MOV/M4A): box size @0 + "ftyp" @4 + brand @8
  if (asciiAt(4, "ftyp")) {
    const brand = buffer.subarray(8, 12).toString("ascii").toLowerCase();
    if (brand.startsWith("heic") || brand.startsWith("heix") || brand.startsWith("hevc") || brand.startsWith("mhe1")) {
      return "image";
    }
    if (brand.startsWith("m4a") || brand.startsWith("m4b")) return "audio";
    if (
      brand.startsWith("isom") ||
      brand.startsWith("iso2") ||
      brand.startsWith("mp4") ||
      brand.startsWith("msnv") ||
      brand.startsWith("mov") ||
      brand.startsWith("m4v") ||
      brand.startsWith("dash") ||
      brand.startsWith("nd")
    ) {
      return "video";
    }
    return null; // unknown container brand — reject rather than trust the declared MIME
  }

  // MP3: "ID3" tag or frame sync (0xFF followed by 111xxxxx)
  if (asciiAt(0, "ID3")) return "audio";
  if (buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) return "audio";

  return null;
}

/**
 * Content-level validation (SECURITY §15): the sniffed media type must exist
 * and agree with the client-declared MIME type, and any file extension must
 * be consistent with the sniffed type. Returns the sniffed type.
 */
export function validateFileConsistency(
  buffer: Buffer,
  declaredMimeType: string,
  fileName: string
): "image" | "audio" | "video" {
  const sniffedType = detectMediaTypeFromBuffer(buffer);
  const declaredType = detectMediaType(declaredMimeType);

  if (!sniffedType || sniffedType !== declaredType) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      "File content does not match its declared media type."
    );
  }

  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : null;
  if (extension && !EXTENSIONS_BY_MEDIA_TYPE[sniffedType].includes(extension)) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      `File extension '${extension}' does not match the detected ${sniffedType} content.`
    );
  }

  return sniffedType;
}

export const UploadMediaMetadataSchema = z.object({
  caption: z.string().trim().max(500, "Caption cannot exceed 500 characters").optional().nullable(),
});

export interface SerializedMediaResponse {
  id: string;
  ownerId: string;
  observationId: string;
  type: "image" | "audio" | "video";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  createdAt: string;
  url?: string;
}

/**
 * Serializes MediaDocument for API responses.
 * Strictly guarantees storagePath is omitted from all client-facing payloads (ADR-016, SECURITY §15).
 */
export function serializeMediaResponse(
  doc: MediaDocument,
  signedUrl?: string
): SerializedMediaResponse {
  const res: SerializedMediaResponse = {
    id: doc.id,
    ownerId: doc.ownerId,
    observationId: doc.observationId,
    type: doc.type,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    caption: doc.caption ?? null,
    createdAt: doc.createdAt,
  };
  if (signedUrl) {
    res.url = signedUrl;
  }
  return res;
}
