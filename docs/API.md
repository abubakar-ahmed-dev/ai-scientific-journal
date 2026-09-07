# API Specification

**Status:** Canonical (aligned with ADR-013 – ADR-018, ADR-021 and the canonical `DATABASE_SCHEMA.md`)
**Last updated:** 2026-09-02
**Product:** AI Scientific Journal

> **Scope note:** This document is the single authoritative API specification. It defines the HTTP surface only — data shapes are defined in `DATABASE_SCHEMA.md`, security architecture in `SECURITY.md`. Where earlier documents conflict with this specification, this specification and the referenced ADRs prevail.

---

## 1. Conventions

### 1.1 Base URL and versioning

```text
Local:      http://localhost:<PORT>/api/v1
Production: https://<cloud-run-service>/api/v1
```

* All **business** endpoints are versioned under `/api/v1` (**ADR-018**).
* The health check is intentionally **unversioned** so liveness probes do not track API versions: `GET /api/health`.

### 1.2 Resource style

* Resource paths are **flat** (`/observations/:observationId`); project scoping is expressed as a **query parameter / body field**, never as a path segment (**ADR-014**).
* Firestore collection paths are an implementation detail and are **not part of the public contract**. Clients handle resource IDs only. (Backend-derived Cloud Storage paths are likewise never exposed; see §10.)

### 1.3 Content and headers

* Requests and responses use `application/json` (except file upload: `multipart/form-data`, §10.2).
* Every request may supply `X-Request-Id`; if absent, the backend generates one. The same ID is returned in the error envelope `requestId` and used in server logs for tracing.

### 1.4 Success envelope

```json
{
  "data": {},
  "meta": {}
}
```

* Single resources: `data` is an object; `meta` may be omitted.
* Lists: `data` is an array; `meta` **always** carries pagination state (§5).
* Creation responses return HTTP `201` with the created resource in `data`.

---

## 2. Authentication and Authorization

### 2.1 Authentication

All `/api/v1` endpoints require authentication except where explicitly marked public (`GET /api/health`).

```text
Authorization: Bearer <Firebase ID Token>
```

* The backend verifies the Firebase ID token and derives the authenticated **UID from the verified token only**.
* A UID supplied by the client in any body, query, or header is **never** accepted as an authorization mechanism and is ignored or rejected.
* Missing/invalid/expired token → `401` with code `UNAUTHENTICATED`.
* The user document (`users/{uid}`) is created or refreshed lazily on first authenticated request (`lastLoginAt` side effect).

### 2.2 Authorization rule (owner-only)

Every user-private resource is scoped by the authenticated UID:

```text
allow  ⇔  resource.ownerId == authenticated UID (and resource lies within users/{uid}/…)
```

* Requests for another user's resource return **`404 NOT_FOUND`**, not `403`, to avoid disclosing resource existence (`SECURITY.md` §24). `403 FORBIDDEN` is reserved for authenticated operations the account may not perform (e.g., suspended account).
* Authorization is enforced by the backend independently of Firestore Security Rules and independently of Gemini.
* AI features never influence authorization: retrieval and context assembly are UID-scoped **before** any model call.

---

## 3. Error Contract

### 3.1 Envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message.",
    "requestId": "req_01J9..."
  }
}
```

`message` is safe for display and never contains stack traces, provider errors, credentials, database details, or internal paths.

### 3.2 Error code registry

The registry below is the single canonical list; endpoint sections reference these codes only.

| Code | HTTP | Meaning |
| ---- | ---- | ------- |
| `UNAUTHENTICATED` | 401 | Missing, invalid, or expired Firebase ID token |
| `FORBIDDEN` | 403 | Authenticated but not permitted (e.g., suspended account) |
| `NOT_FOUND` | 404 | Resource does not exist **or belongs to another user** (existence-hiding) |
| `VALIDATION_ERROR` | 400 | Request failed validation (details identify offending fields, never echo secrets) |
| `CONFLICT` | 409 | State conflict (e.g., stale `expectedVersion` on update) |
| `PAYLOAD_TOO_LARGE` | 413 | Body or file exceeds configured limits |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Unsupported `Content-Type` or file MIME type |
| `RATE_LIMIT_EXCEEDED` | 429 | Per-user rate limit hit (retry after `Retry-After`) |
| `AI_INVALID_RESPONSE` | 502 | Gemini returned output that failed schema/application validation (nothing persisted) |
| `AI_UNAVAILABLE` | 503 | Gemini unavailable, rate-limited upstream, or timed out |
| `INTERNAL_ERROR` | 500 | Unexpected server error (details logged, never returned) |

---

## 4. Rate Limiting and Idempotency

### 4.1 Rate limits (**ADR-008**)

Expensive endpoints are rate-limited **per user** (IP-based backstop also applies). Defaults (configurable via server configuration):

| Endpoint group | Default limit |
| -------------- | ------------- |
| `POST /conversations/:id/messages` (chat) | 20 requests / 5 min / user |
| `POST /ai/*` (generation, except search) | 10 requests / 5 min / user |
| `POST /ai/search` (retrieval-only read) | 60 requests / min / user |
| `POST /observations/:id/media` (upload) | 30 uploads / hour / user |
| All other mutations | 60 requests / min / user |

Exceeding a limit returns `429` with code `RATE_LIMIT_EXCEEDED` and a `Retry-After` (seconds) header. Responses on AI endpoints include `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers.

### 4.2 Idempotency

Write endpoints that can be harmlessly duplicated (`POST /observations`, `POST /observations/:id/media`, `POST /conversations/:id/messages`, `POST /ai/summarize|analyze|suggest-research`) accept an optional header:

```text
Idempotency-Key: <client-generated UUID>
```

Behavior: the first request executes; retries with the **same key** (same user, same endpoint) within 24 h return the **original result** (HTTP `200` with the original `data`) without re-executing. A reused key with a different request body returns `409 CONFLICT`. Keys are privacy-safe random client identifiers; they are never logged with request payloads.

---

## 5. Pagination Contract

All list endpoints use **cursor pagination** — no offset/limit scanning of unbounded collections.

### 5.1 Request parameters

| Param | Type | Default | Rules |
| ----- | ---- | ------- | ----- |
| `limit` | integer | 20 | 1–100 (messages: 1–200) |
| `cursor` | string | — | Opaque cursor from a previous response's `meta.nextCursor`; must be used unchanged and only with the same query/filter set and `sort` value |

### 5.2 Response meta

```json
{
  "data": [ ],
  "meta": {
    "nextCursor": "eyJ2IjoxLCJvIjoxNz...",
    "hasMore": true,
    "limit": 20
  }
}
```

`hasMore: false` ⇒ `nextCursor` is `null` and the page is final. Cursors are **opaque** to clients: they must be treated as black-box tokens, passed through unchanged, and never parsed, constructed, or assumed to encode any particular ordering. Cursor encoding, signing, and expiration are **implementation details**, not API guarantees. A stale, expired, or invalid cursor yields `400 VALIDATION_ERROR` instructing the client to restart the list from the first page.

### 5.3 Ordering — server timestamps vs scientific ordering (per `DATABASE_SCHEMA.md` §16)

* **Cursor pagination always uses stable server-managed ordering keys**: `updatedAt DESC` (default for lists), `createdAt ASC`/`DESC`, or `sequence ASC` (messages). These are manipulation-resistant and never client-supplied.
* The observations list additionally supports **`sort=observed`** (scientific ordering by `observedAt DESC`) for chronology-of-event views. `observedAt` is a client-supplied, server-validated scientific timestamp — suitable for display ordering, **not** a stable or manipulation-resistant key. Cursors for `sort=observed` are therefore bound to that sort choice and documented as display-ordering cursors only; sync, change detection, and background processes must use the default `sort=updated`.
* In all cases clients treat cursors as opaque tokens (§5.2); how a cursor encodes (or protects) its sort key internally is invisible to the API contract.
* Mixing `sort` values or filters between cursor pages is rejected (`400 VALIDATION_ERROR`). This removes ambiguous pagination semantics.

---

## 6. Endpoint Summary

| # | Method & Path | Purpose |
| - | ------------- | ------- |
| 6.1 | `GET /api/health` | Liveness (public, unversioned) |
| 6.2 | `GET|PATCH /api/v1/me` | Authenticated user profile |
| 6.3 | `POST /api/v1/projects` · `GET /api/v1/projects` | Create / list projects |
| 6.4 | `GET|PATCH|DELETE /api/v1/projects/:projectId` | Read / update / delete project |
| 6.5 | `POST /api/v1/observations` · `GET /api/v1/observations` | Create / list observations |
| 6.6 | `GET|PATCH|DELETE /api/v1/observations/:observationId` | Read / update / delete observation |
| 6.7 | `GET /api/v1/observations/:observationId/versions[/:versionId]` | Version history (read-only) |
| 6.8 | `POST /api/v1/observations/:observationId/media` | Upload evidence media |
| 6.9 | `GET|DELETE /api/v1/observations/:observationId/media/:mediaId` | Media metadata + authorized read / delete (observation-scoped) |
| 6.10 | `POST /api/v1/conversations` · `GET /api/v1/conversations` | Create / list conversations |
| 6.11 | `GET|PATCH|DELETE /api/v1/conversations/:conversationId` | Read / update-archive / delete conversation |
| 6.12 | `GET|POST /api/v1/conversations/:conversationId/messages` | List messages / **stateful chat** |
| 6.13 | `GET /api/v1/analyses` · `GET /api/v1/analyses/:analysisId` | List / read analyses |
| 6.14 | `GET|POST|PATCH|DELETE /api/v1/research-tasks[/:taskId]` | Research tasks incl. AI-suggestion acceptance |
| 6.15 | `POST /api/v1/ai/summarize|analyze|suggest-research|ask|search` | AI pipeline endpoints |

Authentication is **required** for every endpoint in 6.2–6.15.

---

## 6.1 Health

### `GET /api/health` — public, unversioned

| Aspect | Specification |
| ------ | ------------- |
| Auth | **None** (liveness probe) |
| Response | `200` — `{"status": "ok"}` |
| Notes | Deliberately unversioned (§1.1). Returns no configuration, dependency, or infrastructure detail. Deep dependency checks are not part of this endpoint. |

---

## 6.2 Me

Every `/me` response carries `avatarUrl` — a fresh short-lived signed read URL
for the uploaded avatar (`null` when none). The internal `avatarPath` storage
location is never exposed (same rule as media, ADR-016).

### `GET /api/v1/me`

| Aspect | Specification |
| ------ | ------------- |
| Auth | Required |
| Authorization | Own profile only (UID from token) |
| Response | `200` — `{ "data": { user } }` — the `users/{uid}` document per `DATABASE_SCHEMA.md` §5.1, plus `avatarUrl` |
| Side effects | Ensures the user document exists; updates `lastLoginAt` (server timestamp) |

### `PATCH /api/v1/me`

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "displayName"?, "photoURL"?, "preferences"? }` — partial update |
| Validation | `displayName` 1–100 chars; `photoURL` valid HTTPS URL ≤ 2048 chars; `preferences` object validated against the schema (enum checks for `theme`, IANA timezone string, booleans); unknown fields rejected |
| Side effects | `displayName` is also propagated to the Firebase Auth profile (best-effort; Firestore remains the source of truth) |
| Immutable | `role`, `accountStatus`, `createdAt` — attempts are rejected with `400 VALIDATION_ERROR` naming the field |
| Response | `200` — updated `{ "data": { user } }` |

### `PATCH|DELETE /api/v1/me/avatar` (profile avatar — settings refactor 2026-09-07)

| Aspect | Specification |
| ------ | ------------- |
| `PATCH /avatar` | multipart field `file`: JPEG/PNG/WebP/HEIC image, ≤ 2 MB (413 on excess), magic-byte sniffed against the declared MIME (415 on mismatch); streams to `users/{uid}/avatar/avatar` (fixed object name — a new upload overwrites the old binary in place); sets `avatarPath` |
| `DELETE /avatar` | Clears `avatarPath` and best-effort deletes the object |
| Errors | `400 VALIDATION_ERROR` (no file), `413 PAYLOAD_TOO_LARGE`, `415 UNSUPPORTED_MEDIA_TYPE` |
| Response | `200` — updated `{ "data": { user } }` with fresh `avatarUrl` (`null` after delete) |

---

## 6.3 Projects

Projects are **optional organizational resources** (**ADR-014**). Nothing in the API requires an observation to have a project.

### `POST /api/v1/projects`

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "title": string, "description"?, "field"?, "tags"?: string[] }` |
| Validation | `title` 1–200 chars (required); `description` ≤ 5000; `field` ≤ 100; `tags` ≤ 20 tags, each 1–50 chars; unknown fields rejected |
| Response | `201` — project resource (`status: "active"`, server timestamps set) |
| Idempotency | `Idempotency-Key` honored (§4.2) |

### `GET /api/v1/projects`

| Aspect | Specification |
| ------ | ------------- |
| Query | `limit`, `cursor`; optional `status=active\|archived\|completed` |
| Ordering | `updatedAt DESC` (stable server key) |
| Response | `200` — `{ "data": [projects], "meta": pagination }` |

### `GET|PATCH|DELETE /api/v1/projects/:projectId`

| Aspect | Specification |
| ------ | ------------- |
| `GET` | `200` — project; `404` if missing or foreign |
| `PATCH` | Body: `title`?, `description`?, `field`?, `tags`?, `status`? (`active\|archived\|completed`; setting `archived` also sets `archivedAt` server-side) · optional `expectedVersion` for optimistic locking (§6.6 note) · `200` updated |
| `DELETE` | `204`. **Side effects (per `DATABASE_SCHEMA.md` §19, ADR-021):** observations, conversations, and research tasks with `projectId == deleted` are set to `projectId: null` (**unfiled — never deleted**); **analyses retain their `projectId` unchanged** as a dangling historical reference (append-only artifacts are never mutated by project deletion); no cascade deletion of user content. Idempotent: deleting a missing/foreign project returns `404` on first attempt |

---

## 6.5 Observations

The Observation is the fundamental record (**ADR-013**) — scientific observations and ordinary/freeform journal entries are the same resource; the scientific fields are optional. There are **no `/journalEntries` endpoints**. Observations are **user-flat**: never nested under projects in the API hierarchy (**ADR-014**).

### `POST /api/v1/observations`

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "title": string, "description": string, "projectId"?: string\|null, "notes"?, "hypothesis"?, "observedAt"?: ISO-8601, "location"?: { latitude, longitude, accuracyMeters?, label?, "precision": "exact"\|"approximate"\|"hidden" }, "tags"?: string[], "measurements"?: [{ id?, name, value, unit, observedAt?, notes? }], "status"?: "draft"\|"observed" }` |
| Validation | `title` 1–200 (required); `description` 1–20 000 (required); `projectId` must reference an existing project owned by the caller (backend re-validates ownership — invalid → `400 VALIDATION_ERROR`); `observedAt` valid date, not > 5 min in the future (defaults to server now); `location.latitude` −90…90, `longitude` −180…180, `precision` enum required if `location` present; `tags` ≤ 20 × 50 chars; `measurements` ≤ 50 entries, `value` finite number, `name`/`unit` 1–50 chars; unknown fields rejected. **`ownerId`, `status: "analyzed"`, `mediaCount`, `version` are server-managed and rejected if supplied** |
| Response | `201` — observation resource (`version: 1`, `mediaCount: 0`) |
| Side effects | Creates the derived search index entry (`users/{uid}/observationSearch/…`) — internal, never exposed |
| Idempotency | `Idempotency-Key` honored (§4.2) — duplicate submissions return the original observation |

### `GET /api/v1/observations`

| Aspect | Specification |
| ------ | ------------- |
| Query | `limit`, `cursor`; `sort=updated` (default) \| `observed` (§5.3); filters: `projectId` (or `projectId=unfiled` for `null`), `status`, `tag` (single tag, repeatable up to 3), `q` (server-side text prefilter; retrieval-quality search belongs to `/ai/search`) |
| Response | `200` — `{ "data": [observations], "meta": pagination }` |
| Notes | Lists the user's own observations only. Cross-project views (research map, dashboard) are this same endpoint without `projectId` |

### `GET|PATCH|DELETE /api/v1/observations/:observationId`

| Aspect | Specification |
| ------ | ------------- |
| `GET` | `200` — observation; `404` if missing or foreign (existence-hiding) |
| `PATCH` | Body: same fields as create, all optional; `status` may also become `archived`. **Optimistic locking:** optional `expectedVersion` must equal the current `version`; mismatch → `409 CONFLICT` (prevents accidental overwrite, PRD NFR-06). On success `version` increments server-side |
| Versioning | When observation editing/versioning is enabled (**ADR-016**, deferred to the editing phase), a successful content-changing `PATCH` internally snapshots the prior state as an immutable version. This is **not** a client-driven operation (§6.7) |
| `DELETE` | `204`. **Side effects (per `DATABASE_SCHEMA.md` §19):** cascades to the observation's versions, media (metadata **and** Cloud Storage objects), and derived search index entry. **Analyses referencing this observation are retained** (dangling references; §6.13/§7.2). Idempotent semantics: `404` on repeat |

---

## 6.7 Observation Versions (read-only)

Versions are an **internal consequence of editing** — clients never create them (**ADR-016**). The API exposes read-only history once versioning is enabled; until then these return `404` with `NOT_FOUND` for any observation (documented, intentional: the feature ships with the editing phase).

### `GET /api/v1/observations/:observationId/versions`

* Query: `limit`, `cursor`; ordering `editedAt DESC`.
* `200` — `{ "data": [version], "meta": pagination }` (shape per `DATABASE_SCHEMA.md` §9).
* Authorization: inherited from the observation path — owner-only; no separate ownership fields exist on versions (`editedBy` is actor attribution).

### `GET /api/v1/observations/:observationId/versions/:versionId`

* `200` — single immutable version; `404` unknown/foreign.

---

## 6.8 Media

Media metadata lives under the observation (**ADR-016**); binaries live in Cloud Storage. **Clients never choose, see, or transmit storage paths** — the backend derives `users/{uid}/observations/{observationId}/{mediaId}` internally. `storagePath` is **omitted from all API responses** (backend-internal).

### `POST /api/v1/observations/:observationId/media` — upload

| Aspect | Specification |
| ------ | ------------- |
| Request | `multipart/form-data`: `file` (binary, required), `caption` (string, optional) |
| Flow | 1) Validate the caller owns the parent observation (`404` otherwise). 2) Validate the file: allowed MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `audio/mpeg`, `audio/mp4`, `audio/wav`, `video/mp4`), size limits (images ≤ 10 MB, audio ≤ 25 MB, video ≤ 100 MB — configurable), extension/MIME consistency. 3) Backend generates `mediaId`, derives the storage path, uploads the binary to Cloud Storage. 4) Persists the metadata document, increments `observation.mediaCount`. 5) Returns the metadata. Failure at any step before (4) leaves no partial metadata; failure at (3)–(4) triggers best-effort orphan-object cleanup |
| Response | `201` — `{ "data": { media } }` (no `storagePath`). Read access to the binary is via `GET …/media/:mediaId` below |
| Errors | `404` (no/foreign observation) · `413 PAYLOAD_TOO_LARGE` · `415 UNSUPPORTED_MEDIA_TYPE` · `429` |
| Idempotency | `Idempotency-Key` honored — retried uploads do not create duplicate media |

### Media access policy

* Media read/delete routes are **observation-scoped**: `/api/v1/observations/:observationId/media/:mediaId`. A globally-scoped `/media/:mediaId` resource deliberately does not exist (see §8).
* The `GET` endpoint returns metadata plus a short-lived authorized read URL; this is the access mechanism — no separate presigned-URL infrastructure at this stage.
* Raw storage objects must never be publicly exposed or served directly to clients; the backend derives paths internally and `storagePath` never appears in any API response.

### `GET /api/v1/observations/:observationId/media/:mediaId`

* Authorization: owner-only; the media ID is resolved **within the caller's observation path** (observation-scoped routing — there is no globally-scoped media resource).
* `200` — metadata **plus** `data.url`: a short-lived (≤ 15 min) authorized read URL for the binary. No separate presigned-URL infrastructure — this endpoint **is** the authorized access mechanism. Raw Cloud Storage objects are **never publicly exposed**; all binary access flows through this authenticated route. `404` if missing/foreign or if the parent observation was deleted.

### `DELETE /api/v1/observations/:observationId/media/:mediaId`

* `204`. Side effects: deletes the Cloud Storage object and metadata document, decrements `observation.mediaCount`. Idempotent semantics: `404` on repeat.

---

## 6.10–6.12 Conversations and Messages

Conversations are user-level resources; they may optionally reference a project (`projectId`) and/or a contextual entity (`contextType` + `contextId`) (**ADR-014**, `DATABASE_SCHEMA.md` §11).

### `POST /api/v1/conversations`

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "title"?, "projectId"?, "contextType": "general"\|"observation"\|"project"\|"research", "contextId"? }` |
| Validation | `contextType` required; `contextType: "general"` ⇔ `contextId` absent/null; otherwise `contextId` must reference an existing entity of the matching type owned by the caller (`observation` → observation ID; `project` → project ID; `research` → analysis ID); `projectId` ownership validated like observations; `title` ≤ 200 |
| Response | `201` — conversation (`messageCount: 0`, `status: "active"`) |
| Idempotency | `Idempotency-Key` honored |

### `GET /api/v1/conversations`

* Query: `limit`, `cursor`; filters `projectId`, `status`, `contextType`. Ordering `updatedAt DESC`.
* `200` — `{ "data": [conversations], "meta": pagination }`.

### `GET|PATCH|DELETE /api/v1/conversations/:conversationId`

| Aspect | Specification |
| ------ | ------------- |
| `GET` | `200` — conversation resource |
| `PATCH` | Body: `title`?, `status`? (`active`\|`archived`). `contextType`/`contextId`/`projectId` are **immutable after creation** (change requires a new conversation) |
| `DELETE` | `204`. Side effects: cascades to `messages/*`. Analyses sourced from this conversation are **retained** (§7.2) |

### `GET /api/v1/conversations/:conversationId/messages`

* Query: `limit` (1–200, default 50), `cursor`. Ordering `sequence ASC` (stable server key). Newest-page UX may request the tail by passing the final cursor and paging backwards via `meta.prevCursor` (included for this endpoint only).
* `200` — `{ "data": [messages], "meta": { nextCursor, prevCursor, hasMore, limit } }`.

### `POST /api/v1/conversations/:conversationId/messages` — the stateful chat endpoint (**ADR-018**)

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "content": string }` |
| Validation | `content` 1–8000 chars after trim (limits configurable); conversation must exist, belong to the caller, and be `active` |
| Pipeline | 1) Persist the **user message** (next `sequence`). 2) Assemble bounded context (recent messages + optional summaries — never the unbounded history). 3) Call Gemini server-side. 4) Validate output. 5) Persist the **assistant message** (`model`, non-sensitive `metadata`). 6) Update conversation counters/timestamps |
| Response | `201` — `{ "data": { "userMessage": {…}, "assistantMessage": {…} } }` |
| Failure semantics | If step 3–4 fails: `503 AI_UNAVAILABLE` (or `502 AI_INVALID_RESPONSE`) — **the user message remains persisted** (user content is never lost); the assistant turn is simply absent. Client retries **with the same `Idempotency-Key`** trigger assistant generation for the last unanswered user message instead of duplicating it |
| Rate limits | Chat tier (§4.1) |

---

## 6.13 Analyses

The **single** AI-output resource (**ADR-015**). There are **no `/summaries` or `/insights` APIs**. Analyses are **append-only**: generation endpoints always create a new analysis; nothing overwrites one. Analyses **never mutate** user-authored content — `status: "analyzed"` on an observation is the only permitted write-back, performed server-side.

**Analysis `type` enum:** the canonical schema defines five types — `summary | analysis | hypothesis | classification | research_suggestions` — and **all five are valid in reads and the `type` list filter**. Only the types with a generation pipeline are currently **generatable** (`summary`, `analysis`, `research_suggestions` — see §6.15). `hypothesis` and `classification` are reserved for future features (e.g., PRD FR-19 auto-tagging); endpoints that create analyses reject any attempt to specify a type directly — the type is an outcome of the endpoint chosen, never a client parameter.

### `GET /api/v1/analyses`

| Aspect | Specification |
| ------ | ------------- |
| Query | `limit`, `cursor`; filters: `observationId` (analyses whose `observationIds` contains it), `conversationId`, `type`, `projectId`. Ordering `createdAt DESC` |
| Response | `200` — `{ "data": [analyses], "meta": pagination }` |
| Dangling sources | An analysis may reference a **deleted** observation (approved RETAIN decision). List/read responses include such IDs unchanged; **resolving existence is the consumer's job via the observations API** (or the documented `?includeSources=summary` expansion below) |

### `GET /api/v1/analyses/:analysisId?includeSources=summary`

* `200` — analysis. Optional `includeSources=summary` expands each `observationIds[]` entry to `{ observationId, found: boolean, title?, status? }` — letting clients render a graceful **"source deleted"** state without N+1 requests. `404` if missing/foreign.

### Generation endpoints → §6.15

Analyses are created **only** through the AI pipeline endpoints (`/ai/summarize`, `/ai/analyze`, `/ai/suggest-research`). There is no generic client `POST /analyses` — that would bypass output validation (ADR-009).

---

## 6.14 Research Tasks

Tasks are user-level resources (**ADR-014**). **AI never autonomously creates tasks** — a `source: "gemini"` task exists only after the user accepts an AI suggestion (PRD FR-15).

### `GET /api/v1/research-tasks`

* Query: `limit`, `cursor`; filters `status`, `projectId`. Ordering `updatedAt DESC`.
* `200` — `{ "data": [tasks], "meta": pagination }`.

### `GET /api/v1/research-tasks/:taskId`

* `200` — task; `404` missing/foreign.

### `POST /api/v1/research-tasks`

| Aspect | Specification |
| ------ | ------------- |
| Body — user-created | `{ "source": "user", "title": string, "description": string, "projectId"?, "relatedObservationIds"?: string[] }` |
| Body — accepting an AI suggestion | `{ "source": "gemini", "sourceAnalysisId": string, "suggestionIndex": number }` — the backend copies `suggestedNextSteps[suggestionIndex]` (and its context) from the caller's own analysis into a new task with `status: "suggested"`. Out-of-range index or foreign/missing analysis → `400 VALIDATION_ERROR` / `404` |
| Validation | `title` 1–200, `description` 1–5000 (user form); `relatedObservationIds` ≤ 50, each validated as an owned observation; `projectId` ownership validated |
| Response | `201` — task |
| Idempotency | `Idempotency-Key` honored (prevents double-accepting a suggestion) |

### `PATCH /api/v1/research-tasks/:taskId`

* Body: `title`?, `description`?, `status`?, `projectId`? — transitions follow `suggested → planned → in_progress → completed`, with `dismissed` allowed from any state (`DATABASE_SCHEMA.md` §17); invalid transitions → `400 VALIDATION_ERROR`.
* `projectId` moves the task between projects; `null` files it under "Unfiled". Ownership of the target project is validated; unknown or foreign project → `400 VALIDATION_ERROR`.
* `200` — updated task.

### `DELETE /api/v1/research-tasks/:taskId`

* `204`. Hard delete of the task only; analyses and observations are untouched.

---

## 6.15 AI Pipeline Endpoints

All AI endpoints: authenticated, rate-limited (AI tier), `Idempotency-Key`-aware, and executed **server-side** (ADR-003). Retrieval/context assembly is **UID-scoped before the model call** — the model never influences what data is fetched (ADR-010, `SECURITY.md` §10). All model outputs are parsed → schema-validated → application-validated **before persistence** (ADR-009); invalid output is never stored (`502 AI_INVALID_RESPONSE`). User content is preserved on any failure (`503 AI_UNAVAILABLE`).

### `POST /api/v1/ai/summarize`

| Aspect | Specification |
| ------ | ------------- |
| Body | Exactly one source: `{ "conversationId": string }` **or** `{ "observationIds": string[] }` (1–20, all owned). Optional `projectId?` for association |
| Result | Creates an analysis with `type: "summary"` sourced accordingly → `201 { "data": { analysis } }` |
| Errors | `400` (both/neither source, invalid IDs) · `404` (foreign source) · `429` · `502/503` |

### `POST /api/v1/ai/analyze`

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "observationIds": string[] }` (1–10, all owned). Optional `projectId?` |
| Result | Creates an analysis with `type: "analysis"` — structured summary, key findings, hypotheses (with confidence + supporting observation IDs), uncertainties, suggested questions, suggested next steps. Observation `status` becomes `"analyzed"` (server-side) |
| Errors | as summarize |

### `POST /api/v1/ai/suggest-research`

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "observationIds"?: string[], "analysisId"?: string }` (at least one source, all owned) |
| Result | Creates an analysis with `type: "research_suggestions"` whose `suggestedNextSteps[]` can later be **accepted** as tasks via `POST /research-tasks` (`source: "gemini"`) — suggestion ≠ task |
| Errors | as summarize |

### `POST /api/v1/ai/ask` — Ask My Journal (PRD FR-16)

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "question": string, "conversationId"?: string }` — `question` 1–2000 chars; `conversationId` (owned, `active`) optionally persists the exchange through the standard message pipeline |
| Retrieval | The question is answered **only** from the caller's own observations: UID-scoped retrieval (candidate scan ordered by `observedAt` desc) → reranking → grounded generation. Retrieved content is untrusted prompt input (ADR-010). No other user's data is ever retrievable |
| Evidence gate | If no candidate matches, or the best candidate score is below the weak-evidence threshold, a deterministic insufficient-evidence answer is returned and the model is **never invoked** (`model: "none"`, `insufficientEvidence: true`) |
| Response | `200` — `{ "data": { "answer": string, "evidence": [{ "observationId", "title", "observedAt" }], "uncertainties": string[], "insufficientEvidence": boolean, "model", "promptVersion" }, "meta": { "truncated": boolean } }` — grounded per TA §27 (answer / evidence / uncertainty). If evidence is insufficient, `answer` says so and `evidence` is empty — the model is never allowed to fabricate observations. `meta.truncated` is `true` when retrieval hit the candidate cap (only the most recent observations were searched) |
| Persistence | Stateless by default. With `conversationId`, the question and grounded answer are persisted as user/assistant messages (no separate analysis document is created) |

### `POST /api/v1/ai/search` — retrieval only (PRD FR-17)

| Aspect | Specification |
| ------ | ------------- |
| Body | `{ "query": string, "limit"?: number (1–25, default 10), "projectId"?: string }` |
| Behavior | Retrieval + reranking over the caller's own derived index (`users/{uid}/observationSearch/…` — internal; **not** exposed as a CRUD resource, **not** a source of truth, **not** an authorization source, ADR-017). The candidate scan is ordered by `observedAt` desc; when it hits the candidate cap, only the most recent observations are scored. Results are re-checked against canonical observations before returning; deleted observations never appear |
| Response | `200` — `{ "data": [{ "observationId", "title", "observedAt", "score", "snippet" }], "meta": { "resultCount", "truncated" } }` |
| Notes | No generation, no persistence. Powers "related observations" and pre-chat retrieval. `score` is a lexical relevance value in 0–1 — not a probabilistic confidence. `meta.truncated: true` means coverage is partial (older records were not candidates); clients surface this |

---

## 7. Cross-Cutting Behaviors

### 7.1 Deletion semantics (summary)

| Deleted | Cascade | Retained |
| ------- | ------- | -------- |
| Project | Observations, conversations, research tasks referencing it become `projectId: null` (**unfiled**, never deleted) | **Analyses referencing it** (dangling `projectId` retained — ADR-021) |
| Observation | versions, media (metadata + binaries), derived index entry | **Analyses referencing it** (dangling refs, §7.2) |
| Conversation | messages | **Analyses sourced from it** |
| Media | binary + metadata; `mediaCount` decremented | — |
| Research task | — (hard delete of the task alone) | — |

### 7.2 Dangling analysis references

Because analyses are historical, append-only records (**ADR-015**; approved RETAIN decision), an analysis may reference resources that have since been deleted: entries in `observationIds[]` / `supportingObservationIds[]` **and** a non-null `projectId` whose project no longer exists (project deletion retains analyses' `projectId` — ADR-021; analyses sourced from a deleted conversation are likewise retained). Contract: API consumers must treat every such reference as *possibly missing*, resolve existence via the canonical collections' APIs (or `includeSources=summary` for observations), and render graceful "source deleted" / "deleted project" states. The server never resolves existence from the analysis itself; the canonical collections are authoritative.

### 7.3 AI failure never loses user content

For every AI endpoint, user-generated input (observations, messages, tasks) is persisted **before** or independently of the model call. A Gemini failure can only fail the AI step — the user's content survives and the operation can be retried.

---

## 8. Explicit Non-Goals (prohibited resources)

The following do **not** exist in this API and must not be introduced by later changes:

* **`/journalEntries`** — no such resource; journal entries are Observations (ADR-013).
* **`/summaries`, `/insights`** — no separate AI-output resources; everything is `/analyses` with `type` (ADR-015).
* **`/api/v1/ai/chat`** — removed; stateful chat is `POST /conversations/:conversationId/messages` (ADR-018).
* **`/projects/:projectId/observations`** — observations are user-flat; project scoping is a filter on `GET /observations` (ADR-014).
* **A root-level or global search/RAG resource** — retrieval is embedded in `/ai/ask` and `/ai/search`, always UID-scoped; the derived index is never a public resource (ADR-017).
* **Client-writable versions or analyses** — versions are internal consequences of editing; analyses are created only via validated AI pipelines (ADR-009/016).
* **A globally-scoped media resource** (`/media/:mediaId`) — media access is observation-scoped, and raw storage objects are never publicly exposed (ADR-016).
* Any endpoint that accepts a client-supplied UID as identity, or exposes Firestore/Cloud Storage internal paths.

---

## 9. Per-Endpoint Requirements Checklist (implementation)

Every endpoint in this specification must implement, before ship:

* [ ] Firebase ID token verification; UID from token only
* [ ] Owner-only authorization (existence-hiding `404` for foreign resources)
* [ ] Full request validation against the rules in this document (server-side)
* [ ] Response envelope `{data, meta}`; error envelope with registry codes only
* [ ] Rate limiting per §4.1 where listed; `Retry-After` on 429
* [ ] `Idempotency-Key` handling where listed
* [ ] Cursor pagination per §5 (no unbounded lists)
* [ ] Structured, privacy-aware logging (`requestId`, lengths, durations — never content, tokens, or secrets)
* [ ] Graceful AI-failure behavior per §7.3 where applicable

---

## 10. Consistency Notes

* Data shapes referenced above (`user`, `project`, `observation`, `version`, `media`, `conversation`, `message`, `analysis`, `researchTask`) are exactly those defined in `DATABASE_SCHEMA.md` §5–§14; this document intentionally does not re-state field tables.
* API design decisions trace to: ADR-008 (rate limits), ADR-009 (output validation), ADR-010 (untrusted content), ADR-013 (observation as fundamental record), ADR-014 (user-flat + optional project), ADR-015 (single analyses collection), ADR-016 (versions internal/read-only, media paths backend-derived), ADR-017 (user-scoped derived index), ADR-018 (versioning, single chat surface, added read/task endpoints), plus the approved decisions on analysis RETAIN, `observedAt` vs server-timestamp semantics, and path-inherited version ownership recorded in `DATABASE_SCHEMA.md`.
