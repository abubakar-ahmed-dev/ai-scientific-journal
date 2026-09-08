import { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import { Readable } from "stream";
import { userRepository, UserDocument } from "../repository/userRepository";
import { UpdateUserSchema } from "../schemas/userSchema";
import { validateFileConsistency } from "../schemas/mediaSchema";
import { avatarUpload, AVATAR_MAX_SIZE_BYTES } from "../middleware/avatarUpload";
import { mediaRateLimiter } from "../middleware/rateLimiter";
import { getStorageService } from "../storage/storageService";
import { avatarStoragePath } from "../storage/storagePaths";
import { discardStagedFile, readFileHead } from "../lib/stagedUpload";
import { getFirebaseAuth } from "../lib/firebaseAdmin";
import { AppError, ErrorCode } from "../types/errors";
import { env } from "../config/env";
import { logger } from "../lib/logger";

export const meRouter = Router();

function requireUser(req: Request): { uid: string } {
  if (!req.user) {
    throw new AppError("UNAUTHENTICATED", "Unauthenticated request.");
  }
  return req.user;
}

// Every /me route ensures the user document exists: a first-ever PATCH or
// avatar call must not 500 just because GET /me never ran.
async function ensureUser(req: Request): Promise<void> {
  await userRepository.findOrCreateUser(req.user!.uid, { email: req.user!.email });
}

/**
 * Client-facing user shape (SECURITY: storage internals never leave the API).
 * `avatarUrl` is a fresh short-lived signed URL, present only when an avatar
 * exists — never a stable object path.
 */
async function serializeUser(user: UserDocument): Promise<Record<string, unknown>> {
  let avatarUrl: string | undefined;
  if (user.avatarPath) {
    try {
      avatarUrl = await getStorageService().getSignedReadUrl(
        user.avatarPath,
        env.MEDIA_SIGNED_URL_TTL_MINUTES
      );
    } catch (err) {
      // A broken avatar must not fail the whole profile response.
      logger.warn({ err, uid: user.ownerId }, "Failed to sign avatar URL for user response");
    }
  }
  return {
    ownerId: user.ownerId,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL ?? null,
    avatarUrl: avatarUrl ?? null,
    role: user.role,
    accountStatus: user.accountStatus,
    preferences: user.preferences,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

// GET /api/v1/me
meRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { uid } = requireUser(req);

    const user = await userRepository.findOrCreateUser(uid, {
      email: req.user!.email,
    });

    res.status(200).json({ data: await serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/me
meRouter.patch("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { uid } = requireUser(req);
    await ensureUser(req);

    const parseResult = UpdateUserSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");

      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR" as ErrorCode,
          message: `Validation failed: ${issues}`,
          requestId: req.requestId,
        },
      });
      return;
    }

    const user = await userRepository.updateUserProfile(uid, parseResult.data);

    // Propagate the display name into the Firebase Auth profile so surfaces
    // derived from the Auth record (and the Firebase console) stay consistent.
    // Firestore remains the source of truth: a secondary-write failure is
    // logged, never surfaced to the caller.
    if (parseResult.data.displayName) {
      try {
        await getFirebaseAuth().updateUser(uid, { displayName: parseResult.data.displayName });
      } catch (err) {
        logger.warn({ err, uid }, "Failed to propagate displayName to the Firebase Auth profile");
      }
    }

    res.status(200).json({ data: await serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/me/avatar — upload/replace the profile avatar
meRouter.patch(
  "/avatar",
  mediaRateLimiter,
  avatarUpload.single("file"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let stagedPath: string | undefined;
    try {
      const { uid } = requireUser(req);
      await ensureUser(req);

      if (!req.file) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Avatar file is required (multipart field 'file')"
        );
      }
      stagedPath = req.file.path;

      // Content-level validation (SECURITY §15): sniffed type must be an image
      // and agree with the declared MIME type and file extension.
      const head = await readFileHead(req.file.path, 64);
      const sniffedType = validateFileConsistency(head, req.file.mimetype, req.file.originalname);
      if (sniffedType !== "image") {
        throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Avatar must be an image.");
      }

      const storagePath = avatarStoragePath(uid);
      await getStorageService().uploadStream(
        storagePath,
        fs.createReadStream(req.file.path) as Readable,
        req.file.mimetype
      );

      const user = await userRepository.updateUserProfile(uid, { avatarPath: storagePath });

      res.status(200).json({ data: await serializeUser(user) });
    } catch (err) {
      next(err);
    } finally {
      discardStagedFile(stagedPath);
    }
  }
);

// DELETE /api/v1/me/avatar — remove the profile avatar
meRouter.delete(
  "/avatar",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { uid } = requireUser(req);
      await ensureUser(req);

      const user = await userRepository.updateUserProfile(uid, { avatarPath: null });
      // Best-effort binary cleanup after the authoritative metadata commit.
      // The fixed object name means a missed delete is overwritten by the next
      // upload and invisible to clients (avatarPath is already null).
      await getStorageService().delete(avatarStoragePath(uid)).catch((err) => {
        logger.warn({ err, uid }, "Failed to delete avatar object after metadata update");
      });

      res.status(200).json({ data: await serializeUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

// Multer errors (e.g. avatar over 2 MB) arrive as MulterError — normalize to
// the API error envelope with a 413.
meRouter.use(
  "/avatar",
  (err: unknown, _req: Request, res: Response, next: NextFunction): void => {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: {
          code: "PAYLOAD_TOO_LARGE" as ErrorCode,
          message: `Avatar exceeds the maximum allowed size of ${Math.round(AVATAR_MAX_SIZE_BYTES / (1024 * 1024))} MB`,
          requestId: _req.requestId,
        },
      });
      return;
    }
    next(err);
  }
);
