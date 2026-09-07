# Fixing Plan — Backlog Analysis (2026-09-07)

Source: `Remaining-issues.txt` (older consolidated backlog), verified against the current
repository by code inspection on 2026-09-07 (post phase-9 first production deploy,
`app:v4` / revision `00005-bsf`).

Status legend: **FIXED** (verified correct in code), **CONFIRMED** (defect present today),
**PARTIAL** (some handling exists, gap remains).

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
| 2 | Pagination cursor sort field not validated on conversations, analyses, researchTasks — a cursor minted for one sort replays against another endpoint producing mis-ordered pages | `backend/src/repository/conversationRepository.ts:100-106`, `analysisRepository.ts:108-114`, `researchTaskRepository.ts:154-160` decode and `startAfter` without comparing `cursor.sortField`; observations (`observationRepository.ts:137-142`) and projects (`projectRepository.ts:61-66`) do check | Extract shared `assertCursorSort(cursor, expectedField)` helper from the observation implementation; call at the cursor-decode site in the three repositories; add mismatch → `400 VALIDATION_ERROR` unit tests | Small |
| 11 | Gemini timeout timer leaks: `clearTimeout` on success path only; on API-error path the timeout later rejects with no handler (unhandled rejection) and the underlying request is never cancelled (no AbortSignal) | `backend/src/ai/geminiAdapter.ts:96-97, 160-161, 239-240` | Wrap the `Promise.race` in `try/finally { clearTimeout(timer) }`; pass `AbortSignal.timeout(this.timeoutMs)` into `generateContent` so the request actually cancels | Small |
| 6 | Concurrent same-key idempotency: all idempotent paths are check-then-act (query then create as separate operations) — two simultaneous same-key requests both miss and both create | `backend/src/routes/researchTasks.ts:26-37`, `backend/src/repository/mediaRepository.ts:116-146` (`routes/media.ts:114-149`), `backend/src/repository/messageRepository.ts:68-91` (`routes/conversations.ts:185-216`) | Use deterministic document IDs derived from `(uid, endpoint, idempotencyKey)` so the second write collides with the first and returns the original record; detect different-payload-same-key and return `409`. Add a concurrency test (two parallel requests, same key, assert one record) | Medium |
| 5 | Idempotency contract gaps: `POST /api/v1/observations` has no key handling while `docs/API.md:276` promises it; `/ai/summarize`, `/ai/analyze`, `/ai/suggest-research` claimed "Idempotency-Key-aware" (`API.md:449`) but unimplemented | `backend/src/routes/observations.ts:21-29`; grep of `routes/ai.ts` shows key handling only on `/ask` (`routes/ai.ts:330-360`) | Decision first: implement or amend contract. Recommended: same deterministic-ID pattern as item 6 on observation create; amend API.md for the three AI endpoints (generation failures are retryable via status polling; full idempotency there is low value) | Medium |
| 12 | Project deletion cascade incomplete: only observations re-filed; conversations and researchTasks referencing the project dangle; partial-failure window after the project doc commits; contradicts `docs/API.md:260` | `backend/src/repository/projectRepository.ts:142-170` | Re-file all three collections (observations, conversations, researchTasks) to `projectId: null` using paginated batches with per-chunk re-query; delete project doc last (or first + compensating note); return affected counts; reconcile API.md text; tests for dangling refs and mid-cascade failure | Medium |
| 8 | Search-index (`observationSearch`) update failures are log-only, never repaired — stale/missing entries permanently degrade `/ai/search` and `/ai/ask` | `backend/src/repository/observationRepository.ts:87-98, 321-333, 377-382` — best-effort `try/catch → logger.warn`; no reconciliation code anywhere | Short in-process retry (2 attempts) at write sites; plus a reconciliation backfill script that diffs `observations.updatedAt` vs index `indexedAt` per user and re-upserts stale entries (run manually / scheduled later). Keep the index strictly derived, never authoritative | Medium |
| 10 | Media uploads buffer entire files in RAM (up to 100 MB video) before any size check; non-streaming upload to GCS | `backend/src/middleware/mediaUpload.ts:7` (`multer.memoryStorage()`); Content-Length check after multer parse (`routes/media.ts:74-80`); `file.save(buffer, { resumable: false })` (`backend/src/services/storageService.ts:17-23`) | Enforce Content-Length guard before multer parses the body; switch to streaming (request body → `file.createWriteStream()`, or multer disk storage + stream upload); preserve magic-byte validation ordering; add per-user concurrent-upload cap | Large |

### P0/P1 — frontend safety and state correctness

| # | Issue | Evidence | Fix plan | Effort |
|---|-------|----------|----------|--------|
| 31 | Destructive confirmation dialogs autofocus Confirm — Enter confirms irreversible deletes | `frontend/src/components/ui/ConfirmDialog.tsx:50` (`autoFocus` on confirm; used for project/observation/conversation/task deletion) | Move `autoFocus` to Cancel (or make it conditional on `!destructive`) | Tiny |
| 33 | Dashboard total-fetch-failure renders new-user onboarding (empty state) | `frontend/src/pages/DashboardPage.tsx:214` — `isEmptyWorkspace` from lengths only; onboarding panel lines 259-279 | Gate onboarding with `!failedSections.observations && !failedSections.projects`; render full-page error + retry when sections failed | Small |
| 24 | Dashboard "caught up" claim can be wrong — open tasks filtered from first 50 only, no server-side status filter | `frontend/src/pages/DashboardPage.tsx:104` (`limit: 50`), 159-161, 631; metrics tile honest ("+" suffix at :474) | Pass `status=open` filter to the server query so completeness is real; keep or drop the "+" accordingly | Small |
| 26 | Project lookup failure of any kind renders "Project not found" | `frontend/src/pages/ProjectDetailPage.tsx:49-52` swallows all errors; :124 renders not-found | Branch on `ApiRequestError.status === 404` → not-found; otherwise error panel with retry | Small |
| 32 | Analysis source links render clickable before existence resolution | `frontend/src/components/AnalysisViewer.tsx:136-143` (`found: true` default while loading), 231-238 | Render chips inert/disabled while `sourceSummaries` fetch pending; resolve to link or "deleted" after | Small |
| 30 | Measurements hidden under collapsed Advanced Fields in create mode | `frontend/src/pages/ObservationFormPage.tsx:298` (`<details>` collapsed on create), add action at 337-343 | Hoist the measurements section out of `<details>` (keep location/tags collapsed) or add a top-level "Add Measurement" affordance that opens it | Small |
| 29 | Related-observation browsing consumes the AI-generation rate-limit bucket | `frontend/src/pages/ObservationDetailPage.tsx:52` → `POST /ai/search`; `backend/src/routes/ai.ts:30` applies `aiRateLimiter` (10/5 min) to the whole `/ai` router | Give `/ai/search` its own lighter limiter (e.g. 60/min per user) — cheap, non-generative read | Small |

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
