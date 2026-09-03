import { Router, Request, Response, NextFunction } from "express";
import { observationRepository, ObservationDocument } from "../repository/observationRepository";
import { mediaRepository } from "../repository/mediaRepository";
import { getStorageService } from "../storage/storageService";
import { mediaStoragePath } from "../storage/storagePaths";
import { mediaUpload } from "../middleware/mediaUpload";
import { mediaRateLimiter } from "../middleware/rateLimiter";
import {
  UploadMediaMetadataSchema,
  serializeMediaResponse,
  validateFileConsistency,
} from "../schemas/mediaSchema";
import { AppError } from "../types/errors";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { randomUUID } from "crypto";

export const mediaRouter = Router({ mergeParams: true });

// Shared ownership gate (API.md §6.8: 404 existence-hiding on foreign/missing)
async function requireOwnedObservation(uid: string, observationId: string): Promise<ObservationDocument> {
  const observation = await observationRepository.findById(uid, observationId);
  if (!observation) {
    throw new AppError("NOT_FOUND", `Observation '${observationId}' not found`);
  }
  return observation;
}

function getObservationId(req: Request): string {
  const obsId = Array.isArray(req.params.observationId)
    ? req.params.observationId[0]
    : req.params.observationId;
  if (!obsId) {
    throw new AppError("VALIDATION_ERROR", "observationId parameter is required");
  }
  return obsId;
}

function getMediaId(req: Request): string {
  const mediaId = Array.isArray(req.params.mediaId) ? req.params.mediaId[0] : req.params.mediaId;
  if (!mediaId) {
    throw new AppError("VALIDATION_ERROR", "mediaId parameter is required");
  }
  return mediaId;
}

const SIZE_LIMITS: Record<"image" | "audio" | "video", number> = {
  image: env.MEDIA_MAX_IMAGE_SIZE_BYTES,
  audio: env.MEDIA_MAX_AUDIO_SIZE_BYTES,
  video: env.MEDIA_MAX_VIDEO_SIZE_BYTES,
};

// POST /api/v1/observations/:observationId/media — API.md §6.8
mediaRouter.post(
  "/",
  mediaRateLimiter,
  mediaUpload.single("file"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uid = req.user!.uid;
      const observationId = getObservationId(req);

      // 1. Validate parent observation exists and belongs to caller
      await requireOwnedObservation(uid, observationId);

      // 2. Validate file presence
      if (!req.file) {
        throw new AppError("VALIDATION_ERROR", "Media file is required (multipart field 'file')");
      }

      // 2b. Reject uploads that declared a Content-Length above every per-type
      // limit before doing any validation work (early cost guard).
      const absoluteMax = Math.max(SIZE_LIMITS.image, SIZE_LIMITS.audio, SIZE_LIMITS.video);
      const declaredLength = Number(req.headers["content-length"] ?? req.file.size);
      if (Number.isFinite(declaredLength) && declaredLength > absoluteMax) {
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          `File exceeds the maximum allowed upload size of ${Math.round(absoluteMax / (1024 * 1024))} MB`
        );
      }

      // 3. Content-level validation (SECURITY §15): sniff magic bytes, require
      // agreement with the declared MIME type and the file extension.
      const mediaType = validateFileConsistency(
        req.file.buffer,
        req.file.mimetype,
        req.file.originalname
      );

      // 4. Per-type size limits (API.md §6.8: 10 MB / 25 MB / 100 MB)
      const sizeLimit = SIZE_LIMITS[mediaType];
      if (req.file.size > sizeLimit) {
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          `${mediaType[0]!.toUpperCase()}${mediaType.slice(1)} size exceeds maximum allowed limit of ${Math.round(
            sizeLimit / (1024 * 1024)
          )} MB`
        );
      }

      // 5. Validate metadata
      const metaParse = UploadMediaMetadataSchema.safeParse(req.body);
      if (!metaParse.success) {
        const issues = metaParse.error.issues.map((i) => i.message).join("; ");
        throw new AppError("VALIDATION_ERROR", `Validation failed: ${issues}`);
      }
      const caption = metaParse.data.caption ?? null;

      // API.md §4.2 / §6.8: Idempotency-Key — a retried upload with the same
      // key (same user + observation) returns the original result instead of
      // duplicating media. A reused key with a different file is a conflict.
      const idempotencyKey = req.header("Idempotency-Key")?.trim() || null;
      if (idempotencyKey) {
        const existing = await mediaRepository.findByUserKey(uid, observationId, idempotencyKey);
        if (existing) {
          if (existing.fileName !== req.file.originalname || existing.sizeBytes !== req.file.size) {
            throw new AppError(
              "CONFLICT",
              "Idempotency-Key was already used with a different request body."
            );
          }
          const replayUrl = await getStorageService().getSignedReadUrl(
            existing.storagePath,
            env.MEDIA_SIGNED_URL_TTL_MINUTES
          );
          res.status(200).json({ data: serializeMediaResponse(existing, replayUrl) });
          return;
        }
      }

      // 6. Generate mediaId and derive internal Cloud Storage path (ADR-016)
      const mediaId = `med_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const storagePath = mediaStoragePath(uid, observationId, mediaId);

      // 7. Upload binary to storage
      await getStorageService().upload(storagePath, req.file.buffer, req.file.mimetype);

      // 8. Write Firestore metadata record (with rollback on failure to prevent orphan objects)
      let mediaDoc;
      try {
        mediaDoc = await mediaRepository.create(uid, observationId, {
          mediaId,
          type: mediaType,
          fileName: req.file.originalname,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          caption,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        });
      } catch (err) {
        await getStorageService().delete(storagePath);
        throw err;
      }

      // 9. Generate short-lived signed read URL
      const signedUrl = await getStorageService().getSignedReadUrl(
        storagePath,
        env.MEDIA_SIGNED_URL_TTL_MINUTES
      );

      res.status(201).json({
        data: serializeMediaResponse(mediaDoc, signedUrl),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/observations/:observationId/media
mediaRouter.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const uid = req.user!.uid;
    const observationId = getObservationId(req);

    // Validate parent observation ownership
    await requireOwnedObservation(uid, observationId);

    const mediaList = await mediaRepository.listByObservationId(uid, observationId);
    const ttl = env.MEDIA_SIGNED_URL_TTL_MINUTES;

    const data = await Promise.all(
      mediaList.map(async (m) => {
        let signedUrl: string | undefined;
        try {
          signedUrl = await getStorageService().getSignedReadUrl(m.storagePath, ttl);
        } catch (err) {
          // One broken object must not break the whole gallery, but the
          // failure is logged (never silent) for observability.
          logger.warn({ err, mediaId: m.id }, "Failed to sign media URL for list response");
        }
        return serializeMediaResponse(m, signedUrl);
      })
    );

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/observations/:observationId/media/:mediaId
mediaRouter.get("/:mediaId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const uid = req.user!.uid;
    const observationId = getObservationId(req);
    const mediaId = getMediaId(req);

    await requireOwnedObservation(uid, observationId);

    const media = await mediaRepository.findById(uid, observationId, mediaId);
    if (!media) {
      throw new AppError("NOT_FOUND", `Media '${mediaId}' not found`);
    }

    const signedUrl = await getStorageService().getSignedReadUrl(
      media.storagePath,
      env.MEDIA_SIGNED_URL_TTL_MINUTES
    );

    res.status(200).json({
      data: serializeMediaResponse(media, signedUrl),
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/observations/:observationId/media/:mediaId
mediaRouter.delete("/:mediaId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const uid = req.user!.uid;
    const observationId = getObservationId(req);
    const mediaId = getMediaId(req);

    await requireOwnedObservation(uid, observationId);

    const media = await mediaRepository.findById(uid, observationId, mediaId);
    if (!media) {
      throw new AppError("NOT_FOUND", `Media '${mediaId}' not found`);
    }

    // Order per API.md §6.8 delete semantics: metadata first (authoritative
    // record + mediaCount decrement commit atomically), then best-effort
    // binary cleanup. Reversing the order let a failed Firestore commit strand
    // the metadata record pointing at an already-deleted binary.
    const deleted = await mediaRepository.delete(uid, observationId, mediaId);
    if (deleted) {
      try {
        await getStorageService().delete(media.storagePath);
      } catch (err) {
        logger.warn({ err, mediaId }, "Failed to delete media storage object after metadata delete");
      }
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
