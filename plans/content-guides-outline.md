# Content Guides — Coverage Outline

Two guides planned. This file lists **what to cover**, not the content itself.
Write Guide 1 as `docs/USER_GUIDE.md`, Guide 2 as `docs/DEVELOPER_GUIDE.md` (or
link them from README). Source of truth while writing: actual code + canonical
docs (`PRD.md`, `API.md`, `DATABASE_SCHEMA.md`, `SECURITY.md`,
`AI_ARCHITECTURE.md`, `AI_EVALUATION.md`, `TESTING.md`, `OBSERVABILITY.md`,
`DEPLOYMENT.md`, `ADR.md`, `TECHNICAL_ARCHITECTURE.md`).

---

## Guide 1 — What the App Can Do (user-facing)

Tone: product-language, no code, no schema names. Explain *what a user sees,
why it exists, and how to use it*. Screenshots placeholders at each section.

### 1.1 Orientation
- What the app is (one paragraph, non-technical): observation journal that turns records into research
- Who it is for (naturalists, students, hobby researchers, citizen scientists)
- Core loop: Observe → Record → Analyze → Organize → Discover → Investigate Further
- The four priorities in user terms: Authenticity · Usability · Stability · Security (what each means for *the user*)
- What is AI vs what is user-authored (AI output always labeled, never overwrites user records)
- Accounts & privacy promise: Google sign-in, everything private per account, deletion behavior

### 1.2 Getting started
- Landing page: what it shows, sign-in button
- First sign-in experience: new-user dashboard state (what each part does)
  - Start panel (Record First Observation / Create Project)
  - Quick Capture card (save draft in seconds; Open Full Form carries typed values over)
  - Workspace Ready panel (honest checklist rows, settings link)
  - "As your journal grows" feature previews
- Returning-user dashboard state, element by element:
  - Greeting header + New Observation button
  - Current Research split-panel (project title, status, description, actions, counts: observations/tasks/last activity, Suggested Next Step panel — where it comes from: AI analysis vs deterministic suggestion)
  - AI Research Assistant band (Ask Journal, AI Chat, Review Analyses / "No analyses yet" + Analyze Latest Observation)
  - Stats row (4 tiles, what counts mean, the "+" cap marker, secondary links)
  - Recent Observations + Tasks panel (loading/error/empty states, retry)
  - Recent Activity feed (kinds: observation, task, analysis)
- Where information lives: mental map of the sidebar / navigation (which page answers which question)

### 1.3 Observations (the fundamental record)
- Concept: what an Observation is; scientific fields optional (journal note = same record)
- Observations list page: search box, record cards (whole card clickable), section heading + "N shown (more available)", pagination
- Creating: full form walkthrough, field by field
  - Title, description (required)
  - Observed-at date
  - Notes, hypothesis (what each is for)
  - Location: toggle, latitude/longitude entry + validation rule (both-or-off), precision choice (exact / approximate / hidden) and what each shows on the map, label
  - Tags (free-form), measurements (name/value/unit rows)
  - Project assignment
  - Advanced Fields section (collapsed by default; what's inside)
  - Evidence media: upload types (image/audio/video), size limits, captions
  - Quick Capture prefill behavior (values carried, nothing auto-saved)
- Editing: what happens on save (version history is kept), change reason
- Detail page: everything visible — fields, measurements, tags, location, media gallery, project link
  - Evidence media gallery (view signed-URL media, captions, counts)
  - "Analyze with AI" (what it produces, how long, where it lands)
  - Version history (list versions, inspect snapshot & compare)
  - Discussion link (context-bound AI chat)
  - Archive/unarchive, delete (what deletion does and does not remove — analyses are retained)
- Drafts vs recorded status

### 1.4 Projects
- Concept: optional organization layer; nothing requires a project
- Projects list, create, edit
- Project detail page: linked observations/conversations/analyses/tasks, counts
- Deleting a project: records re-filed (never deleted); AI analyses keep historical reference

### 1.5 Research tasks
- Concept: tasks exist only when *you* accept a suggestion (or create manually)
- Tasks page: board/columns by status (suggested → planned → in progress → completed), what you can do per status
- Accepting an AI-suggested next step (from analysis) as a task
- Editing, completing, deleting; how dashboard reflects changes immediately

### 1.6 AI conversations (chat)
- Conversations list; starting a chat; general vs context-bound (observation / project / analysis) and how context is shown in the header
- Chat window: messages, Shift+Enter newline, character limit, send states, pending indicator
- Reading AI replies: markdown, model badge, latency/tokens footer, disclaimer line
- Failed send: error banner + "Retry AI Generation" (your text is preserved)
- Archived conversations (what's blocked, how to unarchive)
- What chat is for vs Ask My Journal vs analyses (when to use which)

### 1.7 Ask My Journal (grounded Q&A)
- How to ask; what comes back: answer, evidence citations (link to source observations), uncertainties
- "Insufficient evidence" honesty behavior (what it looks like, why)
- Prompt-version stamp meaning

### 1.8 AI analyses
- Types in the app: summary, observation analysis, research suggestions
- Anatomy of an analysis: summary, key findings, hypotheses (with confidence), uncertainties, suggested questions, suggested next steps
- Provenance: model + prompt version stamp; AI content never mutates your record
- Where analyses appear (observation detail, dashboard Review Analyses, activity feed)
- Accepting suggested next steps as tasks

### 1.9 Research map
- What is plotted; exact vs approximate (area) vs hidden (never shown)
- Map controls, filtering, what markers link to

### 1.10 Settings & account
- Profile: display name, avatar upload (preview behavior)
- Journal defaults (capture-location preference)
- Sign out (confirmation modal), where account data lives, deletion expectations

### 1.11 Cross-cutting UX
- All workflows end-to-end, step by step:
  - Record → analyze → accept task → track to done
  - Ask journal → evidence → open observation → discuss in chat
  - Organize: create project → assign observations → dashboard Current Research
  - Draft flow: Quick Capture draft → finish in full form → record
- Loading / error / empty states philosophy (never a false empty state; retry where)
- Toasts and confirmation dialogs (destructive actions always confirmed)
- Immediate data freshness (no stale dashboard; when to expect updates)
- Mobile/responsive behavior; keyboard accessibility basics
- Browser support, sign-in popup blockers note
- Quick navigate using Command Palette / Global Search

### 1.12 Reference & help
- Limits table (message length, media sizes, page sizes, "+ cap" meaning)
- Glossary (Observation, Project, Analysis, Task, Evidence, Grounded answer, Context)
- FAQ (privacy, AI errors, why a suggestion appeared, media not loading → hard refresh)
- Troubleshooting quick list (sign-in popup blocked, stuck loading → retry, media/CSP → hard refresh)
- Roadmap / known deferred features (map provider details, version UI activation, reserved analysis types, voice journaling etc.)

---

## Guide 2 — How the App Is Designed & Built (technical)

Audience: engineers. Tone: precise, references canonical docs + ADR numbers.
Every claim must match code; link file paths.

### 2.1 Product & architecture overview
- Product goal, MVP scope vs deferred (PRD)
- High-level architecture diagram (SPA → Firebase Auth → Cloud Run API → Firestore / Storage / Gemini / Secret Manager)
- Modular monolith rationale; one container one service (ADR refs)
- Repository layout (frontend/, backend/, firebase/, infrastructure/, scripts/, docs/, CI)
- Documentation map: which canonical doc owns which decision

### 2.2 Frontend
- Stack and why: React + TypeScript, Vite, Tailwind (design tokens: brand/teal palette, app-bg, cyan AI accent), lucide icons
- App shell: routing table (all routes + auth guard `RequireAuth`), Layout (header: search, profile link, sign-out + confirm modal; sidebar nav; semi-transparent sticky header)
- Data layer: TanStack Query — global defaults (staleTime 30s, no refetch-on-focus, retry 1) and the dashboard `alwaysFresh` override (staleTime 0 + refetchOnMount "always"); per-section loading/error/empty; why per-query not global
- API client conventions (`lib/api.ts`): auth header injection, error envelope handling (`ApiRequestError`), list meta (`hasMore`, no totals → "+" cap)
- Dashboard data layer (`useDashboardData`): 8 queries, per-status tasks, dead-fetch removal, honest counts, per-project brief query
- Component conventions: dashboard component split, UI primitives (Dialog, ConfirmDialog, Toast, toggle switch), state machines for forms (validation before mutation)
- Form patterns: null-safe coordinates, custom validation vs HTML constraint validation (jsdom lesson), router-state hand-off (Quick Capture → form prefill)
- Markdown rendering for AI text (sanitization stance; plain text for user messages)
- Accessibility: focus-visible global ring + `data-no-focus-ring` opt-out, aria labels, keyboard paths
- Frontend testing: Vitest + React Testing Library; e2e journey test; jsdom constraints learned (details/summary click, constraint validation, QueryClientProvider wrapping)
- Build: Vite env vars (`VITE_*`), Firebase web config public-by-design, production build in Docker (`tsc -b` typecheck parity lesson)

### 2.3 Backend
- Stack and why: Node.js, Express 5, TypeScript, Zod, pino, helmet, cors, express-rate-limit
- Layering: routes → services → repositories; where each concern lives
- Middleware chain order and why (requestId → helmet → CORS → body-limit → logging → rate limit → routes) (TA §77)
- Configuration: `config/env.ts` zod schema, fail-fast, every env var + default (table), `USE_FAKE_AI` forbidden-in-production guard
- Validation: Zod schemas per resource; CreateObservationSchema status semantics (draft/observed)
- Error handling: uniform error envelope, notFound vs errorHandler, `404` indistinguishability for foreign resources
- Auth middleware: Firebase ID token verification, UID derivation (never client-supplied)
- Authorization: ownership scoping in services; Firestore rules as defense-in-depth
- API surface walkthrough (`/api/v1`): observations (+versions, media), projects, researchTasks, conversations/messages, analyses, ai (ask, search), me/profile — method, auth, purpose per endpoint (link API.md)
- Rate limiting & input limits: which endpoints, why (AI/media cost protection)
- Observability: pino structured logs, requestId correlation, what is logged and what is never logged (content/tokens/secrets), `/api/health`
- Backend testing: unit / integration / security suites; emulator-backed tests; security suite flag

### 2.4 Authentication & security
- Firebase Authentication flow: Google sign-in popup, `same-origin-allow-popups` COOP rationale (popup postMessage chain)
- Token flow: client ID token → backend verify → UID scoping
- Threat-model summary (link SECURITY.md): isolation, injection, secret leakage, media privacy
- Helmet CSP: full directives breakdown, why each origin exists (apis.google.com, accounts.google.com, firebaseapp.com frames, gstatic, googleusercontent avatars, OSM tiles, storage.googleapis.com signed media, blob: previews) — including the two prod-incident lessons
- CORS: origin lock to Cloud Run URL
- Secrets: Secret Manager, runtime injection, never in image/repo/logs; rotation = new revision (revision-pinning semantics)
- Media privacy: private bucket, backend-derived paths (never exposed), short-lived signed read URLs (TTL), size/mime limits, staged upload cleanup
- Firestore Security Rules: model + rules tests
- Prompt-injection stance: user/retrieved content untrusted; AI never an authorization boundary; AI never mutates observations; minimum-context assembly

### 2.5 Data layer
- Firestore schema: full `users/{uid}/…` tree — projects, observations (+versions, +media), conversations (+messages), analyses, researchTasks, observationSearch
- Field semantics: append-only analyses, version provenance, nullable projectId, mediaCount, status values, timestamps
- Indexes required (firebase/firestore.indexes) and which queries need them
- The derived `observationSearch` index: why derived, never authoritative, user-scoped before retrieval
- Lifecycle rules: project delete re-files records; observation delete vs retained analyses; version retention
- Cloud Storage layout + metadata sync with Firestore

### 2.6 AI system
- AI service abstraction: interface, real Gemini provider vs Fake AI provider; application code never imports SDK directly
- Model config: `AI_MODEL` env/default (gemini-3.5-flash), timeout `AI_TIMEOUT_MS`, context budgets
- Pipeline (every AI feature): input validation → authorized context assembly → model call → schema validation → application validation → persistence; invalid output never persisted
- Prompt architecture: prompt registry, versioned prompts (`observation-analysis-v1`, `ask-grounded-v2`), provenance stamps on outputs
- Analysis types: summary / analysis / research_suggestions implemented; hypothesis / classification reserved (no generation workflow)
- Structured-output validation approach (Zod against model JSON), failure behavior
- Context assembly: minimum authorized context, message budgets (`AI_MAX_CONTEXT_MESSAGES`)
- Conversation behavior: roles, sequence, metadata (latency, tokens), model badge
- Fake AI: determinism, purpose (offline dev/tests), production guard

### 2.7 RAG — Ask My Journal & search
- Flow: index derivation → retrieval (candidate budget `AI_SEARCH_MAX_CANDIDATES`, min score, weak-evidence threshold) → rerank → re-check against canonical data → grounded generation
- Answer contract: answer, evidence[] (observationId, title, observedAt, note), uncertainties[], insufficient-evidence behavior
- Char budget (`AI_RAG_CONTEXT_CHAR_BUDGET`, max context observations)
- Related-observation search endpoint (retrieval-only, no generation)
- Security: user scoping before any model call; retrieved content as untrusted data

### 2.8 AI evaluation
- Methodology per AI_EVALUATION.md: groundedness, hallucination checks, evaluation cases, human rubric
- Offline eval harness vs live eval (status: live Gemini eval pending/billing-gated — honest note)
- How prompts change (version bump discipline, regression cases)

### 2.9 Stability & reliability
- Failure philosophy: per-section degradation, retry affordances, no false empty states
- Frontend data freshness strategy (the staleness bug story: global staleTime vs mount refetch)
- Backend resilience: index-write failure degradation (search index best-effort), staged upload cleanup, timeout budget (AI 30s < Cloud Run 60s)
- Idempotency: current gaps (known backlog items) — honest section
- Revision-based rollback on Cloud Run

### 2.10 Scalability & cost
- Cloud Run autoscaling, statelessness; min/max instances choices
- Firestore scaling + index-bound queries; derived search index rationale
- Storage growth + signed URL TTL trade-offs
- Cost controls: rate limits, input limits, context budgets, page-size caps
- Cold starts; container image size

### 2.11 CI/CD & deployment
- GitHub Actions CI: what runs (lint, typecheck, tests, build) per app
- Docker: multi-stage build, `tsc -b` parity with local typecheck, .dockerignore/.gcloudignore
- Cloud Build pipeline (`infrastructure/cloud-run/cloudbuild.yaml`): substitutions (`_VITE_*`, `_IMAGE`), Artifact Registry
- Cloud Run service config: service account (least privilege: Firestore/Storage/SecretManager), env vars table (production values), secrets mapping, labels (`dev-tutorial=cloud-run-ai-challenge`), port/timeout, unauthenticated + app-level auth rationale
- Firebase: Auth authorized domains, deployed Firestore rules, emulator suite config
- Deploy runbook (step-by-step, from deploy-guide) + rollback runbook
- Config-change deploys: secret rotation and env-var changes need new revision only (no image build)
- Production smoke checks: health endpoint, auth envelope, CSP header, AI call

### 2.12 Observability
- Logging design (OBSERVABILITY.md): structured fields, privacy rules, requestId
- Cloud Logging/Monitoring: current dashboards/alerts status (honest: what exists vs planned F3 items)
- Health/liveness endpoint
- Frontend error visibility (console-only today; optional future Sentry-style note — do not invent)

### 2.13 Testing strategy
- Layers: unit → integration → security → API → AI eval → e2e journey → production smoke (TESTING.md)
- Security-isolation tests as first-class; emulator-backed suites; default suites offline/fast
- What is mocked where (Gemini, Firestore, Storage seams)
- Known gaps (idempotency items skipped, live eval pending) — honest list

### 2.14 Decision record
- ADR index: one line each (ADR-001…020), link ADR.md
- Key decisions to expand in prose: AI abstraction, Firestore shape, projects-optional model, media via Cloud Storage + signed URLs, maps provider deferred (ADR-020), storage client deferred, version-history UI deferred (ADR-016), reserved analysis types
- Documented trade-offs/deferred items and why

### 2.15 Local development
- Offline mode: emulators (ports), demo- project, Fake AI, seed scripts
- Env files (.env.example walk-through, never commit .env)
- Validation commands (lint/typecheck/test per app, security suite)
- Common local gotchas (emulator ports, popup auth locally, model availability)

### 2.16 Appendices
- Full env-var reference (frontend + backend)
- API quick reference table
- Glossary for engineers
- Production incident log digest (CSP img-src ×2, model default mismatch, secret pinning) with root causes and general lessons
- Contributing guide pointer + doc-update rules

---

## Cross-cutting rules for both guides

- Verify every claim against current code; flag doc-vs-code conflicts instead of papering over (repo rule)
- Screenshots: list needed captures per section (dashboard ×2 states, form, detail, chat, ask, map, settings) — placeholders first
- No secrets, no real user data, no signed URLs in text; redact IDs in screenshots
- Keep each guide navigable: TOC, consistent terminology (same word = same thing), link canonical docs instead of duplicating them
- Honest-status convention: mark deferred/pending items explicitly, never imply implemented
