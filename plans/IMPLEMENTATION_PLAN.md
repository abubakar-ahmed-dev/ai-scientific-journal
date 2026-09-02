# Implementation Plan — AI Scientific Journal

**Status:** High-level implementation roadmap (not a task-by-task breakdown)
**Created:** 2026-09-02
**Source of truth:** The canonical documents in `docs/` (PRD, TECHNICAL_ARCHITECTURE, SECURITY, DATABASE_SCHEMA, API, AI_ARCHITECTURE, TESTING, AI_EVALUATION, OBSERVABILITY, ADR) plus `README.md`. Where this plan summarizes them, the canonical documents prevail.

---

## 1. Purpose and Constraints

This plan defines **what** is implemented, **in what order**, and **why** — across roughly
6–10 meaningful phases. It deliberately does **not** prescribe file-level tasks, function
signatures, or step-by-step work items; those belong in per-phase plans under `plans/`.

Ordering follows the dependencies the architecture itself imposes:

1. **Security boundaries come first** — every later feature inherits auth, ownership, and
   validation from Phase 2; features built before those foundations would have to be retrofitted
   (SECURITY.md §33–§34 makes isolation tests part of every feature's "done").
2. **The data model precedes every API and AI feature** — Firestore paths, ownership fields,
   and deletion cascades (DATABASE_SCHEMA.md §3, §19) are referenced by every endpoint and
   every AI pipeline.
3. **Core CRUD precedes AI** — the AI layer's core guarantee ("AI failure never loses user
   content", AI_ARCHITECTURE.md §10) is only meaningful once user content exists and is
   durable without Gemini.
4. **RAG comes after basic generation** — `/ai/ask` and `/ai/search` reuse the AI Service
   abstraction, context assembly, and output validation built for the generation endpoints.
5. **Hardening and deployment are cumulative gates**, not afterthoughts — CI and observability
   exist from the first scaffold and grow with each phase (TESTING.md §15, OBSERVABILITY.md).

Hard constraints honored throughout (already fixed by the docs — not decisions for this plan):

* Modular monolith: **one Cloud Run service serves the React SPA and the `/api/v1` API**
  (DEPLOYMENT.md §2).
* Business API under `/api/v1`; `GET /api/health` unversioned (ADR-018).
* Observation is the single fundamental record; no `/journalEntries`, `/summaries`, `/insights`,
  `/api/v1/api/chat` — prohibited resources in API.md §8 must never be introduced.
* UID from the verified Firebase ID token only; foreign resources return existence-hiding `404`.
* Analyses are append-only and never mutate user content; research tasks require explicit user
  acceptance (ADR-015, API.md §6.14).
* Deferred decisions stay deferred until their phase: maps provider, storage client,
  version-history activation, embedding/vector tech (ADR-016, ADR-020).
* No infrastructure beyond what the canonical stack commits to (PRD §8 infrastructure
  principle): no Kubernetes, Redis, Kafka, Nginx, extra databases, or second AI provider.

---

## 2. Phase Overview

| # | Phase | Deliverable in one line |
| - | ----- | ----------------------- |
| 1 | Repository & Tooling Foundation | Runnable CI'd monorepo skeleton (frontend + backend + firebase + infra) |
| 2 | Security & Data Foundation | Auth, Firestore model + rules, backend authz/validation/error middleware |
| 3 | Core Domain CRUD | Full observations/projects/me(/media-ready) API per API.md |
| 4 | AI Foundation & Conversational AI | AI Service abstraction + stateful chat via conversation messaging |
| 5 | Structured AI Analyses | summarize / analyze / suggest-research pipelines + analyses/tasks surface |
| 6 | RAG — Ask My Journal & Related Observations | Derived index + `/ai/ask` + `/ai/search` |
| 7 | Media, Location & Research Map | Evidence media, location precision, deferred-provider map feature |
| 8 | Frontend Application Completion | All PRD pages/workflows against the finished API |
| 9 | Production Hardening & AI Evaluation | Security/API/eval suites, observability, production deployment |

Phases 7 and 8 are partially parallelizable; Phase 9's deployment half can start once any
deployable increment exists. See §4.

> Scope note (PRD §15/§16, TA §87/§88): if time becomes constrained, the MVP boundary is
> Phases 1–5 (+ deployment from Phase 9). Phase 6 (RAG) is the top differentiation feature
> to protect; Phase 7 media/map is the first thing to trim (location *fields* are cheap and
> stay; the map *rendering* defers cleanly per ADR-020).

---

## 3. The Phases

### Phase 1 — Repository & Tooling Foundation

**Goal:** A clean, CI-governed monorepo skeleton that both agents can build on without
re-deciding conventions.

**Major features/components:**

* Repository structure per TA §9 (canonical): `frontend/`, `backend/`, `firebase/`,
  `infrastructure/`, `scripts/`, `.github/workflows/` — including `.env.example` files
  (placeholders only) and `.gitignore`/`.dockerignore` that exclude secrets and dev artifacts.
* Backend skeleton: Express app with the canonical middleware order (TA §77: requestId →
  security headers → CORS → rate-limit → auth → authorization → validation → controller →
  error handler), centralized validated config (`backend/src/config/env.ts`, fail-fast per
  TA §44), the error-code registry and `{data, meta}` / `{error:{code,message,requestId}}`
  envelopes from API.md §1.4/§3, `GET /api/health` (unversioned, public).
* Frontend skeleton: Vite + React + TS + Tailwind + shadcn/ui + TanStack Query app shell
  (routing, providers, query client, API client that attaches the Firebase ID token —
  wire format now, real auth in Phase 2).
* Vitest in both apps; GitHub Actions CI running lint → typecheck → unit tests → build
  (TESTING.md §15), per-app.
* Dockerfile producing a runnable single-service container (serves built SPA + API on `$PORT`),
  buildable in CI.

**Dependencies / prerequisites:** None (first phase).

**Key documentation:** TA §5, §9, §28, §34, §41, §44, §45, §77; API.md §1–§3; ADR-012, ADR-018,
ADR-019; TESTING.md §1, §15; OBSERVABILITY.md §3.

**Expected outcome (definition of done):**

* `npm run dev` runs frontend and backend locally; CI green on the skeleton.
* `GET /api/health` returns `200 {"status":"ok"}`; unknown routes and malformed requests
  return registry error envelopes.
* Docker build succeeds and the container serves the health endpoint on `$PORT`.
* No secrets or `.env` files committed; `.env.example` files present.

**Risks / considerations:** Keep this phase thin — it is easy to over-scaffold. Reserved
schemas (versions, media, analyses tables) are *defined* in docs but must **not** be
implemented before their phases; only the seams (e.g., AI Service interface shape, error
registry) get created here.

---

### Phase 2 — Security & Data Foundation

**Goal:** The security spine and the canonical Firestore data model, so every later feature
inherits authentication, ownership, validation, and isolation by construction.

**Major features/components:**

* Firebase Auth (Google Sign-In) end-to-end: client sign-in/sign-out/persistence (PRD FR-01),
  backend middleware verifying the ID token and deriving the UID from the token only
  (API.md §2). The Phase 1 API client goes live.
* Firestore deployment artifacts: `firebase/firestore.rules` implementing the UID-subtree
  rule with field validation (ownerId immutable, server-managed fields not client-writable,
  optional-`projectId` `get()` integrity), `firestore.indexes.json` with the §18 composites.
* Backend data layer: the shared repository pattern, server-timestamp conventions, and
  Zod schemas mirroring the validation rules in scope. Entity-specific repositories land
  with the phases that introduce their endpoints (Phase 3+) — Security Rules and composite
  indexes cover the full canonical model from day one, but repository code for
  not-yet-used collections is not pre-built.
* User document lifecycle: lazy create/refresh on first authenticated request
  (`GET /api/v1/me` behavior, API.md §6.2).
* Isolation test backbone: the multi-user (User A / User B) fixture set of TESTING.md §12
  and Firestore rules tests covering the entire UID subtree — every canonical collection,
  including ones whose endpoints don't exist yet (TESTING.md §6) — against the emulator.
  The API-level authorization matrix (TESTING.md §5) starts with what exists here and
  extends per endpoint as phases land.

**Dependencies / prerequisites:** Phase 1 (skeleton, CI, config, middleware chain).

**Key documentation:** SECURITY.md §2–§8, §29, §32; DATABASE_SCHEMA.md §3–§7, §16–§21;
API.md §2, §6.2; ADR-006, ADR-014; TESTING.md §5–§6, §12.

**Expected outcome:**

* Sign-in works; protected placeholder routes reject unauthenticated (`401`) and foreign
  access (`404` existence-hiding).
* Rules + backend ownership enforced independently (defense in depth, SECURITY.md §6/§8);
  rules tests green for every canonical collection; the API-level matrix automated for
  existing endpoints.
* All §18 composite indexes deployed to the emulator/dev project; rules tests pass.

**Risks / considerations:** This is the phase where shortcuts are most expensive. SECURITY.md
§34 applies from here on: a later feature is not done until its isolation tests exist. Firestore
rules + emulator setup is the most tooling-sensitive piece of the project — allocate time for it.

---

### Phase 3 — Core Domain CRUD

**Goal:** The journal works without AI: observations (incl. freeform entries), optional
projects, and the user profile — the durable core that everything else enriches.

**Major features/components:**

* Full `projects` endpoints (API.md §6.3–6.4) including the delete → re-file-to-null
  semantics (never cascade-delete user content; analyses retain their `projectId` as a
  dangling historical reference per ADR-021).
* Full `observations` endpoints (§6.5): create/read/list/filter/paginate (cursor pagination,
  `sort=updated|observed` cursor separation), update with `expectedVersion` optimistic
  locking (`409`), delete with the full §19 cascade (versions/media/search entry; analyses
  not yet created but the cascade logic lands here), `ownerId`/`status:"analyzed"`/
  `mediaCount`/`version` server-managed.
* **Observation versioning activated here** (read-only `versions` endpoints per §6.7 +
  internal snapshot-on-edit per §6.5/ADR-016): ADR-016 defers versions to "the observation
  editing phase" — since this phase *is* the editing phase, shipping PATCH without
  version snapshots would reverse an accepted ADR and require schema retrofit later.
* `GET|PATCH /api/v1/me` (§6.2) with immutable-field enforcement.
* The derived search-index hook: `observationSearch` write/update-on-observation-write and
  delete-with-observation lifecycle (ADR-017) — the retrieval *plumbing* now, retrieval
  *quality* in Phase 6.
* Frontend: sign-in-gated app shell with the first real pages — dashboard and the
  observation list/create/detail flows — wired via TanStack Query, with loading/empty/
  error/retry states per TA §54.

**Dependencies / prerequisites:** Phase 2 (auth, data model, validation, ownership).

**Key documentation:** API.md §5, §6.2–§6.5, §7.1; DATABASE_SCHEMA.md §6–§9, §16, §18–§19;
ADR-013, ADR-014; TESTING.md §4 (endpoint cases), §11.

**Expected outcome:**

* A user can sign in, create/edit/delete observations and projects, and see their data
  persist across sessions (PRD FR-04, FR-06) — the competition's Firestore-persistence
  requirement is demonstrable.
* Pagination, filters, optimistic locking, and deletion cascades behave per API.md;
  endpoint + isolation tests green (AI-independent core: provable with Gemini down).
* First usable UI exists end-to-end.

**Risks / considerations:** Cursor pagination on `updatedAt` vs scientific `observedAt`
sorting has subtle contract requirements (API.md §5.3) — follow them exactly; this is the
most commonly botched API detail. The ADR-016 version *UI* (history viewing) may still be
deferred to Phase 8, but the snapshot + read-only endpoint contract must exist now.

---

### Phase 4 — AI Foundation & Conversational AI

**Goal:** The AI Service abstraction and the first AI capability — multi-turn conversation —
proving the pipeline discipline (persist user content first; validate before persisting AI
output; fail without losing data).

**Major features/components:**

* **AI Service interface + Gemini adapter** (AI_ARCHITECTURE.md §2): the only SDK touchpoint;
  model config centralized (`AI_MODEL` env, TA §5.5); timeout/retry/error-mapping policy;
  testable via fake service/scripted adapter (TESTING.md §13).
* Context assembly: bounded, authorized, minimum-necessary context builder (AI_ARCHITECTURE.md §6).
* Conversation endpoints (API.md §6.10–6.12): create/list/get/patch(title|status)/delete with
  `contextType`/`contextId` validation and ownership checks; message list with
  `sequence` pagination; **`POST …/messages` as the single stateful chat surface** —
  persist user message → bounded context → Gemini → validate → persist assistant message →
  update counters. Idempotent retry regenerates a missing assistant turn without duplicating
  the user message.
* Conversation delete cascade (messages deleted, analyses retained — §7.1).
* Frontend: conversation list + chat UI with explicit AI-failure states (retryable error,
  user message preserved).
* Failure behavior per AI_ARCHITECTURE.md §10 mapped to the registry codes
  (`503 AI_UNAVAILABLE`, `502 AI_INVALID_RESPONSE`), chat-tier rate limiting (API.md §4.1),
  `Idempotency-Key` handling.

**Dependencies / prerequisites:** Phase 3 (conversations/messages persist over the data layer;
  observations exist as context candidates); Phase 2 (auth/rate-limit seams). The Gemini API
  key + Secret Manager path is needed here (locally via env; the Secret Manager binding itself
  is exercised in Phase 9 but the config seam must exist now — TA §38/§44).

**Key documentation:** AI_ARCHITECTURE.md §2–§4, §7, §8, §10; API.md §4, §6.10–§6.12, §7.3;
DATABASE_SCHEMA.md §11; TESTING.md §9, §11; ADR-003, ADR-009, ADR-010, ADR-018.

**Expected outcome:**

* Multi-turn Gemini conversation with durable history (PRD FR-03); user messages survive
  Gemini outages and the client can retry cleanly (PRD AI-10).
* The AI Service boundary is proven: application code has zero direct SDK calls; failure
  mapping, context bounding, and validate-before-persist are in one place.
* Chat rate limits + idempotency active; failure-injection tests green (TESTING.md §11).

**Risks / considerations:** The abstraction's seam placement matters — get it wrong and
Phase 5/6 will either bypass it or duplicate logic. This is the highest-leverage architectural
moment of the project (TA §79/§92). Also the first external-cost surface: respect ADR-008
limits from day one.

---

### Phase 5 — Structured AI Analyses

**Goal:** The product's scientific differentiator — validated, provenance-stamped analyses
and the research-task workflow.

**Major features/components:**

* Generation pipelines for `summary`, `analysis`, `research_suggestions`
  (`POST /ai/summarize|analyze|suggest-research`, API.md §6.15): source ownership validation →
  authorized context assembly → Gemini → parse → schema validation → application validation →
  append-only `analyses` persistence with `model` + `promptVersion` provenance.
* Versioned prompt modules in `backend/src/ai/prompts/` (TA §80) with prompt-layer separation
  and untrusted-content framing (AI_ARCHITECTURE.md §7, ADR-010).
* Analyses read surface (§6.13): list with filters (`observationId`, `conversationId`, `type`,
  `projectId`), read with `?includeSources=summary` and dangling-source handling (§7.2).
* `analyzed` status write-back: the single permitted AI→observation mutation, server-side only.
* Research-task endpoints (§6.14): user-created tasks **and** the AI-suggestion acceptance
  flow (`source: "gemini"`, `sourceAnalysisId` ownership-checked, `suggestionIndex` validated,
  idempotency prevents double-acceptance), status-transition validation.
* Frontend: analyses views distinguishing user content vs AI interpretation vs hypotheses
  (confidence) vs uncertainty (PRD FR-14); suggestion → "accept as task" flow; research
  task list/management.
* AI output-validation test suite (the malformed-output zero-write suite, AI_EVALUATION §7 /
  TESTING §9) and first golden evaluation cases (AI_EVALUATION §13.1).
* **E2E regression backbone established** (TESTING.md §8): the primary journey — sign-in →
  create observation → chat → analysis → accept suggestion as task → sign-out/in persistence —
  automated against emulated dependencies with a stubbed Gemini adapter. Every later phase
  extends this journey instead of re-establishing it.

**Dependencies / prerequisites:** Phase 4 (AI Service, validation pipeline, error semantics).

**Key documentation:** AI_ARCHITECTURE.md §3, §8, §9; DATABASE_SCHEMA.md §12–§13;
API.md §6.13–§6.15, §7.2; ADR-009, ADR-015; AI_EVALUATION.md §2, §7, §13; TESTING.md §4, §9.

**Expected outcome:**

* `summary` / `analysis` / `research_suggestions` generate, validate, persist with
  provenance, and render — AI content distinguishable from user content by schema (PRD FR-05, FR-14).
* Users accept suggestions into research tasks; AI cannot create tasks autonomously
  (PRD FR-15) — enforced and tested.
* Analyses retained with dangling references when sources are deleted (approved RETAIN
  decision, tested); malformed model output is never persisted (zero-write assertions green).

**Risks / considerations:** Reserved types `hypothesis`/`classification` must remain
schema-valid but unimplemented (no endpoints/prompts — AI_ARCHITECTURE.md §3). Prompt quality
iteration starts here and never stops — that's what `promptVersion` and the evaluation
regression loop (§11 of AI_EVALUATION) are for; keep the golden cases small but real.

---

### Phase 6 — RAG: Ask My Journal & Related Observations

**Goal:** Grounded Q&A over the user's own history and retrieval-only related-observation
search — the flagship intelligence features (PRD FR-16, FR-17).

**Major features/components:**

* Retrieval engine over the derived index built in Phase 3: UID-scoped query by path →
  candidate fetch → reranking → re-check against canonical observations (deleted sources
  never surface). Embedding/vector choice made **here** if needed, with its own ADR
  (AI_ARCHITECTURE.md §5, ADR-020 pattern).
* `POST /api/v1/ai/ask` (§6.15): grounded answer + `evidence[]` + `uncertainties[]`;
  insufficient-evidence behavior (empty evidence, explicit statement — never fabricate);
  optional `conversationId` persistence of the exchange as messages.
* `POST /api/v1/ai/search` (§6.15): retrieval-only, no generation/persistence; powers
  related observations and pre-chat retrieval.
* Frontend: Ask-My-Journal experience with evidence attribution and uncertainty display;
  related-observations integration on observation pages; research map-ready retrieval hooks.
* AI-tier rate limits; retrieval-failure semantics (§10 of AI_ARCHITECTURE: no generation
  from a half-failed context).
* RAG evaluation suite: retrieval recall/precision cases, isolation cases (multi-user dataset,
  cross-user probes), groundedness and insufficient-evidence cases (AI_EVALUATION §5–§6).

**Dependencies / prerequisites:** Phase 5 (AI Service, output validation — ask's response is
validated like any other AI output); Phase 3 (index lifecycle plumbing). **Must come after
basic generation** because it reuses the entire pipeline and adds only retrieval + grounding.

**Key documentation:** AI_ARCHITECTURE.md §5–§7, §10; API.md §6.15; DATABASE_SCHEMA.md §14;
ADR-017; AI_EVALUATION.md §5–§6, §9; SECURITY.md §10; TESTING.md §10.

**Expected outcome:**

* Users ask questions across their own journal and get grounded answers with cited
  observations and honest insufficiency behavior (PRD AI-05/AI-07).
* Retrieval is provably UID-scoped outside the model; a multi-user probe suite is green.
* `/ai/search` returns ranked, canonical-verified references without generation.

**Risks / considerations:** The embedding/vector infrastructure decision belongs here, not
earlier — and the docs deliberately leave it open (schema's `embeddingReference`/
`embeddingVersion` fields keep it swappable). Resist adding a vector database before retrieval
quality actually requires it (PRD §8 infrastructure principle). Insufficient-evidence behavior
is a **test gate**, not a prompt nicety (AI_EVALUATION §5.2).

---

### Phase 7 — Media, Location & Research Map

**Goal:** Evidence and place: private observation-scoped media, user-controlled location
precision, and the research map — the experiential differentiators of PRD Phase 2.

**Major features/components:**

* Media upload/read/delete per API.md §6.8: MIME/size validation, backend-derived private
  Cloud Storage paths (`users/{uid}/observations/{obsId}/{mediaId}`), `storagePath` never in
  any response, short-lived authorized read URLs, `mediaCount` maintenance, orphan cleanup on
  partial failure. **Storage client choice (Firebase SDK vs Cloud Storage SDK) is decided
  here, recorded as an ADR (ADR-016/ADR-020).**
* Location handling: `location` object with `precision: exact|approximate|hidden` honored in
  UI, storage, and any AI context that includes it (SECURITY.md §14); device location +
  manual pin placement (PRD FR-12).
* Research map (PRD FR-13): observation pins, click-to-inspect, filter by category/time/tags.
  **Map provider choice (Google Maps Platform vs Leaflet) is decided here, recorded as an ADR
  (ADR-020)**, including the public-but-restricted Maps-key security note in SECURITY.md.
* Cloud Storage deploy items: private bucket (uniform bucket-level access), runtime SA
  object permissions (DEPLOYMENT.md §10).
* Media/location security tests: untrusted-file validation, path-derivation assertions,
  precision-honoring checks, cross-user media probes (TESTING.md §4/§6).

**Dependencies / prerequisites:** Phase 3 (observations own the media/location fields — the
schema is already fixed). The private storage bucket and the runtime service account's
Storage permissions are provisioned **in this phase** (first real need); Phase 9 then
audits the full IAM posture rather than being a prerequisite for it.

**Key documentation:** API.md §6.8; DATABASE_SCHEMA.md §7, §10, §19; ADR-016, ADR-020;
SECURITY.md §14–§15; PRD FR-11–FR-13; TESTING.md §4, §6.

**Expected outcome:**

* Users attach evidence and locations to observations; binaries are private, access flows
  only through authenticated short-lived URLs; `storagePath` absent from all responses.
* Research map renders the user's observations geographically with precision honored;
  map/Maps failure degrades gracefully without blocking observation capture (PRD NFR-02).
* Media deletion cascades (storage object + metadata + `mediaCount`) per §19; upload
  validation and cross-user probes tested.

**Risks / considerations:** Two deliberately deferred decisions land here (storage client,
maps provider) — each requires its own ADR and a SECURITY.md note for the Maps key. Media is
the largest untrusted-input surface in the app (SECURITY.md §15) — validation is security, not
polish. This phase is also the first to introduce a new paid external service (maps), so keep
the ADR-020 cost note in mind.

---

### Phase 8 — Frontend Application Completion

**Goal:** Complete the responsive web application — every PRD workflow against the finished
API, with the usability bar (NFR-03) met everywhere.

**Major features/components:**

* Remaining pages/flows per TA §9/§54: dashboard aggregation view (observations, conversations,
  analyses, tasks at a glance), projects management, settings/profile (`/me`, preferences),
  landing page, full research-assistant surface, and the version-history UI for the
  read-only versions API shipped in Phase 3.
* Cross-cutting UX contracts: every view implements loading/empty/success/error/retry states
  (TA §54); AI vs user content distinction everywhere (PRD FR-14); dangling-source rendering
  ("source deleted", API.md §7.2); AI-failure UX preserving user input; `hidden` location
  never rendered; keyboard/semantics/contrast accessibility (TA §55).
* Frontend component/state test suite (TESTING.md §7) and the **extension** of the stubbed-AI
  E2E journey (established in Phase 5, TESTING.md §8) to the newly landed surfaces —
  including the version-history UI flow.

**Dependencies / prerequisites:** Phases 3–7 supply the API surface; this phase consumes all
of it. (In practice, much frontend work happens incrementally inside Phases 3–7 — this phase
is the completion and consistency pass, not the first UI work.)

**Key documentation:** PRD FR-02, NFR-03; TA §9, §52–§55, §66; TESTING.md §7–§8; API.md §7.2.

**Expected outcome:**

* The full PRD Phase 2/3 user journey runs end-to-end in the browser against the real API
  (AI stubbed in tests), with all states and the user/AI distinction demonstrable.
* Responsive behavior verified desktop + mobile (NFR-03); accessibility basics in place.

**Risks / considerations:** Main risk is scope creep in polish — hold to the NFR-03 bar
(intuitive, responsive, clear states) without inventing features the PRD lists as optional
(voice, auto-tagging, offline: FR-18–FR-24 stay out unless explicitly pulled in later).

---

### Phase 9 — Production Hardening & AI Evaluation

**Goal:** Prove the system production-ready: complete the security/testing/evaluation gates,
wire observability, and deploy to Cloud Run.

**Major features/components:**

* **Cloud Run deployment:** final Docker hardening (non-root, prod-only deps), runtime
  service account (least privilege: Firestore + Secret Manager + Storage only), Secret
  Manager binding for `GEMINI_API_KEY`, service `ai-scientific-journal` with the required
  `dev-tutorial=cloud-run-ai-challenge` label, CORS/origin config, rules + indexes deployed
  before public exposure, rollback via revisions (DEPLOYMENT.md §6, §9–§11, §15).
* **Observability:** Pino structured logs with requestId correlation, the §8 AI operation
  signals, Cloud Monitoring dashboard (OBSERVABILITY.md §11) + alert policies from observed
  baselines; privacy rules verified (never content/tokens/secrets in logs).
* **Security completion:** the full pre-launch edge-case matrix (SECURITY.md §30) and
  security-testing suite (§31) executed as automated tests where not already covered;
  §16 production security checklist pass.
* **AI evaluation:** the MVP evaluation suite of AI_EVALUATION §13 in CI (mocked) with the
  golden-case rubric sampling; regression harness for prompt/model changes (§11).
* **Final testing layers:** E2E + production smoke checklist (DEPLOYMENT.md §13), including
  the user-isolation spot-check on production.
* Remaining rate-limit/idempotency audit across all endpoints (API.md §9 checklist) if any
  gaps surfaced in earlier phases.

**Dependencies / prerequisites:** All feature phases; deployment can begin incrementally
as soon as a deployable slice exists (health + auth + CRUD), with this phase as the
*completion gate* rather than the first deployment.

**Key documentation:** DEPLOYMENT.md (all); OBSERVABILITY.md §3–§14; SECURITY.md §27, §30–§31,
§33–§35; AI_EVALUATION.md §11–§13; TESTING.md §15–§16; PRD §14 (compliance checklist).

**Expected outcome:**

* Production service deployed, smoke-tested, labeled, rollback-verified; secrets only via
  Secret Manager; rules deployed and cross-user tested before exposure.
* Observability live: request/AI/data/security signal sections on the dashboard.
* SECURITY.md §34 definition-of-done satisfied for the shipped feature set; PRD §14
  competition compliance checklist passes.

**Risks / considerations:** Deploying is not the end — the phase's exit is the *checklist*
(smoke + security + evaluation gates), not a live URL. GCP project/Firebase project setup
(needed before first deploy) is operational work nobody's phase owns explicitly — schedule it
at the start of this phase (or as part of Phase 1 if deploy-early is desired). Watch cold-start
and AI timeout behavior in production config tuning (DEPLOYMENT.md §6).

---

## 4. Dependency Graph

```text
Phase 1  Repository & Tooling Foundation
   ↓
Phase 2  Security & Data Foundation
   ↓
Phase 3  Core Domain CRUD
   ↓
Phase 4  AI Foundation & Conversational AI
   ↓
Phase 5  Structured AI Analyses
   ├──────────────┬─────────────────────────────┐
   ↓              ↓                             ↓
Phase 6  RAG     Phase 7  Media,          Phase 8  Frontend
(ask, search)    Location & Map           Completion
   └──────────────┴─────────────┬───────────────┘ (8 needs 6–7's APIs;
   (6 & 7 parallel; 8 waits      ↕                7's map UI decision)
    only on 5)              Phase 9
                       Production Hardening
                       & AI Evaluation
                       (deployment track runs
                        incrementally from Phase 3
                        onward; gates close last)
```

Strictly serial spine: **1 → 2 → 3 → 4 → 5** (each is a hard prerequisite of the next:
tooling → security/data → durable domain → AI seam → structured generation). After Phase 5
the graph branches; Phase 9 converges all branches.

**Phases that can safely proceed in parallel:**

* **Phase 6 ‖ Phase 7** — RAG and media/map touch disjoint surfaces (AI retrieval layer +
  `/ai/*` endpoints vs media endpoints + storage + map UI). Shared files are limited to
  observation service seams (already stable since Phase 3) and the frontend route table.
* **Phase 8 ‖ Phases 6–7** (partially) — frontend completion for Phases 1–5 surfaces can
  start immediately after Phase 5; only the map UI and related-observation UI pieces wait
  on the Phase 6–7 provider/retrieval decisions.
* **Phase 9 (deployment track) ‖ anything after Phase 3** — Cloud Run deploy of a working
  increment, IAM/Secret Manager wiring, and observability plumbing can proceed while later
  features develop; the *hardening/evaluation gates* close only after all features land.

---

## 5. Recommended Parallelization (Antigravity ↔ Claude)

Assignments assume the CLAUDE.md/AGENTS.md conventions: feature branches per work item,
no work on `main`, no cross-agent resets, per-phase progress logs under `plans/`. The split
follows the repository's stated tooling philosophy (PRD §8, §12: Antigravity is the primary
engineering environment; both agents work from the same canonical docs).

| Work package | Suggested owner | Rationale / conflict surface |
| ------------ | --------------- | ---------------------------- |
| Phase 1 monorepo scaffold + CI | **Sequential (single agent)** | Sets every convention; parallelizing a scaffold guarantees merge conflicts. Antigravity is the documented primary environment (PRD §12). |
| Phase 2 backend security/data layer (middleware, repositories, rules, tests) | **Antigravity** | Coherent single-owner workstream; rules + auth middleware are the project's most safety-critical code. |
| Phase 3 observations/projects API + services | **Antigravity** (continuity from Phase 2's repositories) | Same layer, same owner minimizes seam mistakes. |
| Phase 3/4/5 **frontend** app shell → pages for the APIs that exist | **Claude** | Frontend (`frontend/`) and backend (`backend/`) are disjoint trees — the cleanest parallel split in the repo. Only shared file: `API.md`-derived types if kept in a shared location (duplicate them per-app instead to stay decoupled). |
| Phase 4 AI Service + adapter + chat pipeline | **Sequential after Phase 3 backend** | The abstraction seam is high-leverage; single-owner avoids divergent adapter patterns. |
| Phase 5 analysis pipelines + prompts | **Antigravity** (backend continuity) | Extends Phase 4's pipeline in the same tree. |
| Phase 5/6 evaluation cases + test suites (`tests/ai/`) | **Claude** | Test/eval authoring is naturally parallel to implementation and lives mostly in test trees; Claude verifies the implementer's work independently (per CLAUDE.md "Do Not Trust Previous Claims"). |
| Phase 7 media/storage backend | **Antigravity** | Backend continuity; the storage-client ADR decision should be authored by whoever holds backend context. |
| Phase 7 map frontend | **Claude** | Frontend tree; provider decision feeds a SECURITY.md note — coordinate the doc edit. |
| Phase 6 RAG backend (retrieval, /ai/ask, /ai/search) | **Sequential after Phase 5** or paired with Claude-authored eval suites | Depends on Phase 5's validation pipeline; pairing implementer + independent eval author is the highest-value parallelism. |
| Phase 8 frontend completion | **Claude** | Owns the frontend tree end-to-end by then. |
| Phase 9 deployment/infra (`infrastructure/`, CI workflows, Cloud Run) | **Either, then review by the other** | Infra tree is disjoint from app code; SECURITY.md §31/DEPLOYMENT.md §16 checklists benefit from cross-agent review (each agent verifies independently). |
| Phase 9 security/eval gate execution | **Both, split by suite** | §30/§31 matrix vs AI_EVALUATION §13 suites are separable; each writes to distinct test directories. |

**Conflict-avoidance rules for parallel work:**

1. Split primarily by **directory ownership** (`frontend/` vs `backend/` vs `infrastructure/`
   vs `tests/`) — never by feature across the same tree.
2. Documentation edits (`docs/`, SECURITY.md notes, new ADRs) are serialized: whoever lands
   the decision writes the doc in the same PR as the decision.
3. Shared-contract files (`API.md`-derived type definitions) are **duplicated per app**, not
   shared, unless a `packages/shared` workspace already exists — introducing one is a Phase 1
   decision, not a mid-project addition (PRD §8: no new infrastructure without need).
4. Both agents work from this plan's phase order; neither starts a phase whose prerequisite
   phase is unmerged.

---

## 6. Plan Maintenance

* This roadmap is **durable but not immutable** — re-baseline it when a canonical document
  changes or an ADR supersedes a decision this plan assumes.
* Per-phase work plans and progress logs live alongside it in `plans/` (per
  `plans/CLAUDE.md`); this file should not accumulate task-level detail.
* If the MVP boundary is invoked (PRD §16), drop to Phases 1–5 + deployment gate, protect
  Phase 6 (RAG) as the first re-add, and keep every security gate from Phase 2 and Phase 9 —
  those are never optional (PRD: "Security → Authentication → Data Isolation → Stability"
  are never compromised).
