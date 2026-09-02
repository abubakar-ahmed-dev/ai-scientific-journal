import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import { decodeCursor, encodeCursor, PaginationMeta } from "../schemas/paginationSchema";
import { serializeTimestamps } from "../lib/serialize";
import { AppError } from "../types/errors";

export interface MessageDocument {
  id: string;
  ownerId: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sequence: number;
  model?: string;
  metadata?: Record<string, unknown>;
  createdAt: string | Timestamp;
}

export class MessageRepository {
  private getCollection(uid: string, conversationId: string) {
    return getFirebaseFirestore()
      .collection("users")
      .doc(uid)
      .collection("conversations")
      .doc(conversationId)
      .collection("messages");
  }

  async create(
    uid: string,
    conversationId: string,
    data: {
      role: "user" | "assistant" | "system";
      content: string;
      sequence: number;
      model?: string;
      metadata?: Record<string, unknown>;
      idempotencyKey?: string;
    }
  ): Promise<MessageDocument> {
    const docRef = this.getCollection(uid, conversationId).doc();
    const now = FieldValue.serverTimestamp();

    const newMsg: Record<string, unknown> = {
      ownerId: uid,
      conversationId,
      role: data.role,
      content: data.content,
      sequence: data.sequence,
      createdAt: now,
    };

    if (data.model) newMsg.model = data.model;
    if (data.metadata) newMsg.metadata = data.metadata;
    if (data.idempotencyKey) newMsg.idempotencyKey = data.idempotencyKey;

    await docRef.set(newMsg);
    const snap = await docRef.get();
    return { id: docRef.id, ...serializeTimestamps(snap.data() as Omit<MessageDocument, "id">) };
  }

  /**
   * API.md §4.2: an Idempotency-Key retry after AI failure must regenerate the
   * missing assistant turn without duplicating the user message. We detect the
   * retry by looking up the caller's earlier user message stored with the same
   * key (keys are scoped per user+conversation, privacy-safe, never logged).
   */
  async findByUserKey(
    uid: string,
    conversationId: string,
    idempotencyKey: string
  ): Promise<MessageDocument | null> {
    const snapshot = await this.getCollection(uid, conversationId)
      .where("ownerId", "==", uid)
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(2)
      .get();

    if (snapshot.empty) return null;
    const docs = snapshot.docs;
    // A duplicate key with different content is a conflict per API.md §4.2;
    // surface both matches so the route can decide.
    if (docs.length > 1) {
      const [first, second] = docs;
      if (first!.data().content !== second!.data().content) {
        throw new AppError("CONFLICT", "Idempotency-Key was already used with a different request body.");
      }
    }
    const doc = docs[0]!;
    return { id: doc.id, ...serializeTimestamps(doc.data() as Omit<MessageDocument, "id">) };
  }

  async list(
    uid: string,
    conversationId: string,
    limit: number = 50,
    cursorStr?: string
  ): Promise<{ data: MessageDocument[]; meta: PaginationMeta & { prevCursor?: string | null } }> {
    let dbQuery = this.getCollection(uid, conversationId).orderBy("sequence", "asc");

    const cursor = decodeCursor(cursorStr);
    if (cursor) {
      const cursorDoc = await this.getCollection(uid, conversationId).doc(cursor.id).get();
      if (cursorDoc.exists) {
        dbQuery = dbQuery.startAfter(cursorDoc);
      }
    }

    const snapshot = await dbQuery.limit(limit + 1).get();
    const docs = snapshot.docs;
    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    const data: MessageDocument[] = resultDocs.map((d) => ({
      id: d.id,
      ...serializeTimestamps(d.data() as Omit<MessageDocument, "id">),
    }));

    let nextCursor: string | null = null;
    if (hasMore && resultDocs.length > 0) {
      const lastDoc = resultDocs[resultDocs.length - 1]!;
      nextCursor = encodeCursor({
        id: lastDoc.id,
        sortField: "sequence",
        sortValue: Number(lastDoc.get("sequence")),
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

  async listRecent(uid: string, conversationId: string, limit: number = 20): Promise<MessageDocument[]> {
    const snapshot = await this.getCollection(uid, conversationId)
      .orderBy("sequence", "desc")
      .limit(limit)
      .get();

    const docs = (snapshot.docs || []).slice().reverse();
    return docs.map((d) => ({
      id: d.id,
      ...serializeTimestamps(d.data() as Omit<MessageDocument, "id">),
    }));
  }

  async getNextSequence(uid: string, conversationId: string): Promise<number> {
    const snapshot = await this.getCollection(uid, conversationId)
      .orderBy("sequence", "desc")
      .limit(1)
      .get();

    if (!snapshot.docs || snapshot.docs.length === 0) {
      return 1;
    }

    const maxDoc = snapshot.docs[0];
    if (!maxDoc) return 1;
    const maxSeq = Number(maxDoc.get("sequence")) || 0;
    return maxSeq + 1;
  }

  async findLastMessage(uid: string, conversationId: string): Promise<MessageDocument | null> {
    const snapshot = await this.getCollection(uid, conversationId)
      .orderBy("sequence", "desc")
      .limit(1)
      .get();

    if (!snapshot.docs || snapshot.docs.length === 0) return null;
    const lastDoc = snapshot.docs[0]!;
    return { id: lastDoc.id, ...(lastDoc.data() as Omit<MessageDocument, "id">) };
  }
}

export const messageRepository = new MessageRepository();
