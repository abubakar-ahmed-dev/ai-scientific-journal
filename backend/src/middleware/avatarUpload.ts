import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { Request } from "express";
import { AppError } from "../types/errors";

// Profile avatars are small fixed-purpose images: 2 MB covers any reasonable
// photo while keeping uploads and signed-URL loads snappy.
export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;

const AVATAR_IMAGE_MIME_PREFIXES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Disk staging, same rationale as mediaUpload: the body never sits in RAM.
// Declared-MIME filtering here is only an early gate; the authoritative check
// is magic-byte sniffing in the route (SECURITY §15).
export const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req: Request, _file, cb) => {
      cb(null, os.tmpdir());
    },
    filename: (_req: Request, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `avatar-upload-${randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: AVATAR_MAX_SIZE_BYTES,
    files: 1,
  },
  fileFilter: (_req: Request, file, cb) => {
    if (!AVATAR_IMAGE_MIME_PREFIXES.includes(file.mimetype.toLowerCase())) {
      return cb(
        new AppError(
          "UNSUPPORTED_MEDIA_TYPE",
          "Avatar must be a JPEG, PNG, WebP, or HEIC image."
        )
      );
    }
    cb(null, true);
  },
});
