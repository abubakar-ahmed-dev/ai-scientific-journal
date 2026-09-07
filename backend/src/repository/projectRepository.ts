import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import { CreateProjectDTO, UpdateProjectDTO, ListProjectsQueryDTO } from "../schemas/projectSchema";
import { assertCursorSort, decodeCursor, encodeCursor, PaginationMeta } from "../schemas/paginationSchema";
import { serializeTimestamps } from "../lib/serialize";
import { logger } from "../lib/logger";
import { AppError } from "../types/errors";

export interface ProjectDeleteSummary {
  observations: number;
  conversations: number;
  researchTasks: number;
}

export interface ProjectDocument {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  field: string | null;
  status: "active" | "archived" | "completed";
  tags: string[];
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
  archivedAt: string | Timestamp | null;
}

export class ProjectRepository {
  private getCollection(uid: string) {
    return getFirebaseFirestore().collection("users").doc(uid).collection("projects");
  }

  async create(uid: string, data: CreateProjectDTO): Promise<ProjectDocument> {
    const docRef = this.getCollection(uid).doc();
    const now = FieldValue.serverTimestamp();

    const newProject = {
      ownerId: uid,
      title: data.title,
      description: data.description ?? null,
      field: data.field ?? null,
      status: "active" as const,
      tags: data.tags ?? [],
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };

    await docRef.set(newProject);
    const snap = await docRef.get();
    return { id: docRef.id, ...serializeTimestamps(snap.data() as Omit<ProjectDocument, "id">) };
  }

  async list(
    uid: string,
    query: ListProjectsQueryDTO
  ): Promise<{ data: ProjectDocument[]; meta: PaginationMeta }> {
    const limit = query.limit || 20;
    let dbQuery = this.getCollection(uid).orderBy("updatedAt", "desc");

    if (query.status) {
      dbQuery = dbQuery.where("status", "==", query.status);
    }

    const cursor = decodeCursor(query.cursor);
    // API.md §5.3: cursors are bound to the sort they were minted with.
    assertCursorSort(cursor, "updatedAt");
    if (cursor) {
      const cursorDoc = await this.getCollection(uid).doc(cursor.id).get();
      if (cursorDoc.exists) {
        dbQuery = dbQuery.startAfter(cursorDoc);
      }
    }

    // Fetch limit + 1 to determine hasMore
    const snapshot = await dbQuery.limit(limit + 1).get();
    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    const data: ProjectDocument[] = resultDocs.map((d) => ({
      id: d.id,
      ...serializeTimestamps(d.data() as Omit<ProjectDocument, "id">),
    }));

    let nextCursor: string | null = null;
    if (hasMore && resultDocs.length > 0) {
      const lastDoc = resultDocs[resultDocs.length - 1]!;
      nextCursor = encodeCursor({
        id: lastDoc.id,
        sortField: "updatedAt",
        sortValue: lastDoc.get("updatedAt") ? String(lastDoc.get("updatedAt")) : "",
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

  async findById(uid: string, projectId: string): Promise<ProjectDocument | null> {
    const snap = await this.getCollection(uid).doc(projectId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...serializeTimestamps(snap.data() as Omit<ProjectDocument, "id">) };
  }

  async update(uid: string, projectId: string, patch: UpdateProjectDTO): Promise<ProjectDocument> {
    const docRef = this.getCollection(uid).doc(projectId);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new AppError("NOT_FOUND", "Project not found");
    }

    const currentData = existing.data() as Omit<ProjectDocument, "id">;
    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.description !== undefined) updateData.description = patch.description ?? null;
    if (patch.field !== undefined) updateData.field = patch.field ?? null;
    if (patch.tags !== undefined) updateData.tags = patch.tags;

    if (patch.status !== undefined) {
      updateData.status = patch.status;
      if (patch.status === "archived" && currentData.status !== "archived") {
        updateData.archivedAt = FieldValue.serverTimestamp();
      } else if (patch.status !== "archived" && currentData.status === "archived") {
        updateData.archivedAt = null;
      }
    }

    await docRef.update(updateData);
    const updatedSnap = await docRef.get();
    return { id: updatedSnap.id, ...serializeTimestamps(updatedSnap.data() as Omit<ProjectDocument, "id">) };
  }

  async delete(uid: string, projectId: string): Promise<ProjectDeleteSummary> {
    const docRef = this.getCollection(uid).doc(projectId);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new AppError("NOT_FOUND", "Project not found");
    }

    // Side effects per API.md §6.4 / DATABASE_SCHEMA §19: observations,
    // conversations, and research tasks referencing the project are re-filed
    // to `projectId: null` (unfiled — never deleted); analyses retain their
    // historical projectId. Children are re-filed BEFORE the project doc is
    // deleted: a mid-cascade failure then leaves the project (and all
    // references) intact and the delete retryable, instead of children
    // dangling at a nonexistent project.
    const summary: ProjectDeleteSummary = {
      observations: await this.refileChildren(uid, "observations", projectId),
      conversations: await this.refileChildren(uid, "conversations", projectId),
      researchTasks: await this.refileChildren(uid, "researchTasks", projectId),
    };

    await docRef.delete();
    logger.info({ uid, projectId, ...summary }, "Project deleted; children re-filed");
    return summary;
  }

  // Re-files children in batches, re-querying per chunk so a concurrent
  // create/update between chunks is re-filed too instead of silently
  // overwritten from a stale snapshot. Firestore batch limit is 500; 450
  // leaves headroom.
  private async refileChildren(
    uid: string,
    collectionName: "observations" | "conversations" | "researchTasks",
    projectId: string
  ): Promise<number> {
    const coll = getFirebaseFirestore().collection("users").doc(uid).collection(collectionName);
    let total = 0;
    for (;;) {
      const snap = await coll.where("projectId", "==", projectId).limit(450).get();
      if (snap.empty) break;
      const batch = getFirebaseFirestore().batch();
      snap.docs.forEach((d) => {
        batch.update(d.ref, {
          projectId: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      total += snap.size;
      if (snap.size < 450) break;
    }
    return total;
  }
}

export const projectRepository = new ProjectRepository();
