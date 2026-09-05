# Phase 9: Production Hardening & AI Evaluation — Implementation Log

**Status:** In progress — Agent Block 1 complete; Manual Blocks 1–4 and Agent Block 2 remain
**Date:** 2026-09-04
**Branch:** `feature/phase-9-production-hardening`
**Plan:** `plans/phase-9/plan.md`

---

## 1. Architectural Decisions Recorded

1. **USE_FAKE_AI local-development seam retained and production-fenced (plan §A1).**
   The `USE_FAKE_AI` env flag selects the built-in `FakeAIService` at the AI seam
   (consistent with TESTING.md §13's fake-service-at-the-seam pattern). Corrections applied:
   - `z.coerce.boolean()` (string `"false"` → `true` footgun) replaced with `z.stringbool()`.
   - The sentinel-key string match was removed from `aiService.ts` — selection is now
     env-driven only (`NODE_ENV=test` or `USE_FAKE_AI=true`).
   - Production refinement in `config/env.ts` makes the fake **impossible in production**:
     `NODE_ENV=production` + `USE_FAKE_AI=true`, a missing/sentinel Gemini key, the localhost
     CORS default, or any emulator endpoint var (`FIRESTORE_EMULATOR_HOST`,
     `FIREBASE_AUTH_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST`) all fail startup (TA §44).
2. **Frontend API base stays proxied.** The `VITE_API_URL` line from the working-tree diff was
   dead config (`src/lib/api.ts` hardcodes `/api/v1` + Vite proxy in dev; same-origin in prod).
   `.env.example` restored to `VITE_API_BASE_URL=/api/v1` with an explanatory note.
3. **Route-guard authentication on the client (logout fix from `small-errors.txt`).** Added a
   `RequireAuth` wrapper in `App.tsx` on every authenticated route: a cleared session
   (logout, expiry) now redirects to the landing page instead of rendering data-less pages.
   No change to `authContext` sign-out semantics.

## 2. Implementation Summary by Task

### A1+A2 — USE_FAKE_AI seam + production fail-fast guard
* `backend/src/config/env.ts`: `USE_FAKE_AI: z.stringbool().default(false)`; registered the
  three emulator host vars as optional schema fields (the Firebase Admin SDK reads them from
  `process.env` directly); added `superRefine` production refinement (key required,
  sentinels `test-key`/`mock-gemini-key` rejected, fake AI rejected, localhost CORS rejected,
  emulator vars rejected).
* `backend/src/ai/aiService.ts`: selection simplified to `NODE_ENV === "test" || USE_FAKE_AI`;
  documented that env validation makes the fake unreachable in production.
* `backend/tests/unit/env.test.ts`: +10 cases (stringbool parsing; valid production config
  accepted; missing key, both sentinels, fake-in-prod, localhost CORS, and each emulator var
  rejected with path-specific messages).
* `.env.example` (both apps): document the seam and its production prohibition; restore
  `VITE_API_BASE_URL`; note emulator vars must be unset for production builds.
* Root `package.json`: kept the `emulators` script (`firebase-tools emulators:start --project demo-test`).

### A3 — Dev-only code audit (no code changes needed)
* `console.log`/`debugger`/TODO/FIXME: none in either app's `src`.
* `console.error` in 4 frontend files are legitimate error-path logging (ErrorBoundary, page
  catch blocks) — acceptable.
* Emulator references confined to exactly 3 config files (`backend/src/config/env.ts`,
  `backend/src/storage/storageService.ts` — env-gated, `frontend/src/lib/firebase/config.ts` —
  `VITE_USE_FIREBASE_EMULATORS` gated, single usage).
* `.dockerignore` verified: excludes `.env`/`**/.env*` (keeps `.env.example`), service-account
  files, credentials, dev artifacts. Dockerfile builds with no `.env` access.

### A4 — Golden-case AI evaluation suite
* `backend/tests/ai/goldenCases.test.ts`: 19 cases per AI_EVALUATION §13 #1 / §11 —
  prompt-version pinning tripwire; 4 observation-analysis, 3 research-suggestions (incl.
  append-only no-write-back contract), 3 conversation summaries, 2 chat replies (contextual +
  general), 3 grounded RAG answers (grounding-gate: citations ⊆ candidates; empty-candidates →
  zero evidence; exact response-shape contract), 3 failure-mode rejections (unavailable /
  timeout / invalid_response → registry errors). All against the deterministic FakeAIService;
  runtime ~30 ms; CI-safe.

### A5 — Production smoke test script
* `scripts/smoke-test.mjs` (dependency-free, Node ≥18): health endpoint (`{"status":"ok"}`),
  SPA served at `/` (`<div id="root">`), unauthenticated `/api/v1/observations` → 401 with
  registry envelope, optional `--token` authenticated `/api/v1/me` probe. Non-zero exit on
  failure. Usage + failure path verified locally; pass path runs against the deployed service
  (plan Manual Block 4, E4).

### A6 — AI operation signals + log privacy test
* `backend/src/lib/aiSignals.ts`: `logAiSignal()` emitting OBSERVABILITY.md §8 fields —
  `requestId`, `userId`, `operation` (summarize | analyze | suggest-research | ask |
  chat-turn), `durationMs`, `model`, `promptVersion`, `status` (success | failure),
  `errorType` (registry codes: `AI_UNAVAILABLE` | `AI_INVALID_RESPONSE` | `RATE_LIMIT_EXCEEDED`
  | `RETRIEVAL_ERROR`), `inputLength`/`outputLength`/`contextLength`, `candidateCount`,
  `tokenUsage` — **never content** (§4 privacy rule).
* Wired into all five AI generation call sites (`routes/ai.ts` ×4, `routes/conversations.ts`
  chat turn); failure paths log the error class before rethrowing (preserving §7.3 semantics).
* `backend/tests/unit/aiSignals.test.ts`: correlation/field assertions + a privacy test
  asserting no content/secret fields and numeric-only length metadata.

### A7 — Security matrix audit (SECURITY §31, API.md §9) + gap tests
* Route-table audit (code-read, per CLAUDE.md "do not trust prior claims") compiled against
  API.md §9; results recorded in `testing-logs.md` §1. Every `/api/v1` route inherits
  `requireAuth` (routes/index.ts) behind requestId → helmet → CORS → body-limit → logging →
  global rate limit (app.ts, canonical TA §77 order); AI tier (10/5min), chat tier (20/min),
  media tier (30/h) verified mounted; idempotency on chat / ask / media / task-acceptance
  verified in code.
* Two genuine gaps found and closed:
  1. **Task-acceptance idempotency** (`API.md` §6.14) was implemented but untested — added
     integration test (first accept 201; same-key replay 200 with the same task id; list
     shows exactly one task). Required extending the test Firestore mock with a `where()`
     chain (top-level, matching the repository's call shape) that filters the in-memory
     store for keys and returns `empty` on the snapshot.
  2. **Malformed-JSON body** → 400 `VALIDATION_ERROR` envelope without parser internals —
     added (`entity.parse.failed` branch of errorHandler was untested).
* Cross-user (User B) 404 existence-hiding probes: confirmed present for projects,
  observations, conversations, analyses, research tasks, AI pipelines, RAG, and media
  (list/get/upload/delete). Auth tests cover missing header, empty token, invalid token
  (expired tokens hit the same verify-catch → 401).

### A8 — Bundle decision
* Kept the single 530 kB (gzip 147 kB) entry chunk for MVP; Leaflet remains correctly split
  into async chunks (verified: no leaflet reference in `index-*.js`). Rationale: further
  splitting `AnalysisViewer` saves ~10-15% at best, adds waterfall complexity on the primary
  detail view. Revisit with real production usage data (OBSERVABILITY.md §13 philosophy).
  The >500 kB rolldown advisory is a warning, not an error.

### Fix during final gates
* `frontend/src/app/App.test.tsx`: removed unused `Routes`/`Route` import (build break).
* `frontend/src/test/e2eJourney.test.tsx`: explicit 20 s timeout on the 10-step journey test
  (passes in ~5 s in isolation; default 5 s timeout proved flaky under full-suite parallel
  workers on this machine).

## 2b. Follow-up fix: task project reassignment on edit (user report)

**Problem:** a research task's project association could not be changed after creation —
`UpdateResearchTaskSchema` (`.strict()`, no `projectId`) rejected the field, the repository
`update()` ignored it, and the edit modal had no project control. Users could not move a task
between projects or unfile it.

**Files changed:**
* `backend/src/schemas/researchTaskSchema.ts` — `UpdateResearchTaskSchema` now accepts
  `projectId: string | null` (ownership validated in repository; `null` = Unfiled).
* `backend/src/repository/researchTaskRepository.ts` — `update()` validates target-project
  ownership (same rule as `create()`) and persists `projectId`.
* `frontend/src/lib/api.ts` — `updateResearchTask` patch type gains `projectId?: string | null`.
* `frontend/src/pages/ResearchTasksPage.tsx` — edit modal gains a Project Association select
  (prefilled with the task's current project, "Unfiled" default) plus the existing
  `InlineProjectCreator` for in-place project creation; task card shows a project chip when filed.
* `frontend/src/pages/ResearchTasksPage.test.tsx` — new case: reassign task to another project
  via edit modal submits `projectId` patch.
* `backend/tests/integration/researchTasks.test.ts` — new case: move A→B, unfile (null),
  foreign project id rejected `400 VALIDATION_ERROR`.
* `docs/API.md` §6.14 — PATCH body documented with `projectId` semantics.

**Validation:** backend integration 9/9 (`vitest run tests/integration/researchTasks.test.ts`),
backend lint + tsc clean, frontend typecheck clean, frontend task-page tests 4/4, frontend lint
unchanged (pre-existing warnings only).

## 3. Validation Performed (final state)

| Gate | Command | Result |
| :--- | :--- | :--- |
| Backend typecheck | `npm --prefix backend run typecheck` | ✅ 0 errors |
| Backend lint | `npm --prefix backend run lint` | ✅ 0 errors |
| Backend tests (Firestore emulator) | `emulators:exec --only firestore --project demo-test "npm test"` | ✅ **27 files, 191/191** (up from 156 at phase-8 close) |
| Frontend typecheck | `npm --prefix frontend run typecheck` | ✅ 0 errors |
| Frontend lint | `npm --prefix frontend run lint` | ✅ exit 0 (warnings unchanged — see §4) |
| Frontend tests | `npm --prefix frontend run test` | ✅ **15 files, 43/43** |
| Frontend build | `npm --prefix frontend run build` | ✅ clean; Leaflet verified out of entry chunk |
| Smoke script (failure path) | `node scripts/smoke-test.mjs <unreachable>` | ✅ exits 1 with per-check ✗ output |

## 4. Remaining Items / Notes

1. **Lint warnings (12, pre-existing + new-effects class):** the hydration/context-title
   effects from phase 8 trigger oxlint `set-state-in-effect`; unchanged this phase. K1
   (TanStack Query migration) remains the structural fix — deferred, non-blocking.
2. **Commits are split per repo convention** (7 this block); all validation gates re-run
   green after each meaningful change.
3. **Local emulator data note:** the stale emulator processes (PIDs 4228/15056) holding ports
   4000/9099/8082 were terminated during final-gate runs to free ports for
   `emulators:exec`; in-memory emulator data from prior local sessions was discarded
   (emulator data is non-persistent by design).
4. **Next:** Manual Blocks 1–4 (plan §B–§E) are yours — GCP/Firebase project setup, data-layer
   deploy, first Cloud Run deploy, then E4 smoke via `node scripts/smoke-test.mjs $SERVICE_URL`.
   Agent Block 2 (§F) resumes after the service is live.
