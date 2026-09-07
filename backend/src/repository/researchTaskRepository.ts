import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import {
  CreateResearchTaskDTO,
  UpdateResearchTaskDTO,
  ListResearchTasksQueryDTO,
} from "../schemas/researchTaskSchema";
import { assertCursorSort, decodeCursor, encodeCursor, PaginationMeta } from "../schemas/paginationSchema";
import { analysisRepository } from "./analysisRepository";
import { projectRepository } from "./projectRepository";
import { observationRepository } from "./observationRepository";
import { AppError } from "../types/errors";
import { serializeTimestamps } from "../lib/serialize";

export interface ResearchTaskDocument {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string;
  description: string;
  source: "user" | "gemini";
  sourceAnalysisId: string | null;
  status: "suggested" | "planned" | "in_progress" | "completed" | "dismissed";
  relatedObservationIds: string[];
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  suggested: ["planned", "dismissed"],
  planned: ["in_progress", "dismissed", "suggested"],
  in_progress: ["completed", "planned", "dismissed"],
  completed: ["in_progress", "dismissed"],
  dismissed: ["suggested", "planned", "in_progress"],
};

export class ResearchTaskRepository {
  private getCollection(uid: string) {
    return getFirebaseFirestore().collection("users").doc(uid).collection("researchTasks");
  }

  /**
   * API.md §6.14: Idempotency-Key prevents double-accepting a suggestion.
   * Keys are stored on the task, scoped per user (privacy-safe, never logged).
   */
  async findByIdempotencyKey(uid: string, idempotencyKey: string): Promise<ResearchTaskDocument | null> {
    const snapshot = await this.getCollection(uid)
      .where("ownerId", "==", uid)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0]!;
    return { id: doc.id, ...serializeTimestamps(doc.data() as Omit<ResearchTaskDocument, "id">) };
  }

  async create(uid: string, data: CreateResearchTaskDTO, idempotencyKey?: string): Promise<ResearchTaskDocument> {
    const docRef = this.getCollection(uid).doc();
    const now = FieldValue.serverTimestamp();

    if (data.source === "user") {
      // Validate project if present
      if (data.projectId) {
        const project = await projectRepository.findById(uid, data.projectId);
        if (!project) {
          throw new AppError("VALIDATION_ERROR", `Referenced project '${data.projectId}' does not exist`);
        }
      }

      // Validate related observation IDs if present
      if (data.relatedObservationIds && data.relatedObservationIds.length > 0) {
        for (const obsId of data.relatedObservationIds) {
          const obs = await observationRepository.findById(uid, obsId);
          if (!obs) {
            throw new AppError("VALIDATION_ERROR", `Referenced observation '${obsId}' does not exist`);
          }
        }
      }

      const taskRecord: Record<string, unknown> = {
        ownerId: uid,
        projectId: data.projectId ?? null,
        title: data.title,
        description: data.description,
        source: "user" as const,
        sourceAnalysisId: null,
        status: "planned" as const,
        relatedObservationIds: data.relatedObservationIds ?? [],
        createdAt: now,
        updatedAt: now,
      };
      if (idempotencyKey) taskRecord.idempotencyKey = idempotencyKey;

      await docRef.set(taskRecord);
      const snap = await docRef.get();
      return { id: docRef.id, ...serializeTimestamps(snap.data() as Omit<ResearchTaskDocument, "id">) };
    } else {
      // source: "gemini" -> acceptance of an AI suggestion
      const analysis = await analysisRepository.findById(uid, data.sourceAnalysisId);
      if (!analysis) {
        throw new AppError("NOT_FOUND", `Source analysis '${data.sourceAnalysisId}' not found`);
      }

      const suggestions = analysis.suggestedNextSteps || [];
      if (data.suggestionIndex < 0 || data.suggestionIndex >= suggestions.length) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Suggestion index ${data.suggestionIndex} is out of bounds (analysis has ${suggestions.length} suggestions)`
        );
      }

      const stepText = suggestions[data.suggestionIndex]!;
      const targetProjectId = data.projectId ?? analysis.projectId;

      const taskRecord: Record<string, unknown> = {
        ownerId: uid,
        projectId: targetProjectId,
        title: stepText.length > 200 ? stepText.substring(0, 197) + "..." : stepText,
        description: `Accepted AI research suggestion: "${stepText}" (derived from ${analysis.type} analysis)`,
        source: "gemini" as const,
        sourceAnalysisId: analysis.id,
        status: "suggested" as const,
        relatedObservationIds: analysis.observationIds ?? [],
        createdAt: now,
        updatedAt: now,
      };
      if (idempotencyKey) taskRecord.idempotencyKey = idempotencyKey;

      await docRef.set(taskRecord);
      const snap = await docRef.get();
      return { id: docRef.id, ...serializeTimestamps(snap.data() as Omit<ResearchTaskDocument, "id">) };
    }
  }

  async list(
    uid: string,
    query: ListResearchTasksQueryDTO
  ): Promise<{ data: ResearchTaskDocument[]; meta: PaginationMeta }> {
    const limit = query.limit || 20;
    let dbQuery = this.getCollection(uid).orderBy("updatedAt", "desc");

    if (query.status) {
      dbQuery = dbQuery.where("status", "==", query.status);
    }

    if (query.projectId) {
      if (query.projectId === "unfiled" || query.projectId === "null") {
        dbQuery = dbQuery.where("projectId", "==", null);
      } else {
        dbQuery = dbQuery.where("projectId", "==", query.projectId);
      }
    }

    const cursor = decodeCursor(query.cursor);
    assertCursorSort(cursor, "updatedAt");
    if (cursor) {
      const cursorDoc = await this.getCollection(uid).doc(cursor.id).get();
      if (cursorDoc.exists) {
        dbQuery = dbQuery.startAfter(cursorDoc);
      }
    }

    const snapshot = await dbQuery.limit(limit + 1).get();
    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    const data: ResearchTaskDocument[] = resultDocs.map((d) => ({
      id: d.id,
      ...serializeTimestamps(d.data() as Omit<ResearchTaskDocument, "id">),
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

  async findById(uid: string, taskId: string): Promise<ResearchTaskDocument | null> {
    const snap = await this.getCollection(uid).doc(taskId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...serializeTimestamps(snap.data() as Omit<ResearchTaskDocument, "id">) };
  }

  async update(uid: string, taskId: string, patch: UpdateResearchTaskDTO): Promise<ResearchTaskDocument> {
    const docRef = this.getCollection(uid).doc(taskId);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new AppError("NOT_FOUND", "Research task not found");
    }

    const current = existing.data() as ResearchTaskDocument;

    // Validate status transition if status is being updated
    if (patch.status && patch.status !== current.status) {
      const allowed = VALID_TRANSITIONS[current.status] || [];
      if (!allowed.includes(patch.status)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Invalid task status transition from '${current.status}' to '${patch.status}'. Allowed: ${allowed.join(", ")}`
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.description !== undefined) updateData.description = patch.description;
    if (patch.status !== undefined) updateData.status = patch.status;
    if (patch.projectId !== undefined) {
      // Ownership of the target project validated like in create() — a null
      // projectId is a legal "move to Unfiled" operation.
      if (patch.projectId) {
        const project = await projectRepository.findById(uid, patch.projectId);
        if (!project) {
          throw new AppError(
            "VALIDATION_ERROR",
            `Referenced project '${patch.projectId}' does not exist`
          );
        }
      }
      updateData.projectId = patch.projectId;
    }
    if (patch.relatedObservationIds !== undefined) updateData.relatedObservationIds = patch.relatedObservationIds;

    await docRef.update(updateData);
    const updatedSnap = await docRef.get();
    return { id: updatedSnap.id, ...serializeTimestamps(updatedSnap.data() as Omit<ResearchTaskDocument, "id">) };
  }

  async delete(uid: string, taskId: string): Promise<void> {
    const docRef = this.getCollection(uid).doc(taskId);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new AppError("NOT_FOUND", "Research task not found");
    }

    await docRef.delete();
  }
}

export const researchTaskRepository = new ResearchTaskRepository();
