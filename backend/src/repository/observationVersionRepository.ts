import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import { MeasurementDTO } from "../schemas/observationSchema";
import { assertCursorSort, decodeCursor, encodeCursor, PaginationMeta } from "../schemas/paginationSchema";
import { serializeTimestamps } from "../lib/serialize";

export interface ObservationVersionDocument {
  id: string;
  version: number;
  title: string;
  description: string;
  hypothesis: string | null;
  measurements: MeasurementDTO[];
  editedAt: string | Timestamp;
  editedBy: string;
  changeReason: string | null;
}

export class ObservationVersionRepository {
  private getCollection(uid: string, observationId: string) {
    return getFirebaseFirestore()
      .collection("users")
      .doc(uid)
      .collection("observations")
      .doc(observationId)
      .collection("versions");
  }

  async createSnapshot(
    uid: string,
    observationId: string,
    snapshot: {
      version: number;
      title: string;
      description: string;
      hypothesis?: string | null;
      measurements?: MeasurementDTO[];
      editedBy: string;
      changeReason?: string | null;
    }
  ): Promise<void> {
    const docRef = this.getCollection(uid, observationId).doc();
    const versionDoc = {
      version: snapshot.version,
      title: snapshot.title,
      description: snapshot.description,
      hypothesis: snapshot.hypothesis ?? null,
      measurements: snapshot.measurements ?? [],
      editedAt: FieldValue.serverTimestamp(),
      editedBy: snapshot.editedBy,
      changeReason: snapshot.changeReason ?? null,
    };
    await docRef.set(versionDoc);
  }

  async list(
    uid: string,
    observationId: string,
    limit: number = 20,
    cursorStr?: string
  ): Promise<{ data: ObservationVersionDocument[]; meta: PaginationMeta }> {
    let dbQuery = this.getCollection(uid, observationId).orderBy("editedAt", "desc");

    const cursor = decodeCursor(cursorStr);
    assertCursorSort(cursor, "editedAt");
    if (cursor) {
      const cursorDoc = await this.getCollection(uid, observationId).doc(cursor.id).get();
      if (cursorDoc.exists) {
        dbQuery = dbQuery.startAfter(cursorDoc);
      }
    }

    const snapshot = await dbQuery.limit(limit + 1).get();
    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    const data: ObservationVersionDocument[] = resultDocs.map((d) => ({
      id: d.id,
      ...serializeTimestamps(d.data() as Omit<ObservationVersionDocument, "id">),
    }));

    let nextCursor: string | null = null;
    if (hasMore && resultDocs.length > 0) {
      const lastDoc = resultDocs[resultDocs.length - 1]!;
      nextCursor = encodeCursor({
        id: lastDoc.id,
        sortField: "editedAt",
        sortValue: lastDoc.get("editedAt") ? String(lastDoc.get("editedAt")) : "",
      });
    }

    return {
      data,
      meta: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async findById(
    uid: string,
    observationId: string,
    versionId: string
  ): Promise<ObservationVersionDocument | null> {
    const snap = await this.getCollection(uid, observationId).doc(versionId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...serializeTimestamps(snap.data() as Omit<ObservationVersionDocument, "id">) };
  }
}

export const observationVersionRepository = new ObservationVersionRepository();
