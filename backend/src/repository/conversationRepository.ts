import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import { CreateConversationDTO, UpdateConversationDTO, ListConversationsQueryDTO } from "../schemas/conversationSchema";
import { decodeCursor, encodeCursor, PaginationMeta } from "../schemas/paginationSchema";
import { projectRepository } from "./projectRepository";
import { observationRepository } from "./observationRepository";
import { AppError } from "../types/errors";
import { serializeTimestamps } from "../lib/serialize";

export interface ConversationDocument {
  id: string;
  ownerId: string;
  projectId: string | null;
  title: string | null;
  contextType: "general" | "observation" | "project" | "research";
  contextId: string | null;
  messageCount: number;
  status: "active" | "archived";
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
}

export class ConversationRepository {
  private getCollection(uid: string) {
    return getFirebaseFirestore().collection("users").doc(uid).collection("conversations");
  }

  async create(uid: string, data: CreateConversationDTO): Promise<ConversationDocument> {
    // Validate project ownership if projectId is specified
    if (data.projectId) {
      const project = await projectRepository.findById(uid, data.projectId);
      if (!project) {
        throw new AppError("VALIDATION_ERROR", `Referenced project '${data.projectId}' does not exist.`);
      }
    }

    // Validate contextual entity ownership
    if (data.contextType === "observation" && data.contextId) {
      const obs = await observationRepository.findById(uid, data.contextId);
      if (!obs) {
        throw new AppError("VALIDATION_ERROR", `Referenced observation '${data.contextId}' does not exist.`);
      }
    } else if (data.contextType === "project" && data.contextId) {
      const proj = await projectRepository.findById(uid, data.contextId);
      if (!proj) {
        throw new AppError("VALIDATION_ERROR", `Referenced project '${data.contextId}' does not exist.`);
      }
    }

    const docRef = this.getCollection(uid).doc();
    const now = FieldValue.serverTimestamp();

    const newConversation = {
      ownerId: uid,
      projectId: data.projectId ?? null,
      title: data.title ?? null,
      contextType: data.contextType,
      contextId: data.contextId ?? null,
      messageCount: 0,
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(newConversation);
    const snap = await docRef.get();
    return { id: docRef.id, ...serializeTimestamps(snap.data() as Omit<ConversationDocument, "id">) };
  }

  async list(
    uid: string,
    query: ListConversationsQueryDTO
  ): Promise<{ data: ConversationDocument[]; meta: PaginationMeta }> {
    const limit = query.limit || 20;
    let dbQuery = this.getCollection(uid).orderBy("updatedAt", "desc");

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

    if (query.contextType) {
      dbQuery = dbQuery.where("contextType", "==", query.contextType);
    }

    const cursor = decodeCursor(query.cursor);
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

    const data: ConversationDocument[] = resultDocs.map((d) => ({
      id: d.id,
      ...serializeTimestamps(d.data() as Omit<ConversationDocument, "id">),
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

  async findById(uid: string, conversationId: string): Promise<ConversationDocument | null> {
    const snap = await this.getCollection(uid).doc(conversationId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...serializeTimestamps(snap.data() as Omit<ConversationDocument, "id">) };
  }

  async update(uid: string, conversationId: string, patch: UpdateConversationDTO): Promise<ConversationDocument> {
    const docRef = this.getCollection(uid).doc(conversationId);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new AppError("NOT_FOUND", "Conversation not found");
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (patch.title !== undefined) updateData.title = patch.title ?? null;
    if (patch.status !== undefined) updateData.status = patch.status;

    await docRef.update(updateData);
    const updatedSnap = await docRef.get();
    return { id: updatedSnap.id, ...serializeTimestamps(updatedSnap.data() as Omit<ConversationDocument, "id">) };
  }

  async incrementMessageCount(uid: string, conversationId: string, delta: number = 1): Promise<void> {
    const docRef = this.getCollection(uid).doc(conversationId);
    await docRef.update({
      messageCount: FieldValue.increment(delta),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async delete(uid: string, conversationId: string): Promise<void> {
    const docRef = this.getCollection(uid).doc(conversationId);
    const existing = await docRef.get();

    if (!existing.exists) {
      throw new AppError("NOT_FOUND", "Conversation not found");
    }

    // Cascade deletion to messages subcollection
    const messagesSnap = await docRef.collection("messages").get();
    if (!messagesSnap.empty) {
      const batch = getFirebaseFirestore().batch();
      messagesSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    // Delete conversation document (analyses referencing conversation are retained per ADR-021)
    await docRef.delete();
  }
}

export const conversationRepository = new ConversationRepository();
