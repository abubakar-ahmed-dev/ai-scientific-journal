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

### Follow-up fix: inline project creation failed everywhere it was embedded (user report)

**Problem:** creating a project from the inline creator (task edit/create modal, new-chat modal,
observation form) always failed, while the projects-page form worked. Root cause:
`InlineProjectCreator` sent `status: "active"` in the POST body, but the backend's
`CreateProjectSchema` is `.strict()` with no `status` field → `400 VALIDATION_ERROR` on every
inline creation. The projects-page form omits `status` (the repository defaults it to
`"active"`), which is why only that path worked.

**Files changed:**
* `frontend/src/components/InlineProjectCreator.tsx` — dropped `status` from the
  `createProject` payload (repository already defaults `status: "active"`).
* `frontend/src/components/InlineProjectCreator.test.tsx` (new) — regression guard asserting
  the payload contains only schema-legal fields, plus an error-path case.

**Validation:** creator tests 2/2, dependent suites (ResearchTasksPage, ConversationsPage) 5/5,
frontend tsc clean, lint 0 errors.

## 2c. Deployment preparation fix: Vite build-time Firebase config

**Problem:** the Phase 9 manual/source-deploy path did not guarantee that production Firebase
web config reached the Vite build. `.dockerignore` excludes `.env.production`, and Cloud Run
runtime env vars cannot change an already-built SPA bundle. A deployment could therefore load
the app with demo Firebase identifiers and fail Google sign-in.

**Files changed:**
* `Dockerfile` — added frontend-stage `ARG`/`ENV` entries for the public `VITE_*` Firebase
  web config values before `npm run build`. Backend secrets are still runtime-only.
* `.gcloudignore` — added explicit source-upload exclusions for `.env*`, credentials,
  service-account files, `node_modules`, `dist`, logs, and local agent metadata.
* `infrastructure/cloud-run/cloudbuild.yaml` — added a deterministic Cloud Build Docker build
  that passes public Firebase config build args and pushes the image to Artifact Registry.
* `plans/phase-9/deploy-guide.md` — replaced the advisory notes with a PowerShell runbook:
  region before Firestore, Secret Manager console/key rotation, private bucket with public
  access prevention, scoped IAM, build image with substitutions, deploy image, lock CORS, and
  run smoke checks.
* `docs/DEPLOYMENT.md` — documented the build-time Vite config requirement and the
  Cloud Build -> Artifact Registry -> Cloud Run image deploy path.

**Validation:** `npm.cmd --prefix frontend run build` passed (same >500 kB entry chunk warning
as before). `docker build -t asj-deploy-preflight ...` passed with dummy public Firebase build
args after Docker Desktop was started. Docker's static check warns on `VITE_FIREBASE_API_KEY`
and related names because they look secret-like; these Firebase web config values are public
identifiers embedded in the browser bundle by design. The backend Gemini key remains
runtime-only via Secret Manager. `gcloud` and `firebase.cmd` are installed and authenticated;
cloud execution follows the deployment runbook.

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

## 5. Deployment Log — first production deploy (2026-09-06)

Executed per `deploy-guide.md` (supersedes plan §D–§E commands). Region **asia-south1**,
project `ai-scientific-journal`. Verified cloud state first (APIs, repo, SA, IAM), then ran:

| Step | Action | Result |
| :--- | :--- | :--- |
| Runbook §9 | Bucket `gs://ai-scientific-journal-media` created (uniform access, public-access-prevention) | ✅ |
| Runbook §9 | Runtime SA: `storage.objectAdmin` on bucket + self `iam.serviceAccountTokenCreator` (signed URLs) | ✅ |
| Runbook §10 | `firebase deploy --only "firestore:rules,firestore:indexes"` — rules released, indexes deployed, **before** public exposure | ✅ |
| Runbook §11 | Cloud Build `app:v1` with `_VITE_FIREBASE_*` substitutions (public web identifiers only) | ✅ SUCCESS, 1m55s |
| Runbook §12 | `gcloud run deploy` — runtime SA, `GEMINI_API_KEY=gemini-api-key:latest`, label `dev-tutorial=cloud-run-ai-challenge`, `--allow-unauthenticated`, port 8080, timeout 60 | ✅ revision `ai-scientific-journal-00001-pc4` |
| Runbook §12 | CORS locked: `CORS_ORIGIN=https://ai-scientific-journal-291307045855.asia-south1.run.app` | ✅ revision `00002-z4s` serving 100% |

Service URL: `https://ai-scientific-journal-291307045855.asia-south1.run.app`

### Deployed infrastructure inventory (final state)

| Resource | Value |
| :--- | :--- |
| Project | `ai-scientific-journal` (number `291307045855`), billing linked |
| Region (all resources) | `asia-south1` |
| APIs enabled | run, artifactregistry, cloudbuild, secretmanager, iamcredentials, firestore, firebase, identitytoolkit, storage, logging, monitoring |
| Artifact Registry | `ai-scientific-journal` (DOCKER), `asia-south1` |
| Image | `asia-south1-docker.pkg.dev/ai-scientific-journal/ai-scientific-journal/app:v1` |
| Media bucket | `gs://ai-scientific-journal-media` — uniform bucket-level access, public-access-prevention |
| Runtime SA | `ai-scientific-journal-runtime@ai-scientific-journal.iam.gserviceaccount.com` |
| Runtime SA roles | `roles/datastore.user` (project); `roles/secretmanager.secretAccessor` scoped to `gemini-api-key`; `roles/storage.objectAdmin` on media bucket; self `roles/iam.serviceAccountTokenCreator` (signed URLs) |
| Build SA | `291307045855-compute@developer.gserviceaccount.com` — `roles/artifactregistry.writer` (repo) + `roles/logging.logWriter` (project); broad legacy `roles/editor` noted for later hardening |
| Secret | `gemini-api-key` v1; bound at runtime as `GEMINI_API_KEY=gemini-api-key:latest` |
| Cloud Run env | `NODE_ENV=production`, `FIREBASE_PROJECT_ID`, `STORAGE_BUCKET=ai-scientific-journal-media`, `CORS_ORIGIN=<service URL>` (locked post-deploy), `USE_FAKE_AI=false` |
| Cloud Run settings | port 8080, timeout 60s (AI_TIMEOUT_MS default 30s fits), ingress default, `--allow-unauthenticated` (app-level auth on `/api/v1`; only `/api/health` open) |
| Firestore | `(default)` DB `asia-south1`; `firebase/firestore.rules` + `firebase/firestore.indexes.json` deployed before exposure |
| Revisions | `00001-pc4` (placeholder CORS) → `00002-z4s` (CORS locked), 100% traffic |

CLI smoke (runbook §14, `scripts/smoke-test.mjs`): health 200, SPA 200,
unauthenticated `/api/v1` → 401, label verified on service.

### Correction (2026-09-07) — runtime SA `tokenCreator` was never actually granted

The §9 row above marked the self `iam.serviceAccountTokenCreator` binding ✅, but a
`gcloud projects get-iam-policy` audit (2026-09-07, while fixing media-upload 500s)
showed the only `tokenCreator` member was the deploy-time `firebase-adminsdk` SA —
the runtime SA binding was missing. Consequence: every signed-URL generation
(`POST .../media` response, media list/detail) fails on Cloud Run with 500.
Grant applied 2026-09-07:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  ai-scientific-journal-runtime@ai-scientific-journal.iam.gserviceaccount.com \
  --member="serviceAccount:ai-scientific-journal-runtime@ai-scientific-journal.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" --project=ai-scientific-journal
```

Lesson: IAM-grant runbook steps need post-execution verification
(`gcloud iam service-accounts describe --format ...`), not just a checklist tick.

### Remaining (phase exit §322)

1. **👤 E3 (blocks browser sign-in):** Firebase console → Authentication → Settings →
   Authorized domains → add `ai-scientific-journal-291307045855.asia-south1.run.app`.
2. **👤 E4 browser checklist:** sign-in, observation CRUD persistence, chat, analysis,
   retrieval, media upload, second-account isolation, logout.
3. **F2–F5:** §13 full smoke documentation, observability dashboard/alerts (F3),
   SECURITY §16 checklist + real-Gemini injection probe (F4), regression gates + PR (F5).
4. `deploy-values.md` stays untracked (contains Firebase web config + project values).

## Deploy 2026-09-07 — image v5, revision ai-scientific-journal-00006-8qm

- Source: `dev` @ `838038b` (dashboard refactor + UX polish + form location fixes + README).
- Build: Cloud Build `cloudbuild.yaml`, image `app:v5`, Firebase web config injected
  via substitutions (retrieved with `firebase apps:sdkconfig web` — public-by-design).
- Deploy: same env/secrets as previous revision; image bumped v4 → v5.
- Verified: frontend 200; API returns proper `UNAUTHENTICATED` envelope (auth middleware
  intact). Revision serving 100%.
- First build failed: `tsc -b` (Docker) caught unused `content` arg in
  `DashboardPage.test.tsx` that `tsc --noEmit` smoke checks missed — use
  `npm run typecheck` (`tsc -b`) locally, it type-checks the same file set as the image build.
- Rollback: `gcloud run deploy-commands` revert to revision `ai-scientific-journal-00005-bsf`
  or redeploy image `app:v4`.

## Deploy 2026-09-08 — image v6, revision ai-scientific-journal-00007-25t (CSP media fix)

- Bug (user-reported): deployed observation record page blocked all media. Console:
  signed `storage.googleapis.com/...` image URL "violates the following Content
  Security Policy directive: img-src …".
- Root cause: helmet CSP in `backend/src/app.ts` — `imgSrc` listed Firebase Auth +
  OSM tile origins but not the signed-read-URL host `storage.googleapis.com`.
  Local dev never hits it (no helmet CSP in emulator flows) → only visible in prod.
- Fix: `dev` @ `73cb9cc` adds `https://storage.googleapis.com` to `imgSrc` only;
  no other directive loosened.
- Validation: backend typecheck + full test suite (209/209).
- Build: image `app:v6` (Cloud Build, same substitutions as v5). Deploy: image-only
  update; env/SA/secrets carried over. Revision `ai-scientific-journal-00007-25t`
  serving 100%.
- Verified live: response CSP header now contains
  `img-src … https://storage.googleapis.com`; `/api/health` ok.
- Rollback: redeploy image `app:v5`.

## Deploy 2026-09-08 — image v7, revision ai-scientific-journal-00008-54j (blob: avatar preview)

- Bug (user-reported): after v6, avatar upload preview still blocked. Console:
  `blob:https://…run.app/…` violates `img-src` — avatar preview uses
  `URL.createObjectURL(file)`, and helmet's `imgSrc` lacked the `blob:` scheme.
- Fix: `dev` @ `583fea4` adds `blob:` to `imgSrc` only.
- Validation: backend typecheck + tests 209/209. Build `app:v7`, image-only deploy.
- Verified live: header `img-src 'self' data: blob: … storage.googleapis.com`;
  `/api/health` ok. Revision `ai-scientific-journal-00008-54j` serving 100%.
- Rollback: redeploy image `app:v6`.
- Note: two CSP rounds in two deploys — before next header-affecting change,
  enumerate frontend image/asset sources (createObjectURL, external hosts) and
  diff against `imgSrc` locally via a helmet header snapshot test.

## Config 2026-09-08 — secret v2 + model pin (revision 00010, no image change)

- `gemini-api-key` bumped to version 2 in Secret Manager (console). Cloud Run pins
  secret version at revision creation → `gcloud run services update --update-secrets
  "GEMINI_API_KEY=gemini-api-key:latest"` created revision
  `ai-scientific-journal-00009-lx5`. Lesson: secret rotation always needs a new
  revision; no image rebuild required.
- AI calls still failed: service had no `AI_MODEL` env var, so prod used the code
  default `gemini-3.6-flash`, which the new key rejects. Local worked because
  `backend/.env` sets `AI_MODEL=gemini-3.5-flash`.
- Fix: service env `AI_MODEL=gemini-3.5-flash` (revision
  `ai-scientific-journal-00010-ph4`), and default in `backend/src/config/env.ts`
  changed to `gemini-3.5-flash` (`278a8dc`, env-default test updated).
- Rollback note: model is env-config only — no image rollback involved.
