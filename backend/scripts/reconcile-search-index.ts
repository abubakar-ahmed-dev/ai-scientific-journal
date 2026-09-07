/**
 * Reconciles the derived `observationSearch` index against canonical
 * observations (ADR-017). Rebuilds entries that are missing or older than the
 * canonical observation, and removes index entries whose observation no longer
 * exists. The index is strictly derived: canonical data is never modified.
 *
 * When to run: after a confirmed index-write failure (the write path retries
 * once and then warns), or periodically as maintenance. Retrieval quality
 * degrades gracefully for stale entries, so this is recovery, not urgent.
 *
 * Usage (from backend/):
 *
 *   # Local emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8082 FIREBASE_PROJECT_ID=demo-test \
 *     npx tsx scripts/reconcile-search-index.ts --dry-run
 *
 *   # Production (Application Default Credentials — the script never takes
 *   # secrets; gcloud auth application-default login must be configured):
 *   FIREBASE_PROJECT_ID=ai-scientific-journal \
 *     npx tsx scripts/reconcile-search-index.ts [--uid <uid>] [--dry-run]
 *
 * Options:
 *   --uid <uid>  Reconcile a single user (default: all users)
 *   --dry-run    Report what would change without writing
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminApp } from "../src/lib/firebaseAdmin";
import { observationSearchRepository } from "../src/repository/observationSearchRepository";

interface Args {
  uid?: string;
  dryRun: boolean;
}

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const uidIndex = raw.indexOf("--uid");
  return {
    uid: uidIndex >= 0 ? raw[uidIndex + 1] : undefined,
    dryRun: raw.includes("--dry-run"),
  };
}

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

const PAGE_SIZE = 450;

async function reconcileUser(
  db: ReturnType<typeof getFirestore>,
  uid: string,
  dryRun: boolean
): Promise<{ rebuilt: number; removed: number; stale: number }> {
  const observations = db.collection("users").doc(uid).collection("observations");
  const search = db.collection("users").doc(uid).collection("observationSearch");

  // 1. Index every observation that is missing or stale (indexedAt older
  //    than the canonical updatedAt, missing the observedAt mirror used for
  //    cap-ordered retrieval, or unreadable — treat as stale).
  let rebuilt = 0;
  let stale = 0;
  let lastObs = null as FirebaseFirestore.QueryDocumentSnapshot | null;
  for (;;) {
    let q = observations.orderBy("__name__").limit(PAGE_SIZE);
    if (lastObs) q = q.startAfter(lastObs);
    const snap = await q.get();
    if (snap.empty) break;

    for (const obs of snap.docs) {
      const data = obs.data();
      const obsUpdated = toMillis(data.updatedAt);
      const idx = await search.doc(obs.id).get();
      const idxData = idx.data();
      const indexedAt = toMillis(idxData?.indexedAt);

      const isMissing = !idx.exists;
      const isStale =
        idx.exists &&
        (obsUpdated === null ||
          indexedAt === null ||
          indexedAt < obsUpdated ||
          idxData?.observedAt === undefined);
      if (!isMissing && !isStale) continue;

      if (isStale) stale++;
      rebuilt++;
      if (dryRun) continue;
      await observationSearchRepository.upsert(uid, obs.id, {
        title: (data.title as string) ?? "",
        description: (data.description as string) ?? "",
        notes: (data.notes as string | null) ?? null,
        hypothesis: (data.hypothesis as string | null) ?? null,
        tags: (data.tags as string[]) ?? [],
        measurements: (data.measurements as Array<{ name: string; unit: string }>) ?? [],
        observedAt: data.observedAt as Timestamp,
      });
    }

    lastObs = snap.docs[snap.docs.length - 1]!;
    if (snap.size < PAGE_SIZE) break;
  }

  // 2. Remove index entries whose observation no longer exists.
  let removed = 0;
  let lastIdx = null as FirebaseFirestore.QueryDocumentSnapshot | null;
  for (;;) {
    let q = search.orderBy("__name__").limit(PAGE_SIZE);
    if (lastIdx) q = q.startAfter(lastIdx);
    const snap = await q.get();
    if (snap.empty) break;

    for (const entry of snap.docs) {
      const obs = await observations.doc(entry.id).get();
      if (!obs.exists) {
        removed++;
        if (dryRun) continue;
        await observationSearchRepository.delete(uid, entry.id);
      }
    }

    lastIdx = snap.docs[snap.docs.length - 1]!;
    if (snap.size < PAGE_SIZE) break;
  }

  return { rebuilt, removed, stale };
}

async function main(): Promise<void> {
  const { uid, dryRun } = parseArgs();
  getFirebaseAdminApp(); // reuse the app's project-id wiring
  const db = getFirestore();

  const users: string[] = [];
  if (uid) {
    users.push(uid);
  } else {
    let lastDoc = null as FirebaseFirestore.QueryDocumentSnapshot | null;
    for (;;) {
      let q = db.collection("users").limit(PAGE_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      snap.docs.forEach((d) => users.push(d.id));
      lastDoc = snap.docs[snap.docs.length - 1]!;
      if (snap.size < PAGE_SIZE) break;
    }
  }

  console.log(
    `Reconciling observationSearch for ${users.length} user(s)` +
      `${uid ? ` (uid: ${uid})` : ""}${dryRun ? " — DRY RUN" : ""}`
  );

  let totalRebuilt = 0;
  let totalRemoved = 0;
  for (const u of users) {
    const { rebuilt, removed, stale } = await reconcileUser(db, u, dryRun);
    totalRebuilt += rebuilt;
    totalRemoved += removed;
    if (rebuilt > 0 || removed > 0) {
      console.log(`uid ${u}: rebuilt ${rebuilt} (${stale} stale), removed ${removed} orphans`);
    }
  }

  console.log(`Done. ${dryRun ? "Would rebuild" : "Rebuilt"} ${totalRebuilt}, ${dryRun ? "would remove" : "removed"} ${totalRemoved}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Reconciliation failed:", err);
    process.exit(1);
  });
