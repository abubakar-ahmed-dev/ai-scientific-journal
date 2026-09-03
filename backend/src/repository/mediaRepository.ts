import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import { serializeTimestamps } from "../lib/serialize";
import { AppError } from "../types/errors";
import { logger } from "../lib/logger";
import { mediaStoragePath } from "../storage/storagePaths";

export interface MediaDocument {
  id: string;
  ownerId: string;
  observationId: string;
  type: "image" | "audio" | "video";
  storagePath: string; // internal only
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  createdAt: string;
  idempotencyKey?: string;
}

export interface CreateMediaData {
  type: "image" | "audio" | "video";
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
  mediaId?: string;
  idempotencyKey?: string;
}

export class MediaRepository {
  private getMediaCollection(uid: string, observationId: string) {
    return getFirebaseFirestore()
      .collection("users")
      .doc(uid)
      .collection("observations")
      .doc(observationId)
      .collection("media");
  }

  private getObservationDoc(uid: string, observationId: string) {
    return getFirebaseFirestore()
      .collection("users")
      .doc(uid)
      .collection("observations")
      .doc(observationId);
  }

  private toMediaDocument(id: string, raw: Record<string, unknown>): MediaDocument {
    const serialized = serializeTimestamps(raw);
    return {
      id,
      ownerId: serialized.ownerId as string,
      observationId: serialized.observationId as string,
      type: serialized.type as "image" | "audio" | "video",
      storagePath: serialized.storagePath as string,
      fileName: serialized.fileName as string,
      mimeType: serialized.mimeType as string,
      sizeBytes: serialized.sizeBytes as number,
      caption: (serialized.caption as string | null) ?? null,
      createdAt:
        typeof serialized.createdAt === "string" ? serialized.createdAt : new Date().toISOString(),
      ...(typeof serialized.idempotencyKey === "string"
        ? { idempotencyKey: serialized.idempotencyKey }
        : {}),
    };
  }

  async create(uid: string, observationId: string, data: CreateMediaData): Promise<MediaDocument> {
    const obsRef = this.getObservationDoc(uid, observationId);
    const obsSnap = await obsRef.get();
    if (!obsSnap.exists) {
      throw new AppError("NOT_FOUND", `Observation '${observationId}' not found`);
    }

    const collection = this.getMediaCollection(uid, observationId);
    const docRef = data.mediaId ? collection.doc(data.mediaId) : collection.doc();
    const mediaId = docRef.id;

    // Storage path derived in one place (ADR-016: NO 'media/' segment)
    const storagePath = mediaStoragePath(uid, observationId, mediaId);
    const now = FieldValue.serverTimestamp();

    const mediaDocData: Record<string, unknown> = {
      ownerId: uid,
      observationId,
      type: data.type,
      storagePath,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      caption: data.caption ?? null,
      createdAt: now,
    };
    if (data.idempotencyKey) mediaDocData.idempotencyKey = data.idempotencyKey;

    const batch = getFirebaseFirestore().batch();
    batch.set(docRef, mediaDocData);
    batch.update(obsRef, {
      mediaCount: FieldValue.increment(1),
      updatedAt: now,
    });

    await batch.commit();

    const snap = await docRef.get();
    return this.toMediaDocument(snap.id, snap.data() as Record<string, unknown>);
  }

  /**
   * API.md §4.2 / §6.8: idempotent uploads. Looks up the caller's earlier
   * media record stored with the same Idempotency-Key (scoped per user +
   * observation; keys are privacy-safe and never logged with payloads).
   */
  async findByUserKey(
    uid: string,
    observationId: string,
    idempotencyKey: string
  ): Promise<MediaDocument | null> {
    const snapshot = await this.getMediaCollection(uid, observationId)
      .where("ownerId", "==", uid)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(2)
      .get();

    if (snapshot.empty) return null;
    const docs = snapshot.docs;
    if (docs.length > 1) {
      const [first, second] = docs;
      const firstDoc = first!.data() as Record<string, unknown>;
      const secondDoc = second!.data() as Record<string, unknown>;
      // A duplicate key with different content is a conflict per API.md §4.2.
      if (
        firstDoc.fileName !== secondDoc.fileName ||
        firstDoc.sizeBytes !== secondDoc.sizeBytes
      ) {
        throw new AppError(
          "CONFLICT",
          "Idempotency-Key was already used with a different request body."
        );
      }
    }
    const doc = docs[0]!;
    return this.toMediaDocument(doc.id, doc.data() as Record<string, unknown>);
  }

  async findById(uid: string, observationId: string, mediaId: string): Promise<MediaDocument | null> {
    const docRef = this.getMediaCollection(uid, observationId).doc(mediaId);
    const snap = await docRef.get();
    if (!snap.exists || !snap.data()) return null;
    return this.toMediaDocument(snap.id, snap.data() as Record<string, unknown>);
  }

  async listByObservationId(uid: string, observationId: string): Promise<MediaDocument[]> {
    const snapshot = await this.getMediaCollection(uid, observationId).get();
    if (snapshot.empty) return [];

    const items = snapshot.docs.map((doc) =>
      this.toMediaDocument(doc.id, doc.data() as Record<string, unknown>)
    );

    // Sort by createdAt ASC
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return items;
  }

  async delete(uid: string, observationId: string, mediaId: string): Promise<boolean> {
    const docRef = this.getMediaCollection(uid, observationId).doc(mediaId);
    const snap = await docRef.get();
    if (!snap.exists) return false;

    const obsRef = this.getObservationDoc(uid, observationId);
    const batch = getFirebaseFirestore().batch();
    batch.delete(docRef);
    batch.update(obsRef, {
      mediaCount: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (err) {
      // The parent observation may have been hard-deleted concurrently
      // (its own cascade removes media metadata). The media record and its
      // storage object are then already gone — treat as deleted rather than
      // surfacing a raw FirebaseError as a 500.
      logger.warn({ err, uid, observationId, mediaId }, "Media delete batch failed; parent may be gone");
      const obsCheck = await obsRef.get();
      if (!obsCheck.exists) return true;
      throw err;
    }
    return true;
  }

  async countByObservationId(uid: string, observationId: string): Promise<number> {
    const snapshot = await this.getMediaCollection(uid, observationId).get();
    return snapshot.size;
  }
}

export const mediaRepository = new MediaRepository();
