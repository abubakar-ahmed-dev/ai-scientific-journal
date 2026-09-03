# Phase 7 — Media, Location & Research Map: Independent Code Review & Fix Log

**Date:** 2026-09-03
**Branch:** `feature/phase-7-media-location-map`
**Method:** Multi-angle adversarial code review (3 correctness angles + reuse/simplification/efficiency/altitude angles, each finding independently verified against source and canonical docs) followed by fix implementation and full gate re-runs. All automated gates passed; no live E2E was run in this pass (fixes are unit/integration-verified).

---

## 1. Review Verdict Summary

The Phase 7 implementation was functionally correct in its happy paths but had
**4 documented contract requirements that were never implemented** (magic-byte
validation, media rate limit, upload idempotency, 413 error mapping), **1 privacy
gap** (approximate precision never actually fuzzed end-to-end), and **2 data-loss
orderings** (delete-before-metadata in media/observation cascades). All findings
below were confirmed against code and `API.md` / `SECURITY.md` / plan quotes,
then fixed. 14 confirmed/plausible findings were addressed; 1 candidate was
refuted during review (prompt-budget overflow — schema caps `label`/`title` at
200 chars, so `availableForBody` cannot go ≤ 0 from user content).

---

## 2. Findings → Fixes

### Security & Contract Findings (correctness)

| ID | Severity | Finding | Fix | Files |
| :-- | :-- | :-- | :-- | :-- |
| F1 | 🟠 High | **`approximate` precision was never fuzzed end-to-end.** Only `retrievalService` rounded to 1 decimal (AI prompts); `ObservationMiniMap`/`ResearchMapPage` rendered exact markers at raw stored coordinates with a purely cosmetic 2 km/2.5 km circle, and printed exact coordinates as text — defeating SECURITY.md §14 / the form's own "~11 km fuzzing" claim. | Introduced **shared sanitizers** as the single display authority: `backend/src/lib/locationPrivacy.ts` (consumed by `retrievalService`, replacing the hand-rolled block) and `frontend/src/lib/locationPrivacy.ts` (consumed by `ObservationMiniMap` + `ResearchMapPage`). Approximate now renders **only** fuzzed 1-decimal coordinates (~11 km circle, zoom 10); hidden strips coordinates entirely. Owner's own API responses keep raw coordinates (owner-only data; the edit form must round-trip them). | `backend/src/lib/locationPrivacy.ts` (new), `frontend/src/lib/locationPrivacy.ts` (new), `retrievalService.ts`, `ObservationMiniMap.tsx`, `ResearchMapPage.tsx` |
| F2 | 🟠 High | **Magic-byte validation (plan Task 2: "Strict MIME type, magic-byte, and size limits") was implemented nowhere** — only the client-supplied multipart Content-Type was checked; any renamed payload passed. | Added `detectMediaTypeFromBuffer()` (JPEG/PNG/WebP/WAV/RIFF, MP3 ID3 + frame-sync, ISO-BMFF `ftyp` brand parsing for HEIC/MP4/MOV/M4A, unknown brands rejected) and `validateFileConsistency()` in `mediaSchema.ts` — sniffed content must exist, equal the declared MIME family, and match the file extension. Enforced in the POST route with zero-write on rejection. 12 unit tests + integration test with real signatures. | `mediaSchema.ts`, `routes/media.ts`, `tests/unit/mediaContentValidation.test.ts` (new), `mediaEndpoints.test.ts` |
| F3 | 🟠 High | **`getSignedReadUrl` swallowed signing failures and returned an unsigned public URL** that 403s on a private bucket — masking broken IAM as "working" media, or serving an unexpiring link on a misconfigured public bucket. | Removed the fallback; signing failures now propagate. The list route catches per-item (logged, non-blocking so one broken object doesn't kill the gallery); POST/GET-one surface the error. | `storageService.ts`, `routes/media.ts` |
| F4 | 🟡 Med | **Per-type size limits enforced only after multer fully buffered the upload** at the 100 MB video cap — a 100 MB "image" consumed 10× its limit in RAM before rejection (Cloud Run OOM vector). | Added an early `Content-Length`/`req.file.size` guard against the absolute max before any validation work; per-type checks unchanged. (Full streaming is the Phase 9 hardening note — memoryStorage remains, now with the documented early-reject.) | `routes/media.ts` |
| F5 | 🟠 High | **Media-tier rate limiter (API.md §4.1: "30 uploads / hour / user") missing** — only the global 300/15 min limiter applied. | Added `mediaRateLimiter` (30/hour, UID-keyed with `ipKeyGenerator` fallback, same 429 envelope) applied to `POST /media`. | `rateLimiter.ts`, `routes/media.ts` |
| F6 | 🟠 High | **Idempotency-Key ignored on POST media** (API.md §4.2 + §6.8: "retried uploads do not create duplicate media") — retried uploads created duplicate docs, double `mediaCount`, double storage objects. | Implemented §4.2 semantics: key stored on the media doc via new `mediaRepository.findByUserKey` (user+observation-scoped query); same key+same file → `200` replay of the original media (fresh signed URL, no re-upload); same key+different file → `409 CONFLICT`. Tests: replay + conflict. | `mediaRepository.ts`, `routes/media.ts`, `mediaEndpoints.test.ts` |
| F7 | 🟡 Med | **Observation delete cascade: metadata deleted before storage cleanup, with storage failures doubly swallowed** → orphaned binaries with no metadata to reconcile (DATABASE_SCHEMA §19). Also `deletePrefix` ran on every delete even at `mediaCount: 0`. | Storage cleanup stays best-effort-after-commit (canonical write must not fail on storage), but is now **skipped entirely when `mediaCount === 0`** (no round trip in the common path), and the path scheme is imported from the co-located helper instead of hand-built. Documented residual risk: a transient storage outage during an observation delete can still orphan blobs (no scheduled GC yet — Phase 9 item). | `observationRepository.ts` |
| F8 | 🟡 Med | **MediaGallery cached signed URLs with no expiry handling** — URLs expire ≤ 15 min, so any session longer than that rendered permanently broken media until full reload. | `onError` handlers on `img`/`audio`/`video` (and lightbox) trigger a query refetch for fresh URLs, guarded against fetch storms; lightbox gained an explicit "Refresh URL" empty-URL state. | `MediaGallery.tsx` |
| F9 | 🟡 Med | **DELETE media deleted the storage object before the Firestore batch** — a failed batch (e.g. parent observation deleted concurrently) left metadata pointing at a deleted binary with an inflated `mediaCount`, 500 to the client. | Reordered: metadata first (atomic doc-delete + `mediaCount` decrement), then best-effort binary cleanup; `mediaRepository.delete` now treats "parent observation gone" as already-deleted (`true`) instead of a raw FirebaseError 500. | `routes/media.ts`, `mediaRepository.ts` |
| F10 | 🟡 Med | **MulterError (LIMIT_FILE_SIZE) returned 500 INTERNAL_ERROR** — the mediaUpload middleware runs before route try/catch, and errorHandler had no Multer branch (API.md registry: 413 PAYLOAD_TOO_LARGE). | Added a `MulterError` branch to `errorHandler`: `LIMIT_FILE_SIZE` → 413, other multer codes → 400 VALIDATION_ERROR. | `errorHandler.ts` |
| F11 | 🟡 Med | **Research Map silently plotted only the first 100 observations** (`limit: 100`, server cap = 100, no pagination/notice) — journals beyond 100 records appeared lost. | Fetches all pages via the documented cursor contract (`meta.nextCursor`/`hasMore`); regression test drives a 2-page fetch asserting all pins render. | `ResearchMapPage.tsx`, `ResearchMapPage.test.tsx` |
| F12 | ⚪ Low | **`onMediaCountChange(mediaList.length + 1)` stale-closure arithmetic** in the upload handler. | MediaGallery migrated to TanStack Query (useQuery/useMutation + invalidateQueries) — the parent count now derives from query data, eliminating manual bookkeeping (also resolves the K3 convention finding). | `MediaGallery.tsx` |

### Cleanup / Efficiency Findings (applied)

| ID | Finding | Fix |
| :-- | :-- | :-- |
| K1 | Leaflet (~150 KB + assets) statically imported in the root router and detail page — shipped in the initial bundle for every route. | `React.lazy` + Suspense for `ResearchMapPage` (App.tsx) and `ObservationMiniMap` (ObservationDetailPage). Build-verified: Leaflet now lives only in async chunks (`ResearchMapPage-*.js`, `ObservationMiniMap-*.js`); the initial `index` bundle contains zero leaflet references. |
| K2 | N per-item `getSignedUrl` calls per gallery view. | Kept (parallelized, per-request freshness is what enables F8's short-TTL design); the F3 fix ensures failures are visible. Batch-signing deferred — cost acceptable at personal-journal scale, revisit with observability data. |
| K3 | MediaGallery/ResearchMapPage hand-rolled fetch state vs the codebase's TanStack Query convention. | Both migrated to useQuery/useMutation (see F12). |
| K4 | Frontend hardcoded 10/25/100 MB limits duplicating backend env defaults. | Extracted to `frontend/src/lib/mediaLimits.ts` (single module + `detectClientMediaType`); component renders limits from it. (No config endpoint — PRD §8: no new infrastructure; limits are API-contract constants.) |
| K5 | Observation ownership check copy-pasted in all four media handlers. | Extracted `requireOwnedObservation()` helper; all routes use it. |
| K6 | Storage path scheme (`users/{uid}/observations/{obsId}/…`) hand-built in 3 files. | Co-located in `backend/src/storage/storagePaths.ts` (`observationStoragePrefix`/`mediaStoragePath`); media routes, mediaRepository, and the observation cascade all import it. |
| — | `Date.now()` called during render (purity lint, unstable memo) in ResearchMapPage date filters. | Anchored once via `useState(() => Date.now())` initializer (semantically correct: relative filters measure from page open). |

### Refuted during verification (no action)

- "First prompt block can exceed `AI_RAG_CONTEXT_CHAR_BUDGET` when header alone ≥ budget" — schema caps `location.label` and `title` at 200 chars each; `availableForBody` cannot go ≤ 0 from user-controlled input under default config.

---

## 3. New Modules & Test Coverage

**New source files:** `backend/src/lib/locationPrivacy.ts`, `backend/src/storage/storagePaths.ts`, `frontend/src/lib/locationPrivacy.ts`, `frontend/src/lib/mediaLimits.ts`
**New test files:** `backend/tests/unit/mediaContentValidation.test.ts` (12 tests: magic-byte sniffing per family, unknown-brand rejection, short buffers, MIME/content/extension consistency, zero-write rejections)

**Test suite updates:**
- `mediaEndpoints.test.ts`: fixtures now use real magic-byte signatures (the fakes correctly fail content validation); mock Firestore gained chained `.where()` support; new tests for content/MIME contradiction (415 + zero-write), extension mismatch, Idempotency-Key replay (200, no duplication, single storage object), Idempotency-Key conflict (409).
- `MediaGallery.test.tsx`: QueryClientProvider wrapper; mutation mocks model server state across invalidation refetches; new oversized-file client-side rejection test.
- `ResearchMapPage.test.tsx`: QueryClientProvider wrapper; new fuzzed-coordinate assertion (raw `45.123456` never rendered; `45.1`/`-122.9` are) and multi-page pagination test (3 pins across 2 pages).

---

## 4. Quality Gate Results (final run)

| Gate | Command | Result |
| :-- | :-- | :-- |
| Backend typecheck | `npm --prefix backend run typecheck` | ✅ 0 errors |
| Backend lint | `npm --prefix backend run lint` | ✅ 0 errors, 0 warnings |
| Backend tests | `npm --prefix backend run test` | ✅ **25 files, 156/156 passed** (up from 141) |
| Backend build | `npm --prefix backend run build` | ✅ clean |
| Frontend typecheck | `npm --prefix frontend run typecheck` | ✅ 0 errors |
| Frontend lint | `npm --prefix frontend run lint` | ✅ 0 warnings in all changed/new files (pre-existing warnings in untouched legacy pages unchanged) |
| Frontend tests | `npm --prefix frontend run test` | ✅ **7 files, 18/18 passed** (up from 15) |
| Frontend build | `npm --prefix frontend run build` | ✅ built; Leaflet verified out of the initial bundle (async chunks only) |

---

## 5. Residual Items (documented, not blocking)

1. **Orphaned storage blobs on observation-delete during a storage outage** — cleanup is best-effort by design (§19: canonical delete must never fail); a scheduled GC job is a Phase 9 observability/hardening item.
2. **memoryStorage buffering** — the early Content-Length guard rejects oversized uploads before validation, but true streaming-to-GCS (no full RAM buffer) belongs with the Phase 9 Cloud Run tuning.
3. **Per-item signing cost** (K2) — acceptable at MVP scale; revisit with real usage data.
4. **Live E2E** — this pass was verified by automated suites; a live emulator + storage-emulator E2E pass (matching the Phase 6 §7 style) is recommended before merging to `dev` if media endpoints are exercised in CI without the storage emulator today.
