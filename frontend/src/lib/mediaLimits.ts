// Media size limits (API.md §6.8). These mirror the backend's
// MEDIA_MAX_*_SIZE_BYTES defaults; the API contract fixes the limits so both
// sides stay in agreement. One module — do not retype literals in components.
export const MEDIA_SIZE_LIMITS: Record<"image" | "audio" | "video", number> = {
  image: 10 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  video: 100 * 1024 * 1024,
};

export function detectClientMediaType(mimeType: string): "image" | "audio" | "video" | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") return "video";
  return null;
}
