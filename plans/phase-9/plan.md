# Phase 9 — Production Hardening & AI Evaluation: Implementation Plan

**Source plan:** `plans/IMPLEMENTATION_PLAN.md` §3 Phase 9
**Governing docs:** `DEPLOYMENT.md` (all); `OBSERVABILITY.md` §3–§14; `SECURITY.md` §16, §30, §31, §33–§34; `AI_EVALUATION.md` §10–§13; `TESTING.md` §15–§16; `API.md` §9; `PRD.md` §14
**Branch:** `feature/phase-9-production-hardening` (off `dev` at the phase-8 merge, `b9ccfa8`)
**Definition of done for this phase:** the app is **deployed on Cloud Run, works on real Firebase/Firestore, and passes the §16 production security checklist + smoke tests.** Emulator-green is not done.

---

## 0. Phase Goal & Ordering Principle

Phase 9 closes the project: production deployment on Cloud Run, observability, the security/evaluation gates, and removing local-development scaffolding that must not ship.

**Ordering principle (per your direction): all agent/code work happens first; manual cloud work is interleaved at the exact points where code must meet infrastructure.** The plan is therefore a sequence of blocks: each block is either 🤖 **AGENT** (code/tests/docs I implement and validate locally) or 👤 **MANUAL** (cloud setup you perform, with exact commands and what to report back). A manual block only ever appears when the preceding agent work has produced something that needs real infrastructure to continue.

Key existing assets verified in the repo (so the plan builds on reality):

* `Dockerfile` already multi-stage, non-root (`USER node`), prod-only deps, `EXPOSE 8080` — mostly §5-conformant.
* `app.ts` serves `frontend/dist` when `NODE_ENV=production` (single-service SPA+API, DEPLOYMENT.md §2) ✅
* `server.ts` handles SIGTERM drain ✅; `app.set("trust proxy", 1)` ✅ (Cloud Run requirement for rate limiting).
* CI runs lint/typecheck/emulator-backed tests/build per app + docker build ✅.
* `firebase.json` (auth/firestore/UI emulators only), `firebase/firestore.rules`, `firebase/firestore.indexes.json` exist.
* Security/eval suites exist: `tests/security/{isolation,rules}.test.ts`, `tests/ai/ragEvaluation.test.ts`, malformed-output zero-write suite (phase 5), failure-injection (phase 4).
* Pino logger exists; `requestLogger` includes `requestId`.

Known gaps this phase must close (from phase logs + this scan):

* **`USE_FAKE_AI` dev seam is unstaged in the working tree** — decide and land it correctly (see §A1).
* Production fail-fast (phase-4 F5 residual): `GEMINI_API_KEY` still has a non-test default (`"test-key"`), so prod boots with a bogus key. Must become required in production (env refine).
* F12 (phase-8): 530 kB main chunk — bundle warning persists (polish, optional).
* No Cloud Monitoring dashboard/alerts, no production smoke script, no `infrastructure/` configs yet.
* Residuals from phase 7: orphaned-media GC note, memoryStorage note (document as Phase 9 items; implement only if cheap).
* **The `.env` in the working tree contains a real-looking Gemini key and was pasted into chat** — treat it as exposed; regenerate it (Manual step in §C).

---

## A. AGENT BLOCK 1 — Production-readiness code pass (no cloud needed)

### A1. Resolve and land the local-dev AI seam correctly
* **Decision to record (ADR note or progress log):** the `USE_FAKE_AI` seam + `mock-gemini-key` sentinel is a legitimate local-dev affordance per TESTING.md §13 (fake service at the AI seam). Keep, with these corrections:
  * Fix the `z.coerce.boolean()` footgun in `env.ts`: `USE_FAKE_AI=false` currently coerces the string `"false"` → `true`. Use a proper boolean coercion: `z.enum(["true","false"]).transform(v => v === "true")` or `z.stringbool()` if available in the installed zod.
  * **Production guard:** the fake must be impossible in production. Add a schema `.refine()` / startup assertion: `NODE_ENV=production && (USE_FAKE_AI || sentinel key)` → throw. Combine with the phase-4 F5 residual fix below.
  * Frontend `.env.example` restoration: restore `VITE_API_BASE_URL=/api/v1` (the code reads a hardcoded `/api/v1` + Vite proxy; the `VITE_API_URL` line in the unstaged diff is dead config). Keep the emulator vars (they match `config.ts` reads).
  * Split into focused commits (repo rule): (1) `feat(backend): add USE_FAKE_AI local development seam with production guard`, (2) `docs(env): document emulator and fake-AI local development setup`, (3) `chore: add firebase emulators script` (root package.json).

### A2. Production fail-fast env hardening (phase-4 F5 residual)
* In `backend/src/config/env.ts`: add a whole-schema `.superRefine()`: when `NODE_ENV=production`, require `GEMINI_API_KEY` to be present and **not** the `"test-key"`/`"mock-gemini-key"` sentinel, and forbid `USE_FAKE_AI=true`.
* Also validate `CORS_ORIGIN` is not the localhost default when production (warn or fail).
* Extend `backend/tests/unit/env.test.ts` with production-refinement cases (missing key → throws; sentinel key → throws; fake-AI-in-prod → throws; valid config → passes).
* Unit-test guard exists → commit: `fix(backend): fail fast on invalid production configuration`.

### A3. Remove/flag all dev-only code paths for production
* Grep-audit for dev-only leftovers: emulator short-circuits in `storageService.ts` (fine — they only activate via env), `USE_FAKE_AI` (kept per A1, but production-impossible per A1/A2), any `console.log` in `backend/src` and `frontend/src` (replace with logger or remove), TODO/FIXME/HACK sweep.
* Frontend: verify no emulator-only assumptions outside `config.ts` (grep `VITE_USE_FIREBASE_EMULATORS` usages — should be exactly one, in `config.ts`).
* Confirm `.dockerignore` already excludes `.env`, service-account files, dev artifacts ✅ (verified).
* Commit as found: `chore(backend): audit and remove dev-only code paths` (or document findings if none).

### A4. Golden-case AI evaluation suite (AI_EVALUATION §13 #1, §11)
* Create `backend/tests/ai/goldenCases.test.ts` with **10–15 golden cases** across the three generation pipelines + chat, run against the **FakeAIService** (mocked, fast, CI-safe):
  * summarize (3 cases), analyze (4 cases), research_suggestions (3 cases), chat turn (2 cases)
  * Each case asserts: pipeline output validates against its Zod schema, `model`+`promptVersion` provenance present, append-only persistence shape, and rubric-relevant structure (keyFindings/hypotheses/uncertainties present where expected)
  * Regression harness hook: the suite reads `model`/`promptVersion` from generated records — a prompt or model change that alters structure fails CI (§11's MVP form).
* Commit: `test(backend): add golden-case AI evaluation suite`.

### A5. Production smoke test script (`scripts/smoke-test.mjs`)
* Node script (no new deps) hitting a deployed base URL:
  1. `GET /api/health` → 200 `{"status":"ok"}` (unversioned, per ADR-018)
  2. SPA served at `/` (200 + HTML containing the app mount)
  3. Unauthenticated `/api/v1/observations` → 401 with registry error envelope
  4. Optional: `--token <idToken>` mode runs authenticated read of `/api/v1/me`
* Exit non-zero on any failure; usage documented in the script header + DEPLOYMENT.md pointer.
* Commit: `test(scripts): add post-deployment smoke test script`.

### A6. Observability completion (OBSERVABILITY.md §3, §8)
* Pino structured logging already present; verify/extend:
  * AI-operation signals (§8): confirm chat/analysis/ask paths log `operation=ai_chat|ai_analyze|ai_ask`, duration, outcome (ok|invalid_output|unavailable), model — **never content** (add an eslint guard comment or a unit test asserting no content fields in emitted log lines).
  * Add a **log-privacy unit test** (TESTING.md spirit): stub pino destination, run the requestLogger + one AI route with a fake service, assert emitted lines contain `requestId` but not message/summary text.
* Commit: `feat(backend): add AI operation signals and log privacy test`.

### A7. Security gate suites finalized (SECURITY §30, §31; API.md §9 audit)
* **Audit** (code-read, then fill gaps as tests): every route has auth → ownership → validation → envelope → rate limit → idempotency where required (API.md §9 checklist). Phase 2–8 logs claim these; per CLAUDE.md, re-verify by route-table read, not trust. Produce a checklist table in the phase progress log with ✅/test-reference per endpoint.
* Add the missing edge-case tests from §31 if any gaps: expired/invalid token handling, malformed request → 400 envelope, excessive size → 413/415, cross-user probes on media endpoints (phase 7 has some; confirm coverage matrix).
* Mostly test-reading + small additions; commit: `test(backend): close security matrix gaps (SECURITY §31)`.

### A8. Frontend production polish (small)
* F12 polish (optional, cheap): `React.lazy` for `AnalysisViewer` on the detail page, or record decision to keep 530 kB (document in progress log).
* Verify `index.html`/SPA-fallback + asset caching headers behave (static serve already in `app.ts` — add `maxAge` for hashed assets if trivial).
* Commit if changed: `perf(frontend): lazy-load analysis viewer (or: document bundle decision)`.

### ✅ Exit criteria for Agent Block 1
All quality gates green locally (backend incl. emulator-backed security suites, frontend, build, Docker build), commits clean, progress log updated. **No cloud account needed yet.**

---

## B. 👤 MANUAL BLOCK 1 — Google Cloud + Firebase project setup (you, at the terminal)

> Do this **after** Agent Block 1 is committed. Time: ~45–60 min one-time. Everything here is one-time setup; later deploys skip most of it.

> **⚠️ First: regenerate your Gemini API key** in [Google AI Studio](https://aistudio.google.com/apikey) (the one currently in `backend/.env` was pasted into chat — treat it as compromised). Keep the new key ready for step B7. You'll also delete the old key there.

### B0. Install/verify tooling
```bash
gcloud --version              # if missing: https://cloud.google.com/sdk/docs/install
gcloud auth login             # opens browser; log in with the Google account owning the project
docker --version              # Docker Desktop must be running for local image builds
node --version                # LTS (22.x matches CI)
```
(JDK 21 + firebase-tools already installed — emulators worked in Phase 8.)

### B1. Create the project (or reuse an existing GCP project)
```bash
gcloud projects create <YOUR_PROJECT_ID> --name="AI Scientific Journal"
gcloud config set project <YOUR_PROJECT_ID>
```
* `<YOUR_PROJECT_ID>` must be globally unique, lowercase, digits/hyphens. **Choose it carefully — it's permanent and is also the Firebase project ID.**
* Save the project ID; it appears in many later commands as `<PROJECT_ID>`.
* Link billing (required for Cloud Run + Artifact Registry; Cloud Run free tier is generous, costs should be ~$0 at personal scale):
  https://console.cloud.google.com/billing — create/select a billing account, then:
```bash
gcloud billing projects link <PROJECT_ID> --billing-account=<BILLING_ACCOUNT_ID>
```

### B2. Enable required APIs
```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com firestore.googleapis.com \
  firebase.googleapis.com identitytoolkit.googleapis.com storage.googleapis.com \
  cloudbuild.googleapis.com logging.googleapis.com monitoring.googleapis.com
```

### B3. Firebase: add the project and enable Auth + Firestore
```bash
firebase login                       # if not already logged in
firebase projects:addfirebase <PROJECT_ID>
```
Then in the Firebase console (https://console.firebase.google.com → your project):
1. **Authentication → Get started → Google → Enable** (set a support email). This is the production Google Sign-In provider.
2. **Firestore Database → Create database** → **Production mode** → region: pick the **same region as your Cloud Run deployment** (see B4 note; e.g. `us-central1`). Production mode (locked by default) is correct — our `firestore.rules` will be deployed explicitly in step D.

### B4. Region decision (choose once, keep forever)
Pick **one region** for everything (Cloud Run, Firestore, Storage bucket, Artifact Registry). For the APAC challenge context, `asia-southeast1` (Singapore) or `asia-south1` (Mumbai) are reasonable; `us-central1` is the cheapest/most-default. Record it: `REGION=<your-region>`.
*(Firestore native mode region is chosen at creation in B3.3; if you already created Firestore in a region, use that one for everything else.)*

### B5. Artifact Registry + Docker repo
```bash
gcloud artifacts repositories create ai-scientific-journal \
  --repository-format=docker --location=<REGION>
```

### B6. Service account (least privilege, DEPLOYMENT.md §9)
```bash
gcloud iam service-accounts create ai-scientific-journal-runtime \
  --display-name="ai-scientific-journal runtime (least privilege)"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:ai-scientific-journal-runtime@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding <PROJECT_ID> \
  --member="serviceAccount:ai-scientific-journal-runtime@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
# Storage role is granted scoped to the bucket in E3 (after the bucket exists).
```
(Explicitly NOT owner/editor — §9. The `dev-tutorial=cloud-run-ai-challenge` label is set at first deploy in E2.)

### B7. Secret Manager: store the Gemini key
```bash
# Paste the NEW key when prompted (stdin avoids shell history)
printf '%s' '<YOUR_NEW_GEMINI_API_KEY>' | gcloud secrets create gemini-api-key \
  --data-file=-
```

### B8. Record your values
Fill in and keep these for every later command:
```text
PROJECT_ID      = 
REGION          = 
SA_EMAIL        = ai-scientific-journal-runtime@<PROJECT_ID>.iam.gserviceaccount.com
FIRESTORE_REGION= (same as REGION)
SECRET          = gemini-api-key
```

### ✅ Exit criteria for Manual Block 1
`gcloud config list` shows your project; Firebase console shows Auth (Google enabled) + Firestore (production mode); secret `gemini-api-key` exists; SA exists with the two roles.

---

## C. 👤 MANUAL BLOCK 2 — Production Firebase web config + local verification against real project (you)

### C1. Register the web app in Firebase
Firebase console → Project settings → **Your apps → Web app (`</>`) → Register app** (nickname: `ai-scientific-journal-web`). Copy the `firebaseConfig` values shown — they are **public identifiers** (fine to commit as prod placeholders is NOT desired; we pass them at build time only).

### C2. Create `frontend/.env.production` (NOT committed — used only when you build locally or the deploy step builds with it)
```text
VITE_API_BASE_URL=/api/v1
VITE_USE_FIREBASE_EMULATORS=
VITE_FIREBASE_API_KEY=<from C1 — public identifier>
VITE_FIREBASE_AUTH_DOMAIN=<PROJECT_ID>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<PROJECT_ID>
VITE_FIREBASE_APP_ID=<from C1>
```
(`VITE_USE_FIREBASE_EMULATORS` empty/unset → `config.ts` skips `connectAuthEmulator` → real Firebase Auth.)

### C3. Local production-mode sanity check (optional but recommended before first deploy)
```bash
# from repo root — builds with production env and runs the real container locally
docker build -t asj-local .
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e FIREBASE_PROJECT_ID=<PROJECT_ID> \
  -e GEMINI_API_KEY=<YOUR_NEW_KEY> \
  -e USE_FAKE_AI=false \
  -e CORS_ORIGIN=https://placeholder.run.app \
  asj-local
```
Then `curl http://localhost:8080/api/health` → `{"status":"ok"}` and open `http://localhost:8080/` — the SPA should load and (only once authorized domains include localhost, see note) real Google sign-in may work.
*Note: sign-in from localhost requires adding `http://localhost:8080` to Firebase Auth → Settings → Authorized domains (temporary; remove after).*
This step proves the container + prod env + real Firebase wiring before touching Cloud Run.

---

## D. 👤 MANUAL BLOCK 3 — Deploy the data layer BEFORE public exposure (DEPLOYMENT.md §10 — order is mandatory)

### D1. Deploy Firestore rules + indexes
```bash
# from repo root (firebase.json already points at firebase/firestore.rules + indexes)
firebase deploy --only firestore:rules,firestore:indexes --project <PROJECT_ID>
```
Verify: Firebase console → Firestore → Rules shows the deployed UID-isolation rules.

### D2. Create the private media bucket (uniform bucket-level access, no public access)
```bash
gcloud storage buckets create gs://<PROJECT_ID>-media --location=<REGION> --uniform-bucket-level-access
gcloud storage buckets update gs://<PROJECT_ID>-media --no-public-access-prevention 2>/dev/null # (uniform UBLA already private by default)
# grant the runtime SA object-level access on THIS bucket only:
gcloud storage buckets add-iam-policy-binding gs://<PROJECT_ID>-media \
  --member="serviceAccount:ai-scientific-journal-runtime@<PROJECT_ID>.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```
(`STORAGE_BUCKET` env var on Cloud Run will be set to `<PROJECT_ID>-media` at deploy; `storagePaths.ts` derives `users/{uid}/observations/...` inside it — objects are private, access only via backend-signed URLs.)

### D3. Sanity-check what exists so far
```bash
gcloud secrets versions list gemini-api-key
gcloud iam service-accounts list | grep ai-scientific-journal
gcloud storage buckets list
```

---

## E. 👤 MANUAL BLOCK 4 — First Cloud Run deployment

### E1. Build & push the image
```bash
gcloud auth configure-docker <REGION>-docker.pkg.dev
docker build -t <REGION>-docker.pkg.dev/<PROJECT_ID>/ai-scientific-journal/app:v1 .
docker push <REGION>-docker.pkg.dev/<PROJECT_ID>/docker... # ← see correction below
```
**Correction (use this exactly):**
```bash
docker push <REGION>-docker.pkg.dev/<PROJECT_ID>/ai-scientific-journal/app:v1
```

### E1-alt. (Alternative, simpler — skips local Docker entirely)
```bash
gcloud run deploy ai-scientific-journal \
  --source . \
  --region <REGION> \
  --service-account <SA_EMAIL> \
  --set-env-vars NODE_ENV=production,STORAGE_BUCKET=<PROJECT_ID>-media \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --labels dev-tutorial=cloud-run-ai-challenge \
  --allow-unauthenticated
```
* `--source .` builds in Cloud Build from the Dockerfile — no local Docker needed, matches DEPLOYMENT.md §11's conceptual command.
* `--allow-unauthenticated`: required because the SPA is public and the API enforces auth itself (per-request Firebase ID token). Cloud Run-level auth would break the SPA; endpoint security is app-layer (per SECURITY.md §16 — verified in A7's checklist).

### E2. Post-deploy immediate checks
```bash
# note the URL from deploy output:
SERVICE_URL=https://ai-scientific-journal-<hash>-<region>.run.app
curl $SERVICE_URL/api/health    # → {"status":"ok"}

# confirm the label (competition requirement):
gcloud run services describe ai-scientific-journal --region <REGION> --format="value(metadata.labels)"
```

### E3. Firebase Auth authorized domains
Firebase console → Authentication → Settings → **Authorized domains → Add domain** → the Cloud Run domain (`ai-scientific-journal-<hash>-<region>.run.app`). Google Sign-In from the deployed SPA will not work until this is added.

### E4. **First real smoke test (you run the script from A5)**
```bash
node scripts/smoke-test.mjs $SERVICE_URL
```
Then in a browser: sign in with Google on the deployed URL, create an observation, check it in Firestore console, sign out/in — persistence on **real Firestore**. If anything fails here, the debugging loop is: `gcloud run services logs read ai-scientific-journal --region <REGION> --limit 50`.

**🎯 MILESTONE — the phase's core deliverable is live.** Everything after this hardens and proves it.

---

## F. AGENT BLOCK 2 — Post-deploy hardening (agent work again, uses the live service)

### F1. CORS lock-down
* Set `CORS_ORIGIN=https://<SERVICE_URL-domain>` (update via `gcloud run services update ... --update-env-vars`) — currently defaults to localhost. (Agent writes the exact command into the deploy notes; you run it, or it becomes Manual addendum.)

### F2. Production smoke verification of the §13 checklist
* Extend `scripts/smoke-test.mjs` if live behavior revealed gaps; run the full §13 browser checklist (the manual part you already did in E4; agent documents results in the testing log).

### F3. Observability wiring — 👤 small manual part
* **Agent:** write `infrastructure/cloud-run/monitoring.md` (or dashboard JSON) describing the OBSERVABILITY.md §11 dashboard sections and alert policies with exact `gcloud alpha monitoring` / console steps, tuned to what the service actually emits after F2.
* **You (10 min):** create the dashboard + 2–3 alert policies in the console per that doc (error-rate, 429 rate-limit hits, AI_UNAVAILABLE rate). Baselines first, thresholds after a day of traffic (OBSERVABILITY.md §13 philosophy: alert from observed baselines).

### F4. Security checklist execution (SECURITY §16)
* Agent produces the filled `SECURITY.md` §16 checklist + §31 matrix results in `plans/phase-9/testing-logs.md`, based on live service checks where possible (headers, unauthenticated probes, cross-user spot-check via two emulator-minted→real accounts).
* Prompt-injection and AI-failure re-verification against the **real Gemini** (all prior suites used the fake): one manual-ish test round asking the deployed service a leading/injection question; assert insufficient-evidence/guardrail behavior. Findings documented.

### F5. Regression suite re-run + PR
* Full local gates + CI green; testing log with: what was deployed (image/revision), env/secret bindings, smoke results, §16 checklist, eval results, deviations.
* Open PR `feature/phase-9-production-hardening` → `dev`.

### ✅ Phase exit criteria (all mandatory)
1. Service live on Cloud Run, labeled `dev-tutorial=cloud-run-ai-challenge` ✅
2. `GET /api/health` + full §13 smoke checklist pass on production ✅
3. Secrets only via Secret Manager; runtime SA least-privilege; §16 checklist fully ticked ✅
4. Rules + indexes deployed **before** exposure; cross-user spot-check on prod ✅
5. Golden eval suite + security/eval gates green in CI ✅
6. Observability dashboard + baseline alerts exist ✅
7. Progress/testing logs updated; no dev-only code paths in the shipped image (`USE_FAKE_AI` production-impossible) ✅

---

## G. Risks & Notes

| Risk | Mitigation |
|---|---|
| Gemini key exposure (pasted in chat) | Regenerate in B0; old key deleted; new key only in Secret Manager |
| `USE_FAKE_AI` accidentally shipping | A1/A2 production guard + unit tests; image contains no `.env` (`.dockerignore`) |
| Firestore region mismatch (bucket/Run in different region) | B4 decision: one region for everything |
| Cloud Run + emulator-style env mix-ups | Production refinement rejects emulator env vars if set in prod (add to A2) |
| `--allow-unauthenticated` at Cloud Run level | Correct here: app-layer authN/Z on every `/api/v1` route; only `/api/health` public (SECURITY.md §16 verified); SPAs require public serving |
| Rate-limit correctness behind Cloud Run | `trust proxy` already set; verify `req.ip` is the LB-forwarded client in logs during E4 smoke |
| Billing surprise | Cloud Run free tier + min-instances=0 (default); Gemini usage bounded by ADR-008 limits; check Billing → Reports after first week |
| Manual-block ordering mistakes (exposing before rules deploy) | D precedes E by mandate (DEPLOYMENT.md §10); checklist in §F5 re-verifies |

## H. Defer-record items (documented, not this phase)
* Scheduled GC for orphaned media blobs (phase-7 residual) — needs Cloud Scheduler; record as follow-up if not cheaply done via a startup sweep.
* memoryStorage → streaming uploads (phase-7 residual; Cloud Run RAM headroom is 512 MiB default — acceptable at MVP scale).
* Automated deploy pipeline (DEPLOYMENT.md §11: manual `gcloud` deploy is canonical for MVP; CI-CD automation is a process change, not required).
* Staging environment (DEPLOYMENT.md §3: optional, deferred).
