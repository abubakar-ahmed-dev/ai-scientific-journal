import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { detectMediaType } from "../schemas/mediaSchema";
import { AppError } from "../types/errors";
import { env } from "../config/env";

// Disk staging (not memoryStorage): multer streams the multipart body to a
// temp file, so a 100 MB video upload never sits in RAM. The route uploads
// the staged file to Cloud Storage as a stream and always deletes the temp
// file afterwards.
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `media-upload-${randomUUID()}${ext}`);
  },
});

export const mediaUpload = multer({
  storage,
  limits: {
    fileSize: env.MEDIA_MAX_VIDEO_SIZE_BYTES, // Upper boundary across all supported types
    files: 1,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const mediaType = detectMediaType(file.mimetype);
    if (!mediaType) {
      return cb(
        new AppError(
          "UNSUPPORTED_MEDIA_TYPE",
          `Unsupported media MIME type: '${file.mimetype}'. Supported formats: JPEG, PNG, WebP, HEIC, MP3, WAV, MP4.`
        )
      );
    }
    cb(null, true);
  },
});

// Cost guard that runs BEFORE multer parses the body: a client declaring a
// Content-Length above every per-type limit is rejected without reading the
// request. The per-type checks in the route remain the authoritative bound
// (they use the actual received size, not the declaration).
export function rejectOversizedContentLength(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > env.MEDIA_MAX_VIDEO_SIZE_BYTES) {
    next(
      new AppError(
        "PAYLOAD_TOO_LARGE",
        `File exceeds the maximum allowed upload size of ${Math.round(
          env.MEDIA_MAX_VIDEO_SIZE_BYTES / (1024 * 1024)
        )} MB`
      )
    );
    return;
  }
  next();
}
