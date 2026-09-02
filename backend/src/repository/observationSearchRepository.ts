import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";

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

    await docRef.set(
      {
        ownerId: uid,
        observationId,
        searchableText,
        updatedAt: now,
        indexedAt: now,
      },
      { merge: true }
    );
  }

  async delete(uid: string, observationId: string): Promise<void> {
    const docRef = this.getDocRef(uid, observationId);
    await docRef.delete();
  }
}

export const observationSearchRepository = new ObservationSearchRepository();
