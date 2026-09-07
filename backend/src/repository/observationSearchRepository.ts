import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import { logger } from "../lib/logger";

// Index writes are best-effort (never fail the canonical write) but transient
// Firestore errors should not immediately strand a stale entry — one retry
// with a short backoff before the caller's warn-only fallback.
const SEARCH_INDEX_WRITE_ATTEMPTS = 2;
const SEARCH_INDEX_RETRY_DELAY_MS = 100;

export interface ObservationSearchDocument {
  ownerId: string;
  observationId: string;
  searchableText: string;
  updatedAt: FieldValue | string;
  indexedAt: FieldValue | string;
}

export class ObservationSearchRepository {
  private getDocRef(uid: string, observationId: string) {
    return getFirebaseFirestore()
      .collection("users")
      .doc(uid)
      .collection("observationSearch")
      .doc(observationId);
  }

  buildSearchableText(data: {
    title: string;
    description: string;
    notes?: string | null;
    hypothesis?: string | null;
    tags?: string[];
    measurements?: Array<{ name: string; unit: string }>;
  }): string {
    const parts = [
      data.title,
      data.description,
      data.notes ?? "",
      data.hypothesis ?? "",
      (data.tags ?? []).join(" "),
      (data.measurements ?? []).map((m) => `${m.name} ${m.unit}`).join(" "),
    ];
    return parts.filter(Boolean).join(" ").toLowerCase();
  }

  private async withRetry<T>(op: () => Promise<T>, what: string): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= SEARCH_INDEX_WRITE_ATTEMPTS; attempt++) {
      try {
        return await op();
      } catch (err) {
        lastErr = err;
        logger.warn({ err, what, attempt }, "Observation search index write failed");
        if (attempt < SEARCH_INDEX_WRITE_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, SEARCH_INDEX_RETRY_DELAY_MS * attempt));
        }
      }
    }
    throw lastErr;
  }

  async upsert(
    uid: string,
    observationId: string,
    data: {
      title: string;
      description: string;
      notes?: string | null;
      hypothesis?: string | null;
      tags?: string[];
      measurements?: Array<{ name: string; unit: string }>;
    }
  ): Promise<void> {
    const docRef = this.getDocRef(uid, observationId);
    const searchableText = this.buildSearchableText(data);
    const now = FieldValue.serverTimestamp();

    await this.withRetry(
      () =>
        docRef.set(
          {
            ownerId: uid,
            observationId,
            searchableText,
            updatedAt: now,
            indexedAt: now,
          },
          { merge: true }
        ),
      `upsert ${observationId}`
    );
  }

  async delete(uid: string, observationId: string): Promise<void> {
    const docRef = this.getDocRef(uid, observationId);
    await this.withRetry(() => docRef.delete(), `delete ${observationId}`);
  }
}

export const observationSearchRepository = new ObservationSearchRepository();
