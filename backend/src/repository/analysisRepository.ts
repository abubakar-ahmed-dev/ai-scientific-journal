import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getFirebaseFirestore } from "../lib/firebaseAdmin";
import { ListAnalysesQueryDTO } from "../schemas/analysisSchema";
import { StructuredAnalysisOutput, HypothesisOutput } from "../ai/parsers/analysisOutputSchema";
import { decodeCursor, encodeCursor, PaginationMeta } from "../schemas/paginationSchema";
import { observationRepository } from "./observationRepository";
import { serializeTimestamps } from "../lib/serialize";

export interface AnalysisDocument {
  id: string;
  ownerId: string;
  projectId: string | null;
  observationIds: string[];
  conversationId: string | null;
  type: "summary" | "analysis" | "hypothesis" | "classification" | "research_suggestions";
  summary: string;
  keyFindings: string[];
  hypotheses: HypothesisOutput[];
  uncertainties: string[];
  suggestedQuestions: string[];
  openQuestions: string[];
  suggestedNextSteps: string[];
  model: string;
  promptVersion: string;
  createdAt: string | Timestamp;
}

export interface SourceObservationSummary {
  observationId: string;
  found: boolean;
  title?: string;
  status?: string;
}

export interface AnalysisWithSourcesDocument extends AnalysisDocument {
  sourceSummaries: SourceObservationSummary[];
}

export interface CreateAnalysisRecordDTO {
  projectId?: string | null;
  observationIds?: string[];
  conversationId?: string | null;
  type: "summary" | "analysis" | "hypothesis" | "classification" | "research_suggestions";
  output: StructuredAnalysisOutput;
  model: string;
  promptVersion: string;
}

export class AnalysisRepository {
  private getCollection(uid: string) {
    return getFirebaseFirestore().collection("users").doc(uid).collection("analyses");
  }

  async create(uid: string, data: CreateAnalysisRecordDTO): Promise<AnalysisDocument> {
    const docRef = this.getCollection(uid).doc();
    const now = FieldValue.serverTimestamp();

    const record = {
      ownerId: uid,
      projectId: data.projectId ?? null,
      observationIds: data.observationIds ?? [],
      conversationId: data.conversationId ?? null,
      type: data.type,
      summary: data.output.summary,
      keyFindings: data.output.keyFindings ?? [],
      hypotheses: data.output.hypotheses ?? [],
      uncertainties: data.output.uncertainties ?? [],
      suggestedQuestions: data.output.suggestedQuestions ?? [],
      openQuestions: data.output.openQuestions ?? [],
      suggestedNextSteps: data.output.suggestedNextSteps ?? [],
      model: data.model,
      promptVersion: data.promptVersion,
      createdAt: now,
    };

    await docRef.set(record);
    const snap = await docRef.get();
    return { id: docRef.id, ...serializeTimestamps(snap.data() as Omit<AnalysisDocument, "id">) };
  }

  async list(
    uid: string,
    query: ListAnalysesQueryDTO
  ): Promise<{ data: AnalysisDocument[]; meta: PaginationMeta }> {
    const limit = query.limit || 20;
    let dbQuery = this.getCollection(uid).orderBy("createdAt", "desc");

    if (query.type) {
      dbQuery = dbQuery.where("type", "==", query.type);
    }

    if (query.projectId) {
      if (query.projectId === "unfiled" || query.projectId === "null") {
        dbQuery = dbQuery.where("projectId", "==", null);
      } else {
        dbQuery = dbQuery.where("projectId", "==", query.projectId);
      }
    }

    if (query.conversationId) {
      dbQuery = dbQuery.where("conversationId", "==", query.conversationId);
    }

    if (query.observationId) {
      dbQuery = dbQuery.where("observationIds", "array-contains", query.observationId);
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

    const data: AnalysisDocument[] = resultDocs.map((d) => ({
      id: d.id,
      ...serializeTimestamps(d.data() as Omit<AnalysisDocument, "id">),
    }));

    let nextCursor: string | null = null;
    if (hasMore && resultDocs.length > 0) {
      const lastDoc = resultDocs[resultDocs.length - 1]!;
      nextCursor = encodeCursor({
        id: lastDoc.id,
        sortField: "createdAt",
        sortValue: lastDoc.get("createdAt") ? String(lastDoc.get("createdAt")) : "",
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

  async findById(uid: string, analysisId: string): Promise<AnalysisDocument | null> {
    const snap = await this.getCollection(uid).doc(analysisId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...serializeTimestamps(snap.data() as Omit<AnalysisDocument, "id">) };
  }

  async findByIdWithSourceSummary(uid: string, analysisId: string): Promise<AnalysisWithSourcesDocument | null> {
    const analysis = await this.findById(uid, analysisId);
    if (!analysis) return null;

    const sourceSummaries: SourceObservationSummary[] = [];
    for (const obsId of analysis.observationIds) {
      const obs = await observationRepository.findById(uid, obsId);
      if (obs) {
        sourceSummaries.push({
          observationId: obsId,
          found: true,
          title: obs.title,
          status: obs.status,
        });
      } else {
        sourceSummaries.push({
          observationId: obsId,
          found: false,
        });
      }
    }

    return {
      ...analysis,
      sourceSummaries,
    };
  }
}

export const analysisRepository = new AnalysisRepository();
