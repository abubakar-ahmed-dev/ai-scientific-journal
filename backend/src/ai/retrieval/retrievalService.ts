import { getFirebaseFirestore } from "../../lib/firebaseAdmin";
import { observationRepository, ObservationDocument } from "../../repository/observationRepository";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { sanitizeLocation } from "../../lib/locationPrivacy";

export interface RetrievedObservation {
  observationId: string;
  title: string;
  observedAt: string; // ISO string
  projectId: string | null;
  score: number; // lexical relevance (0-1)
  searchableText: string;
  snippet?: string;
  location?: {
    label: string | null;
    precision: "exact" | "approximate" | "hidden";
    coordinates?: { latitude: number; longitude: number };
  } | null;
}

export interface RetrievalResult {
  candidates: RetrievedObservation[];
  totalIndexed: number;
  // True when the index scan hit the candidate cap: the newest observations
  // (by observedAt) were scored, but older records beyond the cap were never
  // candidates. Callers must surface this so users know coverage is partial
  // (fixing-plan #16).
  truncated: boolean;
}

const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
  "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
  "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
  "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her",
  "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
  "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it",
  "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my",
  "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other",
  "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't",
  "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such",
  "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
  "then", "there", "there's", "these", "they", "they'd", "they'll", "they're",
  "they've", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
  "weren't", "what", "what's", "when", "when's", "where", "where's", "which",
  "while", "who", "who's", "whom", "why", "why's", "with", "won't", "would",
  "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
  "yourself", "yourselves"
]);

export function tokenize(text: string): string[] {
  if (!text) return [];
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove accents

  const rawTokens = normalized
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);

  const filtered = rawTokens.filter((t) => !STOP_WORDS.has(t));
  return filtered.length > 0 ? filtered : rawTokens;
}

export function scoreLexical(queryTokens: string[], searchableText: string): number {
  if (!queryTokens || queryTokens.length === 0 || !searchableText) {
    return 0;
  }

  const normalizedText = searchableText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const textTokens = normalizedText.split(/[^a-z0-9]+/i).filter((t) => t.length >= 2);
  if (textTokens.length === 0) return 0;

  const textTokenCounts = new Map<string, number>();
  for (const token of textTokens) {
    textTokenCounts.set(token, (textTokenCounts.get(token) || 0) + 1);
  }

  // Check title boost: the first 60 characters usually contain the title
  const titlePrefix = normalizedText.slice(0, 60);

  let totalScore = 0;
  const uniqueQueryTokens = Array.from(new Set(queryTokens));

  for (const qToken of uniqueQueryTokens) {
    const count = textTokenCounts.get(qToken) || 0;
    if (count > 0) {
      let tokenScore = 1.0;
      // Frequency bonus up to +0.3
      tokenScore += Math.min(count - 1, 3) * 0.1;
      // Title prefix bonus +0.5
      if (titlePrefix.includes(qToken)) {
        tokenScore += 0.5;
      }
      totalScore += tokenScore;
    }
  }

  const maxPossible = uniqueQueryTokens.length * 1.8;
  const normalizedScore = totalScore / maxPossible;
  return Math.min(1.0, Math.round(normalizedScore * 1000) / 1000);
}

export function buildSnippet(searchableText: string, queryTokens: string[], maxLength = 200): string {
  if (!searchableText) return "";
  const cleanText = searchableText.replace(/\s+/g, " ").trim();
  if (cleanText.length <= maxLength) return cleanText;

  // Find index of first matching token
  let firstMatchIndex = -1;
  const lowerText = cleanText.toLowerCase();

  for (const token of queryTokens) {
    const idx = lowerText.indexOf(token.toLowerCase());
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
    }
  }

  if (firstMatchIndex === -1) {
    return cleanText.slice(0, maxLength).trim() + "...";
  }

  // Calculate window around the match
  const leadChars = 60;
  let start = Math.max(0, firstMatchIndex - leadChars);
  let end = start + maxLength;

  if (end > cleanText.length) {
    end = cleanText.length;
    start = Math.max(0, end - maxLength);
  }

  let snippet = cleanText.slice(start, end).trim();
  if (start > 0) snippet = "..." + snippet;
  if (end < cleanText.length) snippet = snippet + "...";

  return snippet;
}

export class RetrievalService {
  async retrieve(
    uid: string,
    query: string,
    opts: {
      limit: number;
      projectId?: string | null;
      minScore: number;
    }
  ): Promise<RetrievalResult> {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return { candidates: [], totalIndexed: 0, truncated: false };
    }

    // 1. Fetch candidate index records from users/{uid}/observationSearch,
    //    newest-observed first so the cap keeps the most recent records as
    //    candidates instead of an arbitrary creation-order slice (#16).
    const searchCol = getFirebaseFirestore()
      .collection("users")
      .doc(uid)
      .collection("observationSearch");

    const snapshot = await searchCol
      .orderBy("observedAt", "desc")
      .limit(env.AI_SEARCH_MAX_CANDIDATES)
      .get();
    const totalIndexed = snapshot.size;
    const truncated = totalIndexed >= env.AI_SEARCH_MAX_CANDIDATES;

    if (truncated) {
      logger.warn(
        { uid, count: totalIndexed, cap: env.AI_SEARCH_MAX_CANDIDATES },
        "Observation search index scan reached maximum candidate cap; older observations were not candidates"
      );
    }

    if (snapshot.empty) {
      return { candidates: [], totalIndexed: 0, truncated: false };
    }

    // 2. Score each document
    interface ScoredDoc {
      observationId: string;
      searchableText: string;
      score: number;
    }

    const scoredDocs: ScoredDoc[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const observationId = doc.id;
      const searchableText = (data.searchableText as string) || "";
      const score = scoreLexical(queryTokens, searchableText);

      if (score >= opts.minScore) {
        scoredDocs.push({
          observationId,
          searchableText,
          score,
        });
      }
    }

    if (scoredDocs.length === 0) {
      return { candidates: [], totalIndexed, truncated };
    }

    // 3. Sort by score descending
    scoredDocs.sort((a, b) => b.score - a.score);

    // 4. Canonical re-check
    // Take candidate IDs to resolve against canonical observations
    const candidateIds = scoredDocs.map((s) => s.observationId);
    const canonicalObservations = await observationRepository.findByIds(uid, candidateIds);

    const canonicalMap = new Map<string, ObservationDocument>();
    for (const obs of canonicalObservations) {
      canonicalMap.set(obs.id, obs);
    }

    const verifiedCandidates: RetrievedObservation[] = [];

    for (const item of scoredDocs) {
      const canonical = canonicalMap.get(item.observationId);
      // If deleted from canonical observations, drop it
      if (!canonical) continue;

      // Apply projectId filter if specified
      if (opts.projectId !== undefined) {
        if (opts.projectId === null || opts.projectId === "unfiled") {
          if (canonical.projectId !== null && canonical.projectId !== undefined) {
            continue;
          }
        } else {
          if (canonical.projectId !== opts.projectId) {
            continue;
          }
        }
      }

      const observedAtIso =
        typeof canonical.observedAt === "string"
          ? canonical.observedAt
          : canonical.observedAt?.toDate?.().toISOString() || new Date().toISOString();

      // Privacy enforcement via the shared sanitizer (SECURITY §14): hidden
      // coordinates are omitted entirely; approximate are fuzzed to 1 decimal.
      let safeLocation: {
        label: string | null;
        precision: "exact" | "approximate" | "hidden";
        coordinates?: { latitude: number; longitude: number };
      } | null = null;
      if (canonical.location) {
        const s = sanitizeLocation(canonical.location);
        if (s) {
          safeLocation =
            s.latitude === undefined || s.longitude === undefined
              ? { label: s.label, precision: s.precision }
              : {
                  label: s.label,
                  precision: s.precision,
                  coordinates: { latitude: s.latitude, longitude: s.longitude },
                };
        }
      }

      verifiedCandidates.push({
        observationId: canonical.id,
        title: canonical.title,
        observedAt: observedAtIso,
        projectId: canonical.projectId || null,
        score: item.score,
        searchableText: item.searchableText,
        snippet: buildSnippet(item.searchableText, queryTokens),
        location: safeLocation,
      });

      if (verifiedCandidates.length >= opts.limit) {
        break;
      }
    }

    return {
      candidates: verifiedCandidates,
      totalIndexed,
      truncated,
    };
  }
}

export const retrievalService = new RetrievalService();
