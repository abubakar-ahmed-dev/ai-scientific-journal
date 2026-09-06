import multer from "multer";
import { Request } from "express";
import { detectMediaType } from "../schemas/mediaSchema";
import { AppError } from "../types/errors";
import { env } from "../config/env";

const storage = multer.memoryStorage();

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
