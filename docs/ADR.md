# Architecture Decision Records

## 1. Purpose

This document records important architectural decisions for the AI Scientific Journal.

The purpose of an Architecture Decision Record (ADR) is to document:

* What decision was made.
* Why it was made.
* What alternatives were considered.
* What consequences the decision introduces.

ADRs prevent important architectural reasoning from being lost as the project evolves.

---

# ADR-001: Use Firebase Authentication

**Status:** Accepted

## Context

The application requires authenticated users so that personal journal data can be isolated between users.

The competition specifically requires Firebase Authentication with Google Sign-In.

## Decision

Use **Firebase Authentication** with Google Sign-In as the primary authentication mechanism.

The Firebase Auth `uid` is the canonical user identity used throughout the application.

## Alternatives Considered

* Custom authentication.
* Auth0.
* Supabase Auth.
* Email/password authentication only.

## Rationale

Firebase Authentication:

* Satisfies the competition requirement.
* Provides Google Sign-In.
* Reduces custom authentication code.
* Integrates naturally with Firestore.
* Provides Firebase ID tokens for backend authentication.

## Consequences

### Positive

* Less custom security-sensitive authentication code.
* Simple Google authentication flow.
* Stable user identity through Firebase `uid`.

### Negative

* Application becomes dependent on Firebase Authentication.
* Firebase configuration must be managed correctly.

---

# ADR-002: Use Cloud Firestore as the Primary Database

**Status:** Accepted *(decision upheld; the example hierarchy below reflects the earlier baseline model — the canonical hierarchy is defined in ADR-013 and ADR-014)*

## Context

The application needs to persist user profiles, journal entries, conversations, messages, and summaries.

The competition explicitly requires user-isolated Cloud Firestore persistence.

## Decision

Use **Cloud Firestore** as the primary persistent database.

User-owned data is organized under the authenticated user's UID.

```text
users/{uid}
├── journalEntries/{entryId}
└── conversations/{conversationId}
    └── messages/{messageId}
```

## Alternatives Considered

* PostgreSQL.
* MongoDB.
* Cloud SQL.
* Firebase Realtime Database.

## Rationale

Firestore:

* Directly satisfies the competition requirement.
* Integrates with Firebase Authentication.
* Provides scalable document storage.
* Supports hierarchical user-owned data.
* Works well for journal and conversation data.

## Consequences

### Positive

* Strong integration with Firebase.
* Simple user-scoped document model.
* Managed infrastructure.
* Automatic scalability.

### Negative

* Requires careful Firestore security-rule design.
* Query patterns must be designed around Firestore's indexing/query model.
* Server-side access requires explicit authorization because server SDKs do not rely on Firestore Security Rules.

---

# ADR-003: Use a Server-Side Backend for Gemini Requests

**Status:** Accepted

## Context

Gemini requests require secure handling of credentials and application-level controls.

The browser should not directly control privileged AI operations.

## Decision

Route Gemini requests through the backend.

```text
Browser
   ↓
Firebase Authentication
   ↓
Backend API
   ↓
Gemini API
```

The backend is responsible for:

* Authentication verification.
* Authorization.
* Input validation.
* Context preparation.
* Prompt construction.
* Gemini invocation.
* Output validation.
* Error handling.
* Rate limiting.

## Alternatives Considered

* Direct browser-to-Gemini requests.
* Firebase client-side AI calls for all AI operations.

## Rationale

A backend provides a trusted control point for security, authorization, validation, rate limiting, logging, and cost controls.

## Consequences

### Positive

* Better protection of secrets.
* Centralized security controls.
* Centralized AI behavior.
* Easier observability and testing.

### Negative

* Adds backend infrastructure.
* Adds an additional network hop.

---

# ADR-004: Store Secrets in Google Cloud Secret Manager

**Status:** Accepted

## Context

API credentials and other sensitive configuration must not be committed to source control or embedded in frontend code.

## Decision

Store server-side secrets in **Google Cloud Secret Manager**.

Secrets are provided to the backend at runtime.

## Alternatives Considered

* `.env` files in production.
* Hardcoded credentials.
* Storing secrets in GitHub.
* Embedding API keys in frontend JavaScript.

## Rationale

Secret Manager provides centralized secret storage and IAM-based access control.

## Consequences

### Positive

* Prevents credentials from being committed to the repository.
* Supports controlled access.
* Simplifies secret rotation.
* Separates application code from secret values.

### Negative

* Adds a cloud dependency.
* Requires correct IAM configuration.

---

# ADR-005: Deploy the Application on Cloud Run

**Status:** Accepted

## Context

The application requires a production deployment environment capable of running the backend and scaling with demand.

The competition requires Cloud Run deployment.

## Decision

Deploy the application as a containerized service on **Google Cloud Run**.

```text
Source Code
    ↓
Docker Image
    ↓
Artifact Registry
    ↓
Cloud Run
```

## Alternatives Considered

* Traditional virtual machine.
* Kubernetes.
* Firebase Hosting only.
* Other serverless platforms.

## Rationale

Cloud Run:

* Satisfies the competition requirement.
* Supports containerized applications.
* Provides managed scaling.
* Removes the need to manage servers directly.
* Integrates with Google Cloud services.

## Consequences

### Positive

* Simple deployment model.
* Automatic scaling.
* Managed infrastructure.
* Easy revision-based deployments.

### Negative

* Cold starts may affect latency.
* Requires container and Cloud Run configuration.

---

# ADR-006: Use UID-Based Data Isolation

**Status:** Accepted

## Context

Journal data is private and must not be accessible between users.

## Decision

Use the Firebase Authentication `uid` as the ownership boundary for user data.

Example:

```text
/users/{uid}/journalEntries/{entryId}
```

Firestore rules and backend authorization must enforce ownership.

The backend must never trust a client-provided UID when determining ownership.

## Alternatives Considered

* Client-provided user IDs.
* Global journal collection with application-level filtering only.
* Separate database per user.

## Rationale

The authenticated Firebase UID provides a stable identity boundary that integrates naturally with Firebase Authentication and Firestore.

## Consequences

### Positive

* Clear ownership model.
* Simple authorization rules.
* Reduced risk of cross-user data access.

### Negative

* Every protected operation must correctly enforce ownership.

---

# ADR-007: Keep Conversation Messages in a Subcollection

**Status:** Accepted *(decision upheld; the example paths below place conversations under the baseline model — conversations are canonical at the user level per ADR-014)*

## Context

Multi-turn conversations can grow significantly over time.

Storing every message in one Firestore document would create document-size and update-management problems.

## Decision

Store messages as a subcollection:

```text
users/{uid}/conversations/{conversationId}/messages/{messageId}
```

Conversation metadata remains in the parent conversation document.

## Alternatives Considered

* Store all messages in one conversation document.
* Store all messages in a global collection.
* Store conversations in a relational database.

## Rationale

Subcollections allow conversations to grow without continuously expanding a single document.

They also support pagination and efficient retrieval of recent messages.

## Consequences

### Positive

* Better scalability.
* Easier pagination.
* Smaller document updates.
* Clear ownership hierarchy.

### Negative

* Multiple reads may be required.
* Context assembly must explicitly retrieve the required messages.

---

# ADR-008: Apply Rate Limits to AI Endpoints

**Status:** Accepted

## Context

Gemini requests consume external resources and may generate significant cost.

Unrestricted AI requests could also be abused.

## Decision

Apply rate limiting to expensive AI operations.

Additional controls include:

* Maximum message size.
* Maximum context size.
* Maximum output size.
* Request timeouts.

## Alternatives Considered

* No rate limiting.
* Rate limiting every endpoint equally.
* Relying only on Gemini's quota controls.

## Rationale

AI endpoints are the most resource-intensive operations and require application-level protection.

## Consequences

### Positive

* Reduces abuse.
* Controls cost.
* Protects system availability.

### Negative

* Legitimate users may occasionally encounter rate limits.

---

# ADR-009: Validate AI Output Before Persistence

**Status:** Accepted

## Context

Gemini responses are probabilistic and cannot be assumed to always follow the application's expected structure.

## Decision

Validate AI-generated structured output before storing it as application data.

```text
Gemini Response
      ↓
Parse
      ↓
Schema Validation
      ↓
Application Validation
      ↓
Firestore
```

Invalid responses are rejected or safely handled.

## Alternatives Considered

* Store every Gemini response directly.
* Trust prompt instructions alone.
* Validate only on the frontend.

## Rationale

Prompts guide model behavior but do not provide deterministic guarantees.

Backend validation provides a trusted enforcement layer.

## Consequences

### Positive

* More reliable persisted data.
* Reduced risk of malformed application state.
* Easier testing.

### Negative

* Additional implementation complexity.
* Some valid-but-unexpected model responses may require handling.

---

# ADR-010: Treat User Content as Untrusted Input

**Status:** Accepted

## Context

Journal content is user-controlled and may contain malicious instructions or prompt injection attempts.

## Decision

Treat all user-provided content as untrusted data.

User content must not override system-level instructions or application security controls.

Authorization decisions are always performed by the application rather than by Gemini.

## Alternatives Considered

* Trust user prompts.
* Ask Gemini to enforce database authorization.
* Allow user content to modify system behavior.

## Rationale

LLMs are not an authorization boundary.

Security-sensitive decisions must be enforced deterministically by application code.

## Consequences

### Positive

* Stronger security boundary.
* Better resistance to prompt injection.
* Clear separation between AI behavior and application authorization.

### Negative

* Requires additional validation and security testing.

---

# ADR-011: Use Structured Observability

**Status:** Accepted

## Context

The production system requires monitoring for reliability, security, AI failures, and performance.

However, journal content is private and should not be written into logs unnecessarily.

## Decision

Use structured logs and metrics containing operational metadata rather than complete user content.

Track information such as:

```text
requestId
statusCode
durationMs
model
inputLength
outputLength
errorType
```

## Alternatives Considered

* Plain-text application logs.
* Logging complete requests and responses.
* Minimal logging with no metrics.

## Rationale

Structured observability provides useful diagnostics while supporting privacy-by-design.

## Consequences

### Positive

* Easier troubleshooting.
* Better monitoring.
* Reduced privacy risk.

### Negative

* Requires deliberate log design.
* Some debugging information may need to be reproduced in a controlled development environment.

---

# ADR-012: Containerize the Application

**Status:** Accepted

## Context

The application needs a reproducible production environment and will be deployed to Cloud Run.

## Decision

Package the application using Docker.

The container should:

* Use a minimal production base image.
* Install only required dependencies.
* Exclude secrets and development artifacts.
* Run using a production command.
* Follow least-privilege practices where practical.

## Alternatives Considered

* Deploy source directly without explicit container configuration.
* Use a traditional virtual machine image.

## Rationale

Cloud Run is container-based, and Docker provides reproducible builds and predictable runtime behavior.

## Consequences

### Positive

* Reproducible deployment.
* Consistent local and production environments.
* Easier dependency control.

### Negative

* Requires Dockerfile maintenance.
* Container security becomes part of the application's responsibility.

---

# ADR-013: Adopt the Scientific Domain Model and Retire Journal Entries

**Status:** Accepted
**Date:** 2026-09-02
**Context source:** `DOCUMENTATION_RECONCILIATION.md` (C02, C03, C07; decision D1)

## Context

The repository contained two generations of domain design: the baseline "Personal Gemini Journal" model (`journalEntries`, `conversations`, `messages`) and the scientific product model (projects, observations, measurements, analyses, research tasks). Documents disagreed on which model was canonical, and the baseline `journalEntries` entity had no defined role in the scientific product: the PRD's data-isolation hierarchy (PRD §10) and the Technical Architecture (TA §11) both already omit it.

## Decision

1. The **scientific domain model is canonical** for the entire application and all documentation.
2. `journalEntries` is **eliminated as a separate entity**. An ordinary or freeform journal entry is represented as an **Observation with the optional scientific fields unpopulated** (`projectId`, `location`, `measurements`, `hypothesis`, and related fields are all optional).
3. An **Observation is the fundamental user-created record**. It may represent a scientific observation, field note, measurement record, hypothesis-related note, or ordinary personal journal entry.
4. The separate `summaries` and `insights` collections are **eliminated**; all persisted AI-generated structured outputs live in a single `analyses` collection, distinguished by a `type` field (see ADR-015).

## Alternatives Considered

* Keep `journalEntries` and Observations as parallel content entities — rejected: duplicates schema, API surface, and the RAG pipeline for no product value.
* Keep the baseline model as-is — rejected: contradicts the approved product (PRD) and the newest technical design (TA).

## Consequences

### Positive

* One canonical content entity; smaller schema, API surface, and retrieval scope.
* Freeform journaling retains full parity with scientific recording.
* Removes the stale-generation entity from all future documentation and code.

### Negative

* Documentation describing `journalEntries` (README, DATABASE_SCHEMA.md, API.md, SECURITY.md §5) must be updated in the planned documentation migration.
* Existing ADR-002/ADR-007 examples reflect the earlier hierarchy and are annotated as such rather than rewritten.

---

# ADR-014: User-Flat Observations with Optional Project Association

**Status:** Accepted
**Date:** 2026-09-02
**Context source:** `DOCUMENTATION_RECONCILIATION.md` (C04, C05, C06; decisions D2, D3)

## Context

Documents disagreed on entity placement: PRD §10 and SECURITY.md §5 place observations flat under `users/{uid}/observations/`, while TA §11/§14 nest them under `users/{uid}/projects/{projectId}/observations/` and make `projectId` required, with a project created before any observation. The PRD contains no requirement making projects mandatory, and mandatory projects conflict with quick observation capture (PRD NFR-03). Cross-project features (Research Map FR-13, Ask My Journal FR-16, dashboard FR-02) favor a flat layout.

## Decision

1. Observations are **user-flat**: `users/{uid}/observations/{observationId}`.
2. `projectId` is a **nullable, optional** field on an Observation (default `null` — "unfiled"). It is never required for create.
3. **Projects are optional organizational entities**, not mandatory parents. They remain a shipped MVP *feature* (grouping, project views) but are never a structural prerequisite for recording.
4. Conversations are likewise **user-level**: `users/{uid}/conversations/{conversationId}/messages/{messageId}`, with an optional `projectId` and `contextType`/`contextId` association (per TA §18). This replaces both the baseline `journalEntryId` link (DB §5) and TA's path-implied project membership.
5. Research tasks are **user-level**: `users/{uid}/researchTasks/{taskId}`, with optional `projectId` and `relatedObservationIds[]` (per TA §22, re-parented).
6. Optional-project integrity: when `projectId != null` on create/update, security rules verify via a `get()` that the referenced project exists under the same `uid`; the backend independently re-validates ownership.
7. Queries that were previously path-scoped (e.g., project observation lists) become within-user indexed queries on `projectId + observedAt`. No collectionGroup queries are required under this model.

## Alternatives Considered

* TA's nested model with mandatory projects — rejected: imposes an organizational prerequisite the PRD never required, blocks quick capture, and requires collectionGroup queries for cross-project features.
* PRD's flat model with projects dropped entirely — rejected: loses a genuine organizational/authenticity capability (TA §13).

## Consequences

### Positive

* Simple, path-based security rules (`request.auth.uid == uid` over `users/{uid}/{document=**}`) with field-level validation.
* Immediate observation capture with no prerequisite records.
* Cross-project features query the user's own subcollections directly; no collectionGroup indexes.

### Negative

* Referential integrity for `projectId` must be enforced by rules + backend (no path guarantee).
* The TECHNICAL_ARCHITECTURE hierarchy (§11), Observation schema (§14), workflow (§53), and MVP wording (§88) must be updated in the documentation migration.

---

# ADR-015: Single Type-Discriminated Analyses Collection for AI Outputs

**Status:** Accepted
**Date:** 2026-09-02
**Context source:** `DOCUMENTATION_RECONCILIATION.md` (C07; decision D4)

## Context

TA defined **both** an `analyses` collection (§20, whose `type` enum already includes `"summary"`) **and** a separate `summaries` collection (§21) with overlapping fields. PRD §10 and SECURITY.md §5 additionally listed a never-defined `insights` collection. Three homes existed for AI-generated structured output with no boundary between them.

## Decision

1. All persisted AI-generated structured outputs are stored in a **single `analyses` collection**: `users/{uid}/analyses/{analysisId}`.
2. A `type` field distinguishes kinds: `"summary" | "analysis" | "hypothesis" | "classification" | "research_suggestions"` (TA §20 enum retained).
3. The TA §21 `Summary` fields are absorbed: `openQuestions[]` joins the analysis schema alongside `suggestedQuestions[]`. A conversation- or observation-sourced summary is an analysis with `type: "summary"` plus `conversationId` or `observationIds[]`.
4. The separate `summaries` and `insights` collections are **eliminated** (`insights` was never schema-defined; its intent is covered by the `analysis`/`classification` types).
5. Analyses are **append-only AI artifacts**: regeneration creates a new document; analyses never overwrite or mutate user-created content. Each document records provenance: `model`, `promptVersion`, `createdAt`, `observationIds[]`, optional `conversationId`, optional `projectId`.
6. Persistence follows ADR-009: outputs are stored **only after** parse, schema validation, and application validation. Invalid output is never persisted.

## Alternatives Considered

* Keep TA's two collections (`analyses` + `summaries`) — rejected: two homes for the same artifact class with no stated boundary.
* Keep three collections including `insights` — rejected: undefined entity; adds surface without a distinct concept.

## Consequences

### Positive

* One artifact class, one security path, one query surface (`?observationId=&conversationId=&type=`).
* Clean provenance and append-only history of AI interpretations.
* PRD §10 and SECURITY.md §5 lose their dangling `insights` references once updated.

### Negative

* The merged schema is broader than any single prior definition and must be written precisely in the DATABASE_SCHEMA.md rewrite.
* TA §20/§21 must be consolidated during the documentation migration.

---

# ADR-016: Observation-Scoped Versions and Media

**Status:** Accepted
**Date:** 2026-09-02
**Context source:** `DOCUMENTATION_RECONCILIATION.md` (C08, C09; decisions D5, D6)

## Context

Observation versions (TA §16) existed only in one document and needed a canonical parent path after ADR-014 re-parented observations. Media placement conflicted: TA §17/§33/§40 define metadata as an observation subcollection with observation-scoped binary paths, while SECURITY.md §15 suggested a flat conceptual `users/{uid}/media/{mediaId}`; the PRD stack table left Cloud Storage vs Firebase Storage undecided.

## Decision

1. **Versions are canonical**: `users/{uid}/observations/{observationId}/versions/{versionId}` (TA §16 schema unchanged, re-parented). Implementation is **deferred to the observation-editing phase**; the schema is fixed now so editing never requires a migration.
2. **Media metadata** is an observation subcollection: `users/{uid}/observations/{observationId}/media/{mediaId}` (TA §17).
3. **Media binaries** live in Cloud Storage, observation-scoped under the user's namespace: `gs://<bucket>/users/{uid}/observations/{observationId}/{mediaId}` (TA §40). SECURITY.md §15's flat path is withdrawn.
4. The **backend derives all storage paths**; clients never supply or select storage paths.
5. The concrete storage client (Firebase Storage SDK vs Cloud Storage SDK — functionally the same service) is an implementation detail decided when media lands; the domain model is unaffected.

## Alternatives Considered

* Flat user-level media (`users/{uid}/media/{mediaId}`) — rejected: decouples evidence from its observation context and complicates lifecycle/cascade deletion.
* Versions in MVP — rejected: no editing capability exists in Phase 1; schema-first adoption avoids later migration.

## Consequences

### Positive

* Evidence lifecycle is tied to its observation; deletion cascades naturally.
* Version provenance protects the integrity of the original scientific record (PRD NFR-06) once editing ships.

### Negative

* SECURITY.md §15 and TA §14's required `projectId` / TA §11 hierarchy require updates in the documentation migration.
* `mediaCount` on the observation must be maintained as media are added/removed.

---

# ADR-017: User-Scoped Derived Search Index

**Status:** Accepted
**Date:** 2026-09-02
**Context source:** `DOCUMENTATION_RECONCILIATION.md` (C10; decision D7)

## Context

TA §23 placed the RAG index in a root-level collection (`observationSearch/{observationId}`) with a denormalized `ownerId`, contradicting the ownership invariant that all user-owned data exists beneath the user's document (DATABASE_SCHEMA.md §2). SECURITY.md §5 had no search collection at all. Retrieval is always per-user, so no global query surface is needed.

## Decision

1. The derived search/RAG index is **user-scoped**: `users/{uid}/observationSearch/{observationId}`, 1:1 with observations.
2. Schema per TA §23 is retained (`searchableText`, optional `embeddingReference`, `embeddingVersion`, `indexedAt`, `updatedAt`) with the denormalized `ownerId` kept as defense-in-depth.
3. Lifecycle: the index document is **written/updated when the observation is written** and **deleted with the observation**, preventing stale-index failure modes (SECURITY.md §30).
4. Retrieval queries `users/{uid}/observationSearch` directly by path; retrieved content is always treated as untrusted input for prompts.
5. The index is **never an authorization source or system of record**; the canonical observation remains authoritative, and retrieval is always UID-scoped before ranking.
6. Conversations/messages are out of retrieval scope initially; only observations are indexed.

## Alternatives Considered

* TA's root-level collection with `ownerId` field rules — rejected: creates a second top-level ownership domain and weaker, field-based rules for no query benefit (the subcollection is queried by path).

## Consequences

### Positive

* Path-based security for derived data; zero cross-user query surface.
* Consistent with the ownership invariant across canonical and derived data.

### Negative

* TA §23's path and DATABASE_SCHEMA.md must be updated in the documentation migration.
* A future global/cross-user search (not a product requirement) would need a different design.

---

# ADR-018: API v1 Surface and Endpoint Consolidation

**Status:** Accepted
**Date:** 2026-09-02
**Context source:** `DOCUMENTATION_RECONCILIATION.md` (C13–C16; decision D8)

## Context

API versioning and naming drifted across documents: README and OBSERVABILITY examples use unversioned `/api/...` journal routes; TA §28 uses `/api/v1`; SECURITY.md §19 lists unversioned routes against resources (`journals`) that no longer exist. TA internally offered two chat surfaces (`POST /ai/chat` §31 and `POST /conversations/:id/messages` §32) and omitted read endpoints for analyses, research tasks, and versions that its own data model and the PRD require.

## Decision

1. **Business APIs are versioned under `/api/v1`.** `GET /api/health` remains **unversioned** (liveness probes must not track API versions).
2. The conversational chat endpoint is `POST /api/v1/conversations/:conversationId/messages`. The standalone `POST /api/v1/ai/chat` is **removed** (message posting through a conversation is the single chat surface).
3. AI endpoints retained: `/api/v1/ai/summarize`, `/api/v1/ai/analyze`, `/api/v1/ai/suggest-research`, plus **new** `/api/v1/ai/ask` (grounded question answering over retrieved observations, PRD FR-16) and `/api/v1/ai/search` (retrieval-only, powers related observations FR-17).
4. **New endpoints added** to close TA's gaps: `GET /api/v1/analyses` (filters: `observationId`, `conversationId`, `type`), `GET|POST /api/v1/research-tasks` + `PATCH /api/v1/research-tasks/:id` (status transitions), `GET /api/v1/observations/:id/versions` (when versions ship).
5. Observation listing is **user-flat with filters** (`/api/v1/observations?projectId=&status=&tag=&limit=&cursor=`) — project scoping is a query parameter, not a path segment, per ADR-014.
6. Media endpoints: `POST /api/v1/observations/:id/media`, `GET /api/v1/media/:id` (authorized read), `DELETE /api/v1/media/:id`.
7. Response envelope `{data, meta}` / `{error: {code, message, requestId}}` (TA §34), with a single centralized error-code registry maintained in the rewritten API.md.

## Alternatives Considered

* Unversioned business routes — rejected: breaks evolution guarantees for a production-oriented API.
* Keeping `/ai/chat` — rejected: duplicates the conversation messaging pipeline and would bypass conversation persistence.

## Consequences

### Positive

* One authoritative API document (the API.md rewrite) with complete coverage of the domain model.
* Aligns the API surface with ADR-013/014/015 entities.

### Negative

* README, OBSERVABILITY, and SECURITY examples must be updated to `/api/v1` during the documentation migration.

---

# ADR-019: Product Naming and Repository Structure

**Status:** Accepted
**Date:** 2026-09-02
**Context source:** `DOCUMENTATION_RECONCILIATION.md` (C01, C21; decisions D9, D12)

## Context

Four name variants existed across documents ("Personal Gemini Journal", "AI Scientific Journal / Research Companion", "Personal Gemini Scientific Journal", `scientific-gemini-journal`), and README's repository layout conflicted with TA §9's.

## Decision

1. **Product name: "AI Scientific Journal"** (PRD §1).
2. **Cloud Run service name: `ai-scientific-journal`**, carrying the required label `dev-tutorial=cloud-run-ai-challenge`.
3. **Repository/package naming may remain `scientific-gemini-journal`** where appropriate (TA §9).
4. The **Technical Architecture §9 repository structure is canonical** (frontend/ + backend/ + firebase/ + infrastructure/ + scripts/ + per-app tests). README's root-level `tests/` layout is withdrawn.

## Alternatives Considered

* "Personal Gemini Scientific Journal" (TA title) — rejected: longer, and the approved product name is the PRD's.
* README root-level tests layout — rejected: per-app tests integrate with per-app tooling and CI.

## Consequences

### Positive

* Single product identity across README, deployment, and judging materials.
* One canonical repository structure for scaffolding.

### Negative

* README, DEPLOYMENT §10, and document titles referencing the old names require updates in the documentation migration.

---

# ADR-020: Deferred Decisions (Maps Provider, Storage Client)

**Status:** Accepted
**Date:** 2026-09-02
**Context source:** `DOCUMENTATION_RECONCILIATION.md` (decision D11; ADR-016 item 5)

## Context

The reconciliation identified two implementation-level choices that do not affect the domain model: the map provider (Google Maps Platform vs Leaflet/OSM) and the concrete storage client (Firebase Storage SDK vs Cloud Storage SDK). Choosing early would add configuration and credentials before any feature needs them.

## Decision

1. **Maps provider selection is deferred** to the implementation phase where map features (PRD FR-12/FR-13) are introduced. The domain model is unaffected: location remains an optional core field on Observation with a precision enum (`exact | approximate | hidden`).
2. **Storage client selection is deferred** to the media implementation phase (see ADR-016); both options address the same service.
3. When either choice is made, a new ADR records it, including the security note that a Maps JavaScript API key is public-but-restricted and must be documented in SECURITY.md.

## Alternatives Considered

* Decide now — rejected: premature infrastructure (PRD §8 infrastructure principle) with zero domain-model impact.

## Consequences

### Positive

* No unused credentials/configuration in Phase 1.
* Domain model remains stable regardless of provider choice.

### Negative

* SECURITY.md must gain a Maps-key note when the choice lands.

---

# ADR-021: Analyses Are Never Mutated by Project Deletion

**Status:** Accepted
**Date:** 2026-09-02

## Context

The deletion-cascade model (`DATABASE_SCHEMA.md` §19) required project deletion to set `projectId = null` on every referencing record, including analyses. This directly mutates **append-only AI artifacts** (ADR-015): an analysis would be edited after creation by an operation that has nothing to do with its provenance. ADR-015's rule is unconditional — *"regeneration creates a new analysis; nothing is overwritten"* — and `AI_ARCHITECTURE.md` §13 repeats that analyses are never edited after creation. The observation-deletion cascade already established the correct precedent for historical AI records: references dangle, sources resolve against canonical data, consumers render a graceful missing-source state (approved RETAIN decision).

## Decision

1. When a project is deleted, **analyses retain their `projectId` unchanged** as a dangling historical reference. Project deletion never mutates an analysis.
2. Observations, conversations, and research tasks continue to be **re-filed to `projectId = null`** on project deletion — they are user-owned, mutable organizational records (unchanged behavior).
3. Consumers (API/UI) treat an analysis's non-null `projectId` exactly like its soft `observationIds[]` references: **possibly missing**, resolved against the canonical `projects` collection, rendered as a graceful "deleted project" state (`API.md` §7.2 pattern).

## Alternatives Considered

* Keep re-filing analyses to `projectId: null` — rejected: contradicts append-only semantics (ADR-015), silently rewrites AI-artifact provenance, and is inconsistent with the established observation-RETAIN precedent.
* Block project deletion while analyses reference it — rejected: traps users; organizational deletion must not be gated by historical AI records.

## Consequences

### Positive

* Append-only semantics hold unconditionally across every deletion path.
* Consistent dangling-reference model: one pattern (soft reference + canonical resolution) covers observations, projects, and conversations as analysis sources.
* Analyses remain accurate historical provenance (which project they were produced under).

### Negative

* API consumers must handle a second dangling-reference case (`projectId`) alongside `observationIds[]`/`conversationId`.
* The analyses list filter `?projectId=` only matches analyses whose project still exists; analyses from deleted projects surface via unfiltered reads.

---

# ADR Maintenance

New ADRs should be added when a decision:

* Significantly affects architecture.
* Introduces an important external service.
* Changes a security boundary.
* Changes data storage or ownership.
* Introduces a major scalability strategy.
* Replaces an existing architectural decision.

When an existing decision changes, do not silently rewrite its history.

Instead:

1. Mark the previous ADR as `Superseded`.
2. Create a new ADR.
3. Reference the previous ADR.
4. Explain why the decision changed.

Example (illustrative — ADR-021 does not exist yet):

```text
ADR-003: Use server-side Gemini requests
Status: Superseded by ADR-021

ADR-021: Revised Gemini integration
Status: Accepted
Supersedes: ADR-003
```

This keeps the architectural history understandable throughout the project's lifecycle.
