# AI Architecture

**Status:** Canonical for AI design (aligned with ADR-003, ADR-009, ADR-010, ADR-013 – ADR-018, ADR-021 and the canonical `DATABASE_SCHEMA.md`, `API.md`)
**Last updated:** 2026-09-02
**Product:** AI Scientific Journal

> **Scope:** This document defines the AI layer's conceptual architecture — its principles, service boundary, capabilities, pipelines, prompt/output handling, failure behavior, security boundaries, and data lifecycle. Endpoint contracts live in `API.md`; data shapes in `DATABASE_SCHEMA.md`; the security model in `SECURITY.md`; operational monitoring in `OBSERVABILITY.md`. Where documents conflict, the ADRs and canonical schema prevail.

---

## 1. AI Architecture Principles

1. **Gemini is an application capability, not the source of truth.** Firestore holds authoritative data; Gemini provides reasoning, summarization, classification, hypothesis generation, and natural-language interaction (TA §92).
2. **Core journal functionality must not directly depend on Gemini availability.** Creating, editing, listing, and deleting observations, projects, conversations, and tasks; authentication; and data isolation all work when AI is down (PRD NFR-02; TA §46 reliability strategy). AI failure may fail an AI step — never the underlying record.
3. **AI operations go through an application-level AI service abstraction** (§2). Application code never calls the Gemini SDK directly, and never constructs prompts or parses model output ad hoc.
4. **AI-generated content is distinguishable from authoritative user data** — by schema: user-authored observations vs the separate, append-only `analyses` collection (ADR-013, ADR-015).
5. **AI outputs require validation before persistence or use** (ADR-009): parse → schema validation → application validation → persist. Invalid output is never stored and never shown as trusted data.
6. **User and retrieved content are untrusted input.** Instructions live in prompt layers the application controls; user text and retrieved observations never alter security or authorization behavior (ADR-010).
7. **Minimum necessary context.** The application sends bounded, relevant, authorized context — never the user's entire journal by default (TA §73, PRD AI-02).

---

## 2. AI Service Abstraction

### Boundary

```text
Application / API layer
        ↓  depends only on this interface
   AI Service                ← capability interface: summarize, analyze,
        ↓                       suggest-research, ask, search, chat-turn
   Gemini Adapter            ← SDK calls, model config, retry/timeout policy,
        ↓                       response envelope handling
   Gemini API
```

* The application depends on the **AI Service interface**, not on the Gemini SDK. The adapter is the only component that knows which SDK/model is in use.
* Model selection is centralized configuration (env-provided, e.g. `AI_MODEL`), not hardcoded at call sites (TA §5.5, §81).
* Prompts are versioned artifacts owned by the AI layer (`promptVersion` recorded on every persisted analysis — TA §80, `DATABASE_SCHEMA.md` §12).

### Why the boundary exists

| Reason | Effect |
| ------ | ------ |
| **Provider isolation** | Gemini SDK details, auth, and wire formats stay in the adapter; nothing else changes if the SDK or invocation style changes. |
| **Testing** | AI-dependent application logic can be tested against a fake AI Service implementation without network calls; the adapter is integration-tested separately (TA §61–62). |
| **Failure handling** | Timeouts, error mapping, and degradation (§10) are implemented once in the service/adapter, not per endpoint. |
| **Model replacement** | Changing models (or per-capability model choices) is configuration plus evaluation, not refactoring. |
| **Centralized safety/validation** | Schema validation, grounding checks, and injection-resistant prompt assembly are enforced at one boundary — impossible to bypass by a shortcut call. |
| **Observability** | Every AI operation emits the same metrics/log shape (§12) because every operation passes through the same service. |

No second AI provider exists or is planned; the abstraction exists for the reasons above, not for multi-provider routing (§14).

---

## 3. AI Capabilities

Capabilities reflect the PRD and the finalized API contract (`API.md` §6.12, §6.15):

| Capability | API surface | Output |
| ---------- | ----------- | ------ |
| **Conversational AI** (multi-turn, brainstorming, reflection, journal assistance) | `POST /api/v1/conversations/:id/messages` | user + assistant `messages` (§4) |
| **Summarization** (conversation- or observation-sourced) | `POST /api/v1/ai/summarize` | analysis `type: "summary"` |
| **Observation analysis** (findings, hypotheses, uncertainty, next steps) | `POST /api/v1/ai/analyze` | analysis `type: "analysis"` |
| **Research suggestions** | `POST /api/v1/ai/suggest-research` | analysis `type: "research_suggestions"` |
| **Ask My Journal** (grounded Q&A, PRD FR-16) | `POST /api/v1/ai/ask` | grounded answer + evidence + uncertainties (stateless, or persisted as messages) |
| **Retrieval-only search** (related observations, PRD FR-17) | `POST /api/v1/ai/search` | ranked observation references; no generation, no persistence |

### Analysis types — generatable vs reserved

| Type | Status |
| ---- | ------ |
| `summary` | **Generatable** (`/ai/summarize`) |
| `analysis` | **Generatable** (`/ai/analyze`) |
| `research_suggestions` | **Generatable** (`/ai/suggest-research`) |
| `hypothesis` | **Reserved** — valid in the schema and read filters; no generation workflow exists |
| `classification` | **Reserved** — valid in the schema and read filters; no generation workflow exists (future candidate: PRD FR-19 auto-tagging) |

Reserved types have no endpoints, prompts, or pipelines; they are not invented here.

---

## 4. Stateful Conversational Architecture

```text
Client
  ↓ POST /api/v1/conversations/:conversationId/messages     ← the only chat surface
API (authenticate → authorize → validate)
  ↓
Persist user message            ← user content is durable before any model call
  ↓
AI Service: build chat context  ← authorized conversation history (bounded window;
  ↓                                older context summarized/omitted per config)
Gemini (via adapter)
  ↓
Validate response
  ↓
Persist assistant message       ← role: "assistant", model + non-sensitive metadata
  ↓
Update conversation counters/timestamps
```

* **There is no `/api/v1/ai/chat`.** Stateful chat is conversation messaging (ADR-018); conversation and message records are the persistent interaction history (`users/{uid}/conversations/…/messages/…`).
* Context assembly uses **authorized history only**: messages belonging to the authenticated user's conversation, ordered by `sequence`, bounded to a configured window. When conversations grow long, older content is summarized or dropped per the context strategy — history is never sent unbounded (PRD AI-02, `DATABASE_SCHEMA.md` §9).
* A conversation may carry `contextType`/`contextId` (observation, project, research) and/or `projectId`; the referenced entities are ownership-checked before their content enters a prompt.
* If generation fails after the user message is persisted, the user message remains; the assistant turn is simply absent and can be regenerated via the idempotent retry (`API.md` §6.12).

---

## 5. RAG Architecture

```text
Observations (source of truth, Firestore)
  ↓ (derived, on write)
users/{uid}/observationSearch/{observationId}    ← derived index (ADR-017)
  ↓ query (user-scoped, by path)
Retrieval → reranking → top-k candidates
  ↓ (re-checked against canonical observations; deleted ones never surface)
Context assembly
  ↓
AI Service → Gemini
  ↓
Grounded answer (evidence + uncertainty) / ranked results
```

Explicit rules:

* **Firestore is the source of truth.** The index is **derived** data — rebuildable, never authoritative, and **never an authorization mechanism** (ADR-017, SECURITY.md §10). Authorization is decided from canonical ownership before and independently of retrieval.
* **Retrieval is user-scoped**: queries run against `users/{uid}/observationSearch` directly by path; there is no global or cross-user retrieval surface (a root-level index was considered and rejected — ADR-017).
* **Derived-index handling:** the index entry is written/updated **asynchronously after** the observation is written (indexing is retryable and eventually consistent — the canonical observation write never depends on it, PRD NFR-02) and **deleted with the observation** (with the canonical re-check below as the correctness backstop for any deletion-race); embedding changes are handled via `embeddingVersion` invalidation and rebuild. `/ai/search` re-checks candidates against canonical observations so changed/deleted records never appear.
* **Retrieved content is untrusted model input** (§7): it may influence answers; it never carries instructions the application must follow.
* No specific embedding model or vector database is selected here; the schema's `embeddingReference`/`embeddingVersion` fields deliberately keep storage flexible (ADR-020 defers the analogous storage decision; a concrete choice, when made, gets its own ADR).

---

## 6. Context Construction

Context is assembled **only from authorized sources**, after authentication and authorization:

| Source | Used by | Notes |
| ------ | ------- | ----- |
| Observation content (title, description, notes, hypothesis, tags) | analyze, ask, summarize, chat-with-context | The authoritative user record |
| Measurements | analyze, ask | User-authored scientific data; AI never writes them back |
| Project context (title/description when the entity references a project) | analyze, chat | Optional; ownership-checked |
| Conversation history | chat (`sequence`-ordered, bounded) | Authorized messages of this conversation only |
| Retrieved observation context | ask, search (and optional retrieval augmentation for chat) | From the derived index, UID-scoped, re-verified |

Principles:

* **Minimum necessary context** — each capability defines what it needs; nothing else is sent. The entire journal is never shipped to the model by default (cost, latency, privacy — TA §73).
* Every source is fetched through owner-scoped data access — the context builder cannot retrieve cross-user data even if prompted to try.
* Context size limits are configuration, enforced in the AI Service (not per-endpoint ad hoc).

---

## 7. Prompt Architecture

Conceptual prompt layers, strictly ordered by trust:

```text
1. System instructions          ← application-owned; identity, safety, capability scope
2. Application/task instructions ← application-owned; per-capability task framing, output contract
3. Authorized user/context data  ← observations, measurements, project info (data, not instructions)
4. Retrieved RAG context         ← clearly delimited, labeled untrusted data
5. Current user request          ← the user's actual message/question
```

* Layers 3–4 are wrapped in explicit delimiters and described to the model as **data to reason about, not instructions to follow** — journal content may contain adversarial text ("ignore previous instructions…"); the prompt design and system instructions establish that such text never overrides layers 1–2 or application authorization (SECURITY.md §11, ADR-010).
* Prompts are versioned source artifacts in the AI layer (e.g., one module per capability — TA §80); there is deliberately **no large hard-coded prompt collection** scattered through business code. Each persisted analysis records the `promptVersion` that produced it.
* Grounding requirements (PRD AI-05, AI-07) are encoded in the task instructions: answers must cite supporting observations, must not fabricate observations or measurements, and must express uncertainty (`uncertainties[]`, empty `evidence[]` with an "insufficient evidence" answer) when retrieval is thin.

---

## 8. Output Handling

```text
Gemini output
  ↓ parse (never assumed to be valid JSON)
Schema validation            ← expected structure for the capability
  ↓
Safety / business validation ← grounding check, no unsupported claims,
  ↓                            content within application rules
Persist                      ← only valid output becomes an `analyses` document
  ↓                             (messages for chat turns)
Response
```

* AI output must **not automatically become authoritative scientific data**. The three content classes remain distinct:

| Class | Storage | Mutability |
| ----- | ------- | ---------- |
| **User-authored observations** | `observations` (+ versions, media) | User-controlled; AI never mutates them (sole exception: backend-set `status: "analyzed"` flag) |
| **AI-generated analyses** | `analyses` (append-only, provenance-stamped) | Never edited; regeneration appends a new document |
| **AI-suggested research tasks** | *not stored until accepted* — acceptance creates a user-visible `researchTasks` document (§9) | User-controlled lifecycle after creation |

* Invalid or failed-validation output is **never persisted**; the caller receives `502 AI_INVALID_RESPONSE` (registry in `API.md` §3).
* Distinguishing facts vs hypotheses vs uncertainty is enforced by the analysis schema itself (`keyFindings` vs `hypotheses[].confidence` vs `uncertainties[]`) and surfaced in the UI (PRD FR-14).

---

## 9. Research Suggestions → Research Tasks

```text
analysis (type: "research_suggestions")
        └── suggestedNextSteps: [ … ]
                ↓  user reviews
        ↓ explicit acceptance (user action)
POST /api/v1/research-tasks
      { source: "gemini", sourceAnalysisId, suggestionIndex }
                ↓  backend: ownership-check sourceAnalysisId,
                   copy the referenced step + context
researchTask (status: "suggested", source: "gemini", sourceAnalysisId)
```

* **Gemini never silently creates an accepted task.** Suggestions live inside an analysis until the user explicitly accepts one; the API has no path from generation to task creation without that call (SECURITY.md, PRD FR-15).
* `sourceAnalysisId` is **ownership-checked** on acceptance: the analysis must exist under the caller's own `analyses` (foreign/missing → `404`); the referenced `suggestionIndex` must exist (`400` otherwise). Idempotency keys prevent double-acceptance (`API.md` §6.14).
* After creation the task is an ordinary user-owned record with a user-controlled status lifecycle; the AI provenance (`source`, `sourceAnalysisId`) remains for transparency.

---

## 10. AI Failure and Degradation

Expected behavior per failure class (error codes per `API.md` §3; rates/limits per `API.md` §4; no new retry counts or timeout values are invented here — they are configuration):

| Failure | Detection | Behavior |
| ------- | --------- | -------- |
| **Gemini unavailable** | Adapter error mapping | `503 AI_UNAVAILABLE`; user content already persisted stays intact; operation retryable |
| **Timeout** | Adapter timeout policy (config) | Same as unavailable — fail the AI step, never the record |
| **Rate limit** (upstream or per-user) | Adapter / rate limiter | `429 RATE_LIMIT_EXCEEDED` with `Retry-After` (own limits) or mapped `503` (upstream) |
| **Malformed model output** | Parse/schema validation | **Nothing persisted**; `502 AI_INVALID_RESPONSE`; safe error to client |
| **Validation failure** (ungrounded/unsafe/invalid content) | Safety/business validation | Same as malformed — rejected before persistence |
| **Retrieval failure** | Retriever in the AI Service | The AI step fails safely (`503`); for `/ai/search` an empty/failed result set is returned without generation; the model is never called with a half-failed context silently |

Cross-cutting rules:

* **AI failure must not corrupt or delete user data.** User content is persisted before or independently of the model call (chat: user message first — §4; analyze: observations already exist).
* **Core journal functionality remains usable without AI**: observation/project/task CRUD, history, and isolation are independent of Gemini (PRD NFR-02). The UI communicates AI-specific errors distinctly and offers retry (PRD AI-10).
* Repeated failures are observable through the metrics in §12; alerting thresholds are an OBSERVABILITY concern, not defined here.

---

## 11. Security Boundaries

Reconciled with `SECURITY.md` (§2, §8, §10, §11):

1. **Authenticate before AI access** — every AI endpoint requires a verified Firebase ID token; identity comes from the token, never the client (`/api/v1` only).
2. **Authorize every referenced entity** — each observation/project/conversation/analysis ID in a request is ownership-checked before use; foreign resources are indistinguishable from missing ones (`404`).
3. **Retrieve only user-authorized context** — the context builder and retriever operate UID-scoped; there is no code path by which prompted content can widen retrieval.
4. **Never use the RAG index as authorization** — the index accelerates retrieval; authorization is always decided from canonical, owner-scoped data (ADR-017).
5. **Keep Gemini credentials server-side** — the API key lives in Secret Manager, is injected into the Cloud Run runtime, and never reaches the browser, the repo, logs, or Firestore (ADR-004, SECURITY.md §9, §17).
6. **Avoid unnecessary sensitive data exposure** — minimum-necessary context (§6), data-minimized prompts, privacy-aware logging (§12); location precision is honored in any context that includes it.
7. **Treat retrieved/user content as potentially adversarial** — prompt-layer separation (§7), untrusted-data framing, output validation (§8), and the application's monopoly on authorization decisions (Gemini output can never grant access or mutate user content).

---

## 12. Observability Hooks

Every AI operation passing through the AI Service exposes, conceptually, the same signal set (full monitoring architecture: `OBSERVABILITY.md`):

```text
operationType        ← summarize | analyze | suggest-research | ask | search | chat-turn
requestId            ← correlation ID (shared with the API request log)
userId               ← authenticated UID (privacy-safe identifier)
model                ← model identifier from configuration
latencyMs            ← end-to-end AI operation duration
success / failure    ← outcome + errorType (AI_UNAVAILABLE, AI_INVALID_RESPONSE, …)
tokenUsage           ← input/output token counts where the API provides them
retrieval metrics    ← candidate count, selected context size (ask/search where applicable)
promptVersion        ← for generation operations (provenance)
```

* **Raw user content, full prompts, and full model responses are not logged by default** — lengths and identifiers only (PRD AI-09, OBSERVABILITY.md §4, §7). Debugging beyond that happens in controlled development environments, not production logs.
* Structured-output validation failures and retrieval misses are first-class events (they feed the AI evaluation loop — `AI_EVALUATION.md`).

---

## 13. AI Data Lifecycle

```text
                    SOURCE OF TRUTH              DERIVED                  AI ARTIFACTS
                    ───────────────             ─────────                 ────────────
observations  ──1:1──▶ observationSearch       │  analyses (append-only,
   │                  (rebuilt on write,       │  provenance-stamped)
   │                   deleted with source)    │
   │                                            │  researchTasks
conversations/messages                          │  (after user acceptance)
   │                                            │
   └────────────── references by ID ────────────┘
```

* **Authoritative observations** are the root record; editing is user-controlled (version snapshots per ADR-016 when enabled).
* **Derived index** follows the observation lifecycle: created/updated **asynchronously after** the observation write (retryable, eventually consistent — never a dependency of the canonical write), deleted with the observation; never authoritative.
* **Analyses** are append-only AI artifacts referencing sources by ID. **RETAIN semantics (approved; extended by ADR-021):** when a source observation is deleted, analyses are **never cascade-deleted**; when their referenced project is deleted, analyses **retain their `projectId`** unchanged (append-only artifacts are never mutated by project deletion). References become dangling and consumers must render missing sources gracefully (`API.md` §7.2). Existence is always resolved against canonical data.
* **Conversations/messages** are user-owned interaction history; deleting a conversation cascades to its messages, while analyses sourced from it are retained.
* **Research tasks** are user-owned records regardless of origin; deleting a task touches nothing else.

---

## 14. Non-Goals

This architecture explicitly does **not** commit to:

* A **second model provider** or multi-provider routing (the abstraction in §2 exists for isolation/testing/failure/model-replacement reasons, not dual-vendor operation).
* **Autonomous agents** or agentic loops acting on the user's behalf.
* **Background autonomous research** — all AI operations are user-initiated through the API.
* **Automatic promotion of AI conclusions into observations** — analyses never become observations, never mutate them; research suggestions become tasks only via explicit user acceptance (§9).
* A separate **`/api/v1/ai/chat`** endpoint — stateful chat is conversation messaging (ADR-018).
* A particular **vector database** or **embedding model** — the index schema keeps storage/model flexible; choices get their own ADR when made.
* A particular **Maps provider** (ADR-020) — unrelated to the AI layer, listed here to keep the deferral visible.
* **Speculative AI infrastructure** (fine-tuning pipelines, agent frameworks, model-hosting) — nothing beyond the Gemini API usage the canonical documents already require.

---

## 15. Consistency Notes

* Capabilities, endpoints, error codes, and rate-limit tiers cited here are those of `API.md`; entity shapes and the `research_suggestions` enum are those of `DATABASE_SCHEMA.md` / ADR-015; failure semantics honor ADR-009 (validate-before-persist) and ADR-010 (untrusted content); retrieval and index rules implement ADR-017; the chat surface decision implements ADR-018; deferrals follow ADR-020.
* AI quality assurance (evaluation cases, scoring, release gates) is defined in `AI_EVALUATION.md`; operational metrics/alerting in `OBSERVABILITY.md`. This document defines neither evaluation cases nor alert thresholds.
