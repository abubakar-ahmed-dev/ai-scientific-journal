# Fixing Plan — Backlog Analysis (2026-09-07)

Source: `Remaining-issues.txt` (older consolidated backlog), verified against the current
repository by code inspection on 2026-09-07 (post phase-9 first production deploy,
`app:v4` / revision `00005-bsf`).

Status legend: **FIXED** (verified correct in code), **CONFIRMED** (defect present today),
**PARTIAL** (some handling exists, gap remains).

## Progress log

| Date | Item | Result |
|------|------|--------|
| 2026-09-07 | #2 cursor sort validation | ✅ Fixed — shared `assertCursorSort` in `paginationSchema.ts`, applied to conversations, analyses, researchTasks, messages, observationVersions (2 more endpoints than planned); observation + project inline checks refactored to helper. 4 new unit tests. |
| 2026-09-07 | #11 Gemini timeout cleanup | ✅ Fixed — `try/finally { clearTimeout }` on all three `geminiAdapter` methods + `AbortSignal.timeout` passed to `generateContent` (SDK 2.21.0 supports it) + abort-error mapping in `handleError`. Underlying request now actually cancelled. |
| 2026-09-07 | Validation | ✅ typecheck + lint clean; full backend suite vs Firestore emulator **196/196** (192 prior + 4 new). |
| 2026-09-07 | #12 project delete cascade | ✅ Fixed — conversations + researchTasks re-filed alongside observations; children re-filed *before* project doc delete (failure = retryable, never dangling refs); paginated batches re-query per chunk; counts logged. 2 new integration tests (cascade semantics + idempotent 404). |
| 2026-09-07 | #8 search-index recovery | ✅ Fixed — one retry w/ backoff inside `observationSearchRepository.upsert/delete` (single point, all call sites covered) + `backend/scripts/reconcile-search-index.ts` (rebuilds stale/missing, drops orphans; `--uid`/`--dry-run`; ADC or emulator; verified on emulator: dry-run → apply → idempotent). `scripts/` added to tsconfig typecheck. |
| 2026-09-07 | #10 upload buffering | ✅ Fixed — `rejectOversizedContentLength` guards before body parse; multer disk staging (RAM flat); magic bytes sniffed from 64-byte head; staged file streams to GCS via new `IStorageService.uploadStream` (+ Mock twin); temp file removed on every exit path. Validation order, per-type limits, idempotency replay, metadata rollback preserved. |
| 2026-09-07 | Validation (batch 2) | ✅ typecheck + lint clean; full backend suite **198/198** (196 prior + 2 new). Skipped by request: #5, #6 (idempotency). |
| 2026-09-07 | #29 retrieval quota | ✅ Fixed — new `searchRateLimiter` (60/min) on `/ai/search`; generation bucket no longer consumed by page views. Rate-limit tests cover both tiers; API.md §4.1 updated. |
| 2026-09-07 | #31 destructive dialog focus | ✅ Fixed — `ConfirmDialog` autofocuses Cancel when `destructive`; Enter can no longer confirm irreversible deletes. |
| 2026-09-07 | #33 dashboard failure state | ✅ Fixed — onboarding gated on `!failedSections.observations && !failedSections.projects`; outage no longer renders as new account. |
| 2026-09-07 | #24 "caught up" honesty | ✅ Fixed — open tasks fetched per status (`suggested`/`planned`/`in_progress`, 50 each); empty state now means genuinely zero open tasks; completed tasks (limit 6) still feed recent activity; "+" stays hasMore-driven. |
| 2026-09-07 | #26 project lookup errors | ✅ Fixed — 404 renders "not found"; other failures render retryable error panel. |
| 2026-09-07 | #32 source links | ✅ Fixed — chips render inert/pulse while source resolution pending (both hypotheses supporting-IDs and referenced-sources sections). |
| 2026-09-07 | #30 measurements visibility | ✅ Fixed — top-level "＋ Add Measurement" opens the advanced panel (state-controlled `<details>`) and adds a row. |
| 2026-09-07 | Validation (batch 3) | ✅ Backend: typecheck + lint clean, suite **199/199** (rate-limit tests rewritten for the two tiers). Frontend: typecheck clean, tests **70/70** (dashboard mock made status-aware); lint warnings = pre-existing `set-state-in-effect` class. |

---

## 1. Already fixed — close in tracker

| # | Item | Evidence |
|---|------|----------|
| 1 | `q` search filters after pagination | `backend/src/repository/observationRepository.ts:149-208` — scans Firestore pages in a loop (`MAX_SCAN` cap) until `limit` matches collect; `q` match applied per page before assembly; cursors minted from last matching doc |
| 3 | Firestore timestamps leaked in responses | Shared `serializeTimestamps` (`backend/src/lib/serialize.ts:18-24`) applied on every repository return path across all collections, including messages and retrieval candidates |
| 4 | Analysis status write-back race with observation deletion | `observationRepository.ts:406-424` — `findByIds` existence pre-filter before batch update; residual between-check-and-commit window tolerated per RETAIN semantics |
| 7 | Conversation-linked Ask loses question on failure | `backend/src/routes/conversations.ts:207-216` — user message persisted before context build/AI call; retry with same key resumes generation; same ordering in `/ai/ask` (`routes/ai.ts:352-359`) |
| 9 | Orphaned storage binaries on delete failure | Metadata delete + `mediaCount` decrement atomic first, binary delete best-effort (`routes/media.ts:243-254`); upload path rolls back the binary on metadata failure (`routes/media.ts:138-153`); observation cascade deletes storage prefix. Residual (storage delete fails after metadata commit) is documented best-effort semantics — see also §2 item 8 for the tracking option |
| 34 | Markdown implementation changed / unsafe rendering | `frontend/src/components/MarkdownText.tsx` — dependency-free renderer producing React elements only; no `dangerouslySetInnerHTML`; links restricted to http/https with `rel="noreferrer noopener"`; fenced code rendered as text; applied to AI messages only (`ChatWindow.tsx:217-223`) |
| 28 | Command palette implies journal-wide search | `frontend/src/components/CommandPalette.tsx:211` — placeholder now "Jump to a page, action, or recent item…" with explicit scope disclaimer. Residual (§2 P3): only 5 recent records indexed; consider a "search all observations" fallback row |

---

## 2. Confirmed defects — fix plans

### P0 — backend correctness and reliability

| # | Issue | Evidence | Fix plan | Effort |
|---|-------|----------|----------|--------|
| 2 | ✅ **FIXED 2026-09-07** — was: cursor sort field not validated on conversations, analyses, researchTasks (also messages, observationVersions). Shared `assertCursorSort` helper now guards all seven decode sites | `backend/src/schemas/paginationSchema.ts` + all repositories; tests `backend/tests/unit/pagination.test.ts` | Done | — |
| 11 | ✅ **FIXED 2026-09-07** — was: timeout timer leaked on error paths; request never cancelled. Now `try/finally` clears timer on all exits + `AbortSignal.timeout` cancels the Gemini request + abort mapped to `AI_UNAVAILABLE` | `backend/src/ai/adapters/geminiAdapter.ts` (all three methods + `handleError`) | Done | — |
| 6 | Concurrent same-key idempotency: all idempotent paths are check-then-act (query then create as separate operations) — two simultaneous same-key requests both miss and both create | `backend/src/routes/researchTasks.ts:26-37`, `backend/src/repository/mediaRepository.ts:116-146` (`routes/media.ts:114-149`), `backend/src/repository/messageRepository.ts:68-91` (`routes/conversations.ts:185-216`) | Use deterministic document IDs derived from `(uid, endpoint, idempotencyKey)` so the second write collides with the first and returns the original record; detect different-payload-same-key and return `409`. Add a concurrency test (two parallel requests, same key, assert one record) | Medium |
| 5 | Idempotency contract gaps: `POST /api/v1/observations` has no key handling while `docs/API.md:276` promises it; `/ai/summarize`, `/ai/analyze`, `/ai/suggest-research` claimed "Idempotency-Key-aware" (`API.md:449`) but unimplemented | `backend/src/routes/observations.ts:21-29`; grep of `routes/ai.ts` shows key handling only on `/ask` (`routes/ai.ts:330-360`) | Decision first: implement or amend contract. Recommended: same deterministic-ID pattern as item 6 on observation create; amend API.md for the three AI endpoints (generation failures are retryable via status polling; full idempotency there is low value) | Medium |
| 12 | ✅ **FIXED 2026-09-07** — was: project delete re-filed observations only; conversations/researchTasks dangled. Now re-files all three before the project doc is deleted, in per-chunk re-queried batches, with counts logged; cascade + idempotent-delete tests added | `backend/src/repository/projectRepository.ts`, `backend/tests/integration/projects.test.ts` | Done | — |
| 8 | ✅ **FIXED 2026-09-07** — was: index writes log-only, no repair. Now: single-retry with backoff in `observationSearchRepository`; `backend/scripts/reconcile-search-index.ts` rebuilds stale/missing entries and removes orphans (emulator-verified, idempotent) | `backend/src/repository/observationSearchRepository.ts`, `backend/scripts/reconcile-search-index.ts` | Done | — |
| 10 | ✅ **FIXED 2026-09-07** — was: full files buffered in RAM via multer memoryStorage. Now: early Content-Length guard, disk staging, 64-byte head sniff, streamed GCS upload, guaranteed temp cleanup; all prior validation semantics preserved | `backend/src/middleware/mediaUpload.ts`, `backend/src/storage/storageService.ts`, `backend/src/routes/media.ts` | Done | — |

### P0/P1 — frontend safety and state correctness

| # | Issue | Evidence | Fix plan | Effort |
|---|-------|----------|----------|--------|
| 31 | ✅ **FIXED 2026-09-07** — was: destructive dialogs autofocus Confirm. Now Cancel is focused when `destructive` | `frontend/src/components/ui/ConfirmDialog.tsx` | Done | — |
| 33 | ✅ **FIXED 2026-09-07** — was: total fetch failure rendered onboarding. Now gated on both fetches succeeding | `frontend/src/pages/DashboardPage.tsx` | Done | — |
| 24 | ✅ **FIXED 2026-09-07** — was: "caught up" derived from first unfiltered 50. Now open tasks fetched per status; claim is complete-data-backed | `frontend/src/pages/DashboardPage.tsx` | Done | — |
| 26 | ✅ **FIXED 2026-09-07** — was: every error rendered "Project not found". Now 404 vs retryable error distinguished | `frontend/src/pages/ProjectDetailPage.tsx` | Done | — |
| 32 | ✅ **FIXED 2026-09-07** — was: source chips clickable before resolution. Now inert pulse pills while resolving | `frontend/src/components/AnalysisViewer.tsx` | Done | — |
| 30 | ✅ **FIXED 2026-09-07** — was: measurements buried in collapsed details. Now visible top-level action opens panel + adds row | `frontend/src/pages/ObservationFormPage.tsx` | Done | — |
| 29 | ✅ **FIXED 2026-09-07** — was: /ai/search shared the generation bucket. Now dedicated 60/min retrieval tier; API.md §4.1 updated | `backend/src/middleware/rateLimiter.ts`, `backend/src/routes/ai.ts`, `docs/API.md` | Done | — |

### P1/P2 — AI quality (real-Gemini work gated on Gemini billing resolution)

| # | Issue | Evidence | Fix plan | Effort |
|---|-------|----------|----------|--------|
| 18 | Insufficient-evidence gate too thin: only zero-candidates triggers it; `AI_RAG_MIN_SCORE=0.05` makes any keyword match enough to summon the model; "insufficient evidence" otherwise prompt-only; no structured output field | `backend/src/routes/ai.ts` (~365-395 deterministic gate), `backend/src/config/env.ts:30`, `backend/src/ai/prompts/askGroundedAnswerPrompt.ts:19`, `backend/src/ai/schemas/askSchema.ts:22-37` | Raise minScore; add weak-evidence gate (max candidate score below threshold or near-empty evidence budget → deterministic insufficient response); add validated `insufficientEvidence: boolean` schema field cross-checked against candidate strength | Medium |
| 13 | No real-Gemini evaluation: golden-case suite runs FakeAIService only (~12 cases); no recorded results artifact despite `docs/AI_EVALUATION.md:267-270` | `backend/tests/ai/goldenCases.test.ts:14`; no test imports `geminiAdapter` | Opt-in `scripts/eval-live.mjs` with `USE_FAKE_AI=false`; dataset of 20-30 cases (normal, paraphrase, conflicting measurements, nonexistent evidence, unsupported causation, deleted sources, adversarial); store per-case JSON under `backend/tests/ai/results/`; manual/nightly only, never CI. Execute after the Gemini key billing issue is resolved | Medium |
| 16 | Retrieval silently caps at an arbitrary 500 docs (no `orderBy` — creation-order scan); older observations beyond the cap are never candidates; UI never learns about truncation | `backend/src/ai/retrieval/retrievalService.ts:166` (`searchCol.limit(AI_SEARCH_MAX_CANDIDATES)`), warn-only at 169-174, `env.ts:28` | Order the candidate scan by `observedAt desc`; propagate `meta.truncated` (totalIndexed >= cap) through `/ai/search` and `/ai/ask` responses; surface a UI notice | Small |
| 21 | Analysis-linked chat implemented backend-only: `contextType: "research"` resolves analysis context, but UI offers only general/observation/project | `backend/src/ai/contextBuilder.ts:58-72`, `backend/src/schemas/conversationSchema.ts:7`; `frontend/src/pages/ConversationsPage.tsx:82`, `frontend/src/components/ChatWindow.tsx:161` | Add "Analysis" option to new-chat modal mapping to `contextType: "research"` + analysis ID; extend ChatWindow context header | Small |
| 19 | Prompt-injection: delimiting and tests solid, but observed content can forge closing `</context_data>` tags | `backend/src/ai/prompts/askGroundedAnswerPrompt.ts:44-76`; existing injection tests in `backend/tests/ai/ragEvaluation.test.ts:83-107` | Escape/strip `<`/`>` sequences in observation bodies before prompt assembly; add a forged-closing-tag test case | Small |
| 22 | Research suggestions lack controlled-variables instruction | `backend/src/ai/prompts/researchSuggestionsPrompt.ts:26-48` | Add one instruction line: each suggested next step states the manipulated variable, held constants, and the measurement/decision criterion | Tiny |
| 23 | "% match" label implies probabilistic confidence for a lexical score | `frontend/src/pages/ObservationDetailPage.tsx:430, 444` | Rename to "lexical match" or show the raw 0-1 score | Tiny |

### P3 — polish and infrastructure decisions

| # | Item | Evidence | Fix plan |
|---|------|----------|----------|
| 25 | "Today's Tasks" implies scheduling; no due dates exist | `frontend/src/pages/DashboardPage.tsx:602`; `ResearchTask` has createdAt/updatedAt only (`frontend/src/lib/api.ts:509-521`) | Rename to "Open Tasks" |
| 27 | Project search filters one loaded page client-side | `frontend/src/pages/ProjectsPage.tsx:24, 71-79`; `api.ts:157-161` has no `q` param | Add server `q` param (backend route + repo) or paginate the full list |
| 28 | Palette indexes only 5 recent records (scope is now honestly labeled) | `frontend/src/components/CommandPalette.tsx:53-60` | Optional: "search all observations" fallback row linking to journal search |
| — | Frontend test-worker OOM: no vitest worker/memory configuration | `frontend/vite.config.ts:14-19` (`"test": "vitest run"` unmodified) | Set `pool: "forks"` with `poolOptions.forks.maxForks: 2` (or `fileParallelism: false`); obtain one complete green regression run; drop the residual note |
| — | CI has no real-browser E2E (jsdom journey test is the current substitute) | `.github/workflows/ci.yml`; `frontend/src/test/e2eJourney.test.tsx` | Decision: accept jsdom journey for MVP (document it) or add a Playwright job against emulators |
| — | 12 lint warnings (`set-state-in-effect` class), no-op edit history snapshots, bundle splitting, marketing-text alignment | phase-9 log §4 | Stay deferred behind the work above |

---

## 3. Verification gates — status snapshot (2026-09-07)

Completed with the first production deploy (see `plans/phase-9/implementation-logs.md` §5):

- Firebase/GCP setup, rules + indexes (now with the 8 composites added 2026-09-06),
  Cloud Run deploy, CLI smoke, sign-in verified end-to-end.

Still open:

- Real storage lifecycle test on production (upload, signed-URL expiry, delete, failure path).
- Cross-account isolation spot-check with two real accounts.
- Production log privacy inspection; AI failure/latency signal review.
- Accessibility pass: keyboard navigation, focus restoration, dialogs, zoom, contrast, screen reader.
- Profile lifecycle preferences (preference preservation, login timestamp updates).
- CI: confirm a fully green remote run with security suites executed.

---

## 4. Recommended execution order

1. **P0 backend, smallest first:** #2 cursors → #11 timeouts → #6+#5 idempotency (one design pass) → #12 project cascade → #8 index reconciliation → #10 streaming uploads.
2. **P0/P1 frontend batch (one session):** #31, #33, #24, #26, #32, #30, #29.
3. **AI small fixes batch:** #16, #19, #22, #23, #21, #18.
4. **Resolve Gemini key billing, then build and run the live evaluation suite (#13);** iterate retrieval (#17 embeddings decision) and reasoning prompts (#14, #15) from recorded failures.
5. **P3 polish + infra decisions** (#25, #27, #28, vitest OOM, CI/E2E decision).
6. **Close remaining verification gates** (§3).

Each step: implement → lint + typecheck + relevant tests → record in the phase log →
focused commit. Batch 2 and 3 are frontend/backend separated so commits stay scoped.
