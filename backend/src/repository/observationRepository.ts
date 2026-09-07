import { FieldValue, FieldPath, Timestamp } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import {
  CreateObservationDTO,
  UpdateObservationDTO,
  ListObservationsQueryDTO,
  MeasurementDTO,
  LocationDTO,
} from "../schemas/observationSchema";
import { assertCursorSort, decodeCursor, encodeCursor, PaginationMeta } from "../schemas/paginationSchema";
import { observationSearchRepository } from "./observationSearchRepository";
import { observationVersionRepository } from "./observationVersionRepository";
import { projectRepository } from "./projectRepository";
import { AppError } from "../types/errors";
import { serializeTimestamps } from "../lib/serialize";
import { logger } from "../lib/logger";
import { getStorageService } from "../storage/storageService";
import { observationStoragePrefix } from "../storage/storagePaths";

export interface ObservationDocument {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  description: string;
  notes: string | null;
  hypothesis: string | null;
  observedAt: string | Timestamp;
  location: LocationDTO | null;
  tags: string[];
  measurements: MeasurementDTO[];
  status: "draft" | "observed" | "analyzed" | "archived";
  mediaCount: number;
  version: number;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export class ObservationRepository {
  private getCollection(uid: string) {
    return getFirebaseFirestore().collection("users").doc(uid).collection("observations");
  }

  async create(uid: string, data: CreateObservationDTO): Promise<ObservationDocument> {
    // Validate project ownership if projectId is specified
    if (data.projectId) {
      const project = await projectRepository.findById(uid, data.projectId);
      if (!project) {
        throw new AppError("VALIDATION_ERROR", `Referenced project '${data.projectId}' does not exist.`);
      }
    }

    const docRef = this.getCollection(uid).doc();
    const now = FieldValue.serverTimestamp();

    // Assign measurement IDs if missing
    const measurementsWithIds = (data.measurements ?? []).map((m, idx) => ({
      ...m,
      id: m.id || `m_${Date.now()}_${idx}`,
    }));

    const observedAtTimestamp = data.observedAt
      ? Timestamp.fromDate(new Date(data.observedAt))
      : Timestamp.now();

    const newObservation = {
      ownerId: uid,
      projectId: data.projectId ?? null,
      title: data.title,
      description: data.description,
      notes: data.notes ?? null,
      hypothesis: data.hypothesis ?? null,
      observedAt: observedAtTimestamp,
      location: data.location ?? null,
      tags: data.tags ?? [],
      measurements: measurementsWithIds,
      status: data.status ?? "observed",
      mediaCount: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newObservation);

    // Sync derived search index entry (ADR-017) — best effort, never fails canonical write
    try {
      await observationSearchRepository.upsert(uid, docRef.id, {
        title: data.title,
        description: data.description,
        notes: data.notes,
        hypothesis: data.hypothesis,
        tags: data.tags,
        measurements: measurementsWithIds,
      });
    } catch (err) {
      logger.warn({ err, uid, observationId: docRef.id }, "Failed to update observation search index on create");
    }

    const snap = await docRef.get();
    return { id: docRef.id, ...serializeTimestamps(snap.data() as Omit<ObservationDocument, "id">) };
  }

  async list(
    uid: string,
    query: ListObservationsQueryDTO
  ): Promise<{ data: ObservationDocument[]; meta: PaginationMeta }> {
    const limit = query.limit || 20;
    const sortField = query.sort === "observed" ? "observedAt" : "updatedAt";

    let dbQuery = this.getCollection(uid).orderBy(sortField, "desc");

    if (query.projectId) {
      if (query.projectId === "unfiled" || query.projectId === "null") {
        dbQuery = dbQuery.where("projectId", "==", null);
      } else {
        dbQuery = dbQuery.where("projectId", "==", query.projectId);
      }
    }

    if (query.status) {
      dbQuery = dbQuery.where("status", "==", query.status);
    }

    if (query.tag) {
      const tagValue = Array.isArray(query.tag) ? query.tag[0] : query.tag;
      if (tagValue) {
        dbQuery = dbQuery.where("tags", "array-contains", tagValue);
      }
    }

    const cursor = decodeCursor(query.cursor);
    // API.md §5.3: cursors are bound to the sort they were minted with —
    // mixing sorts between pages is a VALIDATION_ERROR, never a silent
    // mis-ordered page.
    assertCursorSort(cursor, sortField);
    if (cursor) {
      const cursorDoc = await this.getCollection(uid).doc(cursor.id).get();
      if (cursorDoc.exists) {
        dbQuery = dbQuery.startAfter(cursorDoc);
      }
    }

    // q is a server-side text prefilter (API.md §6.5). It must not depend on
    // page position: without the loop, an in-memory filter AFTER limit
    // silently truncates (returns < limit matches while more exist). We
    // therefore keep fetching Firestore pages until `limit` documents match
    // or the collection is exhausted. The bound below caps the work per
    // request; the derived index powers quality retrieval later (Phase 6).
    const qLower = query.q ? query.q.toLowerCase() : null;
    const MAX_SCAN = 500;

    const data: ObservationDocument[] = [];
    let hasMore = false;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let scanned = 0;
    let exhausted = false;

    while (data.length < limit && !exhausted && scanned < MAX_SCAN) {
      const pageQuery: FirebaseFirestore.Query = lastDoc
        ? dbQuery.startAfter(lastDoc)
        : dbQuery;
      const pageSize = qLower ? Math.max(limit, 50) : limit + 1;
      const snapshot: FirebaseFirestore.QuerySnapshot = await pageQuery.limit(pageSize).get();
      const docs = snapshot.docs;
      scanned += docs.length;

      if (docs.length === 0) {
        exhausted = true;
        break;
      }

      for (const d of docs) {
        if (qLower) {
          const docData = d.data();
          const searchable = [
            docData.title,
            docData.description,
            docData.notes,
            docData.hypothesis,
            ...((docData.tags as string[] | undefined) ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!searchable.includes(qLower)) continue;
        }
        if (data.length === limit) {
          // One match beyond the page — there is more after this page.
          hasMore = true;
          break;
        }
        data.push({
          id: d.id,
          ...serializeTimestamps(d.data() as Omit<ObservationDocument, "id">),
        });
      }

      if (docs.length < pageSize) {
        exhausted = true;
      }
      lastDoc = docs[docs.length - 1]!;
    }

    // With q absent the loop is a single fetch; hasMore was set by the
    // limit+1 match above. With q present, "more" means we stopped with a
    // queued match or the scan cap hit while the source had more pages.
    if (qLower && !hasMore && scanned >= MAX_SCAN && !exhausted) {
      hasMore = true;
    }

    const resultDocs = data;

    let nextCursor: string | null = null;
    if (hasMore && resultDocs.length > 0) {
      const lastResult = resultDocs[resultDocs.length - 1]!;
      nextCursor = encodeCursor({
        id: lastResult.id,
        sortField,
        sortValue: lastResult[sortField as keyof ObservationDocument]
          ? String(lastResult[sortField as keyof ObservationDocument])
          : "",
      });
    }

    return {
      data: resultDocs,
      meta: {
        nextCursor,
        hasMore,
        limit,
      },
    };
  }

  async findById(uid: string, observationId: string): Promise<ObservationDocument | null> {
    const snap = await this.getCollection(uid).doc(observationId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...serializeTimestamps(snap.data() as Omit<ObservationDocument, "id">) };
  }

  async update(
    uid: string,
    observationId: string,
    patch: UpdateObservationDTO,
    editedBy: string
  ): Promise<ObservationDocument> {
    const docRef = this.getCollection(uid).doc(observationId);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new AppError("NOT_FOUND", "Observation not found");
    }

    const currentData = existing.data() as Omit<ObservationDocument, "id">;

    // Optimistic locking check
    if (patch.expectedVersion !== undefined && patch.expectedVersion !== currentData.version) {
      throw new AppError(
        "CONFLICT",
        `Version conflict: observation current version is ${currentData.version}, expected ${patch.expectedVersion}.`
      );
    }

    // Validate project ownership if changing projectId
    if (patch.projectId) {
      const project = await projectRepository.findById(uid, patch.projectId);
      if (!project) {
        throw new AppError("VALIDATION_ERROR", `Referenced project '${patch.projectId}' does not exist.`);
      }
    }

    // Internal snapshot creation prior to edit (ADR-016)
    await observationVersionRepository.createSnapshot(uid, observationId, {
      version: currentData.version,
      title: currentData.title,
      description: currentData.description,
      hypothesis: currentData.hypothesis,
      measurements: currentData.measurements,
      editedBy,
      changeReason: "Observation edited",
    });

    const updateData: Record<string, unknown> = {
      version: currentData.version + 1,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.description !== undefined) updateData.description = patch.description;
    if (patch.projectId !== undefined) updateData.projectId = patch.projectId ?? null;
    if (patch.notes !== undefined) updateData.notes = patch.notes ?? null;
    if (patch.hypothesis !== undefined) updateData.hypothesis = patch.hypothesis ?? null;
    if (patch.location !== undefined) updateData.location = patch.location ?? null;
    if (patch.tags !== undefined) updateData.tags = patch.tags;
    if (patch.status !== undefined) updateData.status = patch.status;

    if (patch.observedAt !== undefined) {
      updateData.observedAt = patch.observedAt
        ? Timestamp.fromDate(new Date(patch.observedAt))
        : currentData.observedAt;
    }

    if (patch.measurements !== undefined) {
      updateData.measurements = patch.measurements.map((m, idx) => ({
        ...m,
        id: m.id || `m_${Date.now()}_${idx}`,
      }));
    }

    await docRef.update(updateData);

    const updatedSnap = await docRef.get();
    const updatedData = updatedSnap.data() as Omit<ObservationDocument, "id">;

    // Update derived search index — best effort, never fails canonical write
    try {
      await observationSearchRepository.upsert(uid, observationId, {
        title: updatedData.title,
        description: updatedData.description,
        notes: updatedData.notes,
        hypothesis: updatedData.hypothesis,
        tags: updatedData.tags,
        measurements: updatedData.measurements,
      });
    } catch (err) {
      logger.warn({ err, uid, observationId }, "Failed to update observation search index on update");
    }

    return { id: updatedSnap.id, ...serializeTimestamps(updatedData) };
  }

  async delete(uid: string, observationId: string): Promise<void> {
    const docRef = this.getCollection(uid).doc(observationId);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new AppError("NOT_FOUND", "Observation not found");
    }

    // 1. Delete versions subcollection
    const versionsSnap = await docRef.collection("versions").get();
    if (!versionsSnap.empty) {
      const batch = getFirebaseFirestore().batch();
      versionsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 2. Delete media subcollection
    const mediaSnap = await docRef.collection("media").get();
    if (!mediaSnap.empty) {
      const batch = getFirebaseFirestore().batch();
      mediaSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // 2b. Delete associated Cloud Storage objects (ADR-016 / §19 cascade).
    // Metadata is already committed above, so binaries are cleaned best-effort:
    // a transient storage failure must never fail the canonical delete. Skipped
    // entirely when mediaCount is 0 (no objects can exist under the prefix).
    const mediaCount = (existing.data()?.mediaCount as number | undefined) ?? 0;
    if (mediaCount > 0) {
      try {
        await getStorageService().deletePrefix(
          observationStoragePrefix(uid, observationId)
        );
      } catch (err) {
        logger.warn({ err, uid, observationId }, "Failed to delete observation storage objects");
      }
    }

    // 3. Delete search index document (ADR-017) — best effort, never fails canonical delete
    try {
      await observationSearchRepository.delete(uid, observationId);
    } catch (err) {
      logger.warn({ err, uid, observationId }, "Failed to delete observation search index entry");
    }

    // 4. Delete the observation document
    await docRef.delete();
  }

  async findByIds(uid: string, ids: string[]): Promise<ObservationDocument[]> {
    if (!ids || ids.length === 0) return [];
    const uniqueIds = Array.from(new Set(ids));
    const results: ObservationDocument[] = [];
    const CHUNK_SIZE = 30;

    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const snap = await this.getCollection(uid)
        .where(FieldPath.documentId(), "in", chunk)
        .get();
      for (const doc of snap.docs) {
        results.push({ id: doc.id, ...serializeTimestamps(doc.data() as Omit<ObservationDocument, "id">) });
      }
    }
    return results;
  }

  async markAsAnalyzed(uid: string, observationIds: string[]): Promise<void> {
    if (!observationIds || observationIds.length === 0) return;
    // Existence-filter first: an observation deleted between analysis start
    // and write-back must not fail the whole batch (the analysis is already
    // persisted — RETAIN semantics tolerate the dangling reference; the
    // write-back must not turn success into an inconsistent partial state).
    const existingDocs = await this.findByIds(uid, observationIds);
    if (existingDocs.length === 0) return;

    const batch = getFirebaseFirestore().batch();
    for (const doc of existingDocs) {
      const ref = this.getCollection(uid).doc(doc.id);
      batch.update(ref, {
        status: "analyzed",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

export const observationRepository = new ObservationRepository();
