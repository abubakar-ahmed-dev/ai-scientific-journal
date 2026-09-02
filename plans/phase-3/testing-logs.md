# Phase 3 — Core Domain CRUD: Independent Testing Log

**Date:** 2026-09-02
**Tester:** Claude (independent verification — implementation-log claims re-executed, not trusted; source of all repositories/routes/schemas read in full before testing)
**Branch:** `feature/phase-3-core-domain` @ `baba28f`
**Method:** static source review + emulator-backed suites + **live end-to-end API run** (real Auth Emulator tokens for two users, real Firestore Emulator persistence, real HTTP against the running backend on :8090)

---

## 1. Verdict

**Functionally strong — 35/36 E2E assertions pass. Three defects found, none critical-but-silent; two are contract violations that must be fixed before merge, one is a UI-visible bug.** Isolation, optimistic locking, versioning, cascades, and ADR-021 semantics all verified correct against a live backend. Issues are in pagination-contract edges, `q` filter placement, and timestamp serialization.

---

## 2. What was independently verified (evidence: live run)

### Suites re-executed
| Run | Result |
| --- | ------ |
| Backend lint + typecheck | clean |
| Full backend suite under Firestore emulator (`emulators:exec`) | **34/34** (6 files) |
| Frontend tests + typecheck + build | 2/2, clean, bundle ok |

### Live E2E (server on :8090, auth+firestore emulators, real minted ID tokens, 36 assertions)

**Auth & /me (2/2)** — lazy user-doc creation, preferences patch.
**Projects (5/5)** — create (201, `status:"active"`), list, archive sets `archivedAt`, unarchive **clears** it to `null`.
**Observation create (5/5)** — empty title 400; nonexistent `projectId` 400; `latitude:200` 400; **server-managed fields (`ownerId`, `mediaCount`, `version`) rejected 400**; valid create → 201 with `version:1, mediaCount:0`; unfiled create → `projectId:null`.
**Optimistic locking & versions (4/4)** — wrong `expectedVersion` → **409 CONFLICT**; correct → 200 with `version:2`; version history contains exactly one immutable v1 snapshot; read shows v2 (ADR-016 verified live).
**Listing & filters (5/6)** — limit/hasMore/nextCursor; page 2 has zero page-1 overlap; `projectId` filter exact; `projectId=unfiled` matches nulls; tag filter (5/5). ❌ `q` — see F2.
**Existence-hiding isolation (5/5)** — User B: GET A's obs → **404 not 403**; list sees zero; PATCH → 404; DELETE → 404; versions → 404.
**Project delete (ADR-021, 4/4)** — 204; child observation **re-filed to `projectId:null`**; deleted project → 404.
**Observation delete cascade (4/4)** — 204; GET → 404; versions → 404; and via Admin-SDK probe: **`observationSearch` entries for deleted obs are gone** (ADR-017 lifecycle verified).
**Unauthenticated (2/2)** — 401 envelopes with `requestId` on domain routes.
**Rules-layer isolation cross-check** — direct REST reads against the Firestore emulator are denied by security rules while the backend Admin SDK path works (defense-in-depth observed live).

**Search index (Admin-SDK probe):** 7 entries for 7 live observations, `searchableText` correctly built from title/description/tags; deleted observations removed.

---

## 3. Findings (must-fix before merge)

### F1 🔴 Firestore Timestamps serialized raw into API responses — frontend renders "Invalid Date"
`GET /observations` returns `"createdAt": {"_seconds":1788367245,"_nanoseconds":881000000}` — the Firestore `Timestamp` object leaks through `res.json`. Verified consequence: `frontend/src/pages/ObservationsPage.tsx:186` does `new Date(obs.observedAt).toLocaleString()` → **"Invalid Date"** in the running UI. `api.ts` types claim `createdAt: string`, so TS did not catch it.
**Fix:** serialize at the repository/route boundary (e.g., `timestamp.toDate().toISOString()` in a `toDTO` mapping) for `createdAt`/`updatedAt`/`observedAt`/`editedAt`/`archivedAt` on all resources. API.md §1.3 implies JSON-friendly ISO-8601.

### F2 🟠 `q` filter applied AFTER `limit` — silently wrong pages
`list()` fetches `limit+1` docs, then filters by `q` in memory. Live proof: `?limit=3&q=bulk` returned **1** of 5 matching "bulk" observations (the other 4 were outside the first page window) with `hasMore:false` — a silent truncation. API.md §6.5 describes `q` as a server-side prefilter; results must not depend on page position.
**Fix options:** (a) add `where('searchableText', '>=', q.lowercased())`-style Firestore-side matching against the derived index, (b) fetch-with-cursor loop until `limit` matches or collection exhausted, or (c) minimum: document `q` as page-local search and set `hasMore:false` honestly. (a)/(b) preserve the contract.

### F3 🟠 Cursors are not bound to `sort` (API.md §5.3 violation)
A `sort=updated` cursor is silently accepted with `sort=observed` (live: returned 2 docs, 200). `decodeCursor` ignores its own `sortField` payload, and the query never compares it. API.md §5.3: "Mixing `sort` values or filters between cursor pages is rejected (`400 VALIDATION_ERROR`)."
**Fix:** in `list()`, reject when `cursor.sortField !== sortField` with `400 VALIDATION_ERROR`. (Filter-binding is likewise absent — same one-line pattern per filter if desired; sort is the contract-mandated minimum.)

---

## 4. Minor findings (non-blocking)

* **M1** `projectId=null` (string literal) accepted as alternate spelling of `unfiled` — harmless convenience, but undocumented in API.md; either document or drop.
* **M2** `m_${Date.now()}_${idx}` measurement IDs — collision-safe in practice, but a stored `createdAt`-style monotonic id or `crypto.randomUUID()` would be cleaner; cosmetic.
* **M3** Version snapshots are created even when a PATCH changes only `expectedVersion`-no-op fields — snapshot-per-PATCH (not per-content-change) is defensible and matches API.md §6.5 "a successful content-changing PATCH"; current behavior snapshots every successful PATCH. Acceptable; note for Phase 8 UI (empty-diff versions).
* **M4** Project delete re-files observations but not conversations/researchTasks — correct for Phase 3 scope (those entities don't exist yet); the code comment cites DATABASE_SCHEMA §19 correctly. Revisit in Phase 4/5.
* **M5** `env.test.ts` port assertion correctly updated to 8081 on this branch (confirms the dev-CI root cause found earlier).

---

## 5. Contract scorecard

| Contract (API.md) | Status |
| --- | --- |
| §2 auth on every domain route; UID from token | ✅ live-verified |
| §2.2 existence-hiding 404 (never 403) | ✅ live-verified |
| §3 error envelopes + codes (400/404/409/401) | ✅ live-verified |
| §5 pagination envelope `{nextCursor, hasMore, limit}` | ✅ works; ❌ F3 sort-binding missing |
| §5.3 cursor bound to sort | ❌ F3 |
| §6.3/6.4 project lifecycle incl. archivedAt | ✅ live-verified |
| §6.5 validation matrix (lengths, coords, server-managed fields) | ✅ live-verified |
| §6.5 `expectedVersion` → 409; version increments | ✅ live-verified |
| §6.7 versions read-only, snapshot-on-edit (ADR-016) | ✅ live-verified |
| §7.1 observation delete cascade + search entry | ✅ live-verified (Admin probe) |
| §7.1 project delete re-files, never deletes (ADR-021) | ✅ live-verified |
| §6.5 `q` as server-side prefilter | ❌ F2 (page-local only) |
| Response timestamps JSON-friendly (§1.3 implication) | ❌ F1 |

---

## 6. Recommended actions before PR review

1. **F1** — add a serialization map (Timestamp → ISO string) for all date fields on project/observation/version responses. Highest user-visible impact.
2. **F3** — enforce cursor `sortField` match → 400. Three lines; contract-mandated.
3. **F2** — decide the `q` strategy (index-backed where-clause preferred; loop-fetch acceptable); at minimum make truncation honest.
4. Add regression tests for the three fixes to `backend/tests/integration/`.
5. M1–M4: note in the PR description; no code change required now.

---

*All commands and results executed by the tester on 2026-09-02 against `feature/phase-3-core-domain` @ `baba28f`. Live-run evidence is reproducible: start emulators (`npx firebase-tools emulators:start --only auth,firestore --project demo-test`, JDK 21 required), boot backend with `FIRESTORE_EMULATOR_HOST=localhost:8082 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`, mint tokens via the Auth Emulator signUp/signIn REST endpoints, then replay the assertion script (preserved at test time in the session transcript).*
