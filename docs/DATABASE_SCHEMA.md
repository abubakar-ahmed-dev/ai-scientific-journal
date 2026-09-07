# Database Schema

**Status:** Canonical (aligned with ADR-013 – ADR-017, ADR-021)
**Last updated:** 2026-09-02

> **Note on scope:** This document defines the Firestore data model only. API endpoints are specified in `API.md`; security rules in `SECURITY.md`. Where earlier documents conflict with this schema, this schema and the referenced ADRs prevail.

## 1. Overview

The AI Scientific Journal uses **Google Cloud Firestore** as its primary database.

The database is designed around four priorities:

1. **Security** — users must never access another user's private data.
2. **Usability** — observations, conversations, and AI outputs should be easy to retrieve and organize.
3. **Stability** — schema and access patterns should support predictable reads/writes and graceful failure handling.
4. **Authenticity** — user-created records and AI-generated artifacts are preserved as distinct, attributable data.

Firestore is a NoSQL document database, so the schema uses hierarchical collections and subcollections rather than relational tables.

---

## 2. Domain Model Summary

Per **ADR-013**, the scientific domain model is canonical:

* The **Observation** is the fundamental user-created record. It may represent a scientific observation, field note, measurement record, hypothesis-related note, or ordinary personal journal entry.
* There is **no separate `journalEntries` entity**. An ordinary/freeform journal entry is an Observation with the optional scientific fields unpopulated.
* Scientific fields (`projectId`, `location`, `measurements`, `hypothesis`, tags) are **optional**.
* All persisted AI-generated structured outputs live in a **single `analyses` collection**, distinguished by `type` (**ADR-015**). There are no separate `summaries` or `insights` collections.

Core product loop (PRD §1): **Observe → Record → Analyze → Organize → Discover → Investigate Further.**

---

## 3. Canonical Firestore Structure

```text
users/{uid}                                        ← SOURCE OF TRUTH (user-owned, UID-isolated)
│
├── projects/{projectId}                           ← optional organizational layer
│
├── observations/{observationId}                   ← fundamental user-created record
│   ├── versions/{versionId}                       ← edit provenance (implementation may be deferred)
│   └── media/{mediaId}                            ← evidence media metadata
│
├── conversations/{conversationId}                 ← multi-turn Gemini conversations
│   └── messages/{messageId}
│
├── analyses/{analysisId}                          ← ALL AI-generated structured outputs (append-only)
│
├── researchTasks/{taskId}                         ← user + AI-suggested investigations
│
└── observationSearch/{observationId}              ← DERIVED RAG/search index (1:1 with observations;
                                                      NOT a source of truth, NOT an authorization source)
```

### Binary media (Cloud Storage — not Firestore)

```text
gs://<bucket>/users/{uid}/observations/{observationId}/{mediaId}
```

### Source-of-truth vs derived data

| Data | Classification | Notes |
| ---- | -------------- | ----- |
| `users/{uid}` and all collections above except `observationSearch` | **Source of truth** | Firestore is the authoritative store. |
| `users/{uid}/observationSearch/{observationId}` | **Derived / indexed** | Rebuildable from observations; never authoritative; never used to make authorization decisions (ADR-017). If a discrepancy exists, the canonical observation wins. |

**Ownership invariant (ADR-014):** every private document lives beneath `users/{uid}`, where `uid` is the authenticated Firebase UID. The client is never the source of authorization.

---

## 4. Data Ownership Model

Every private resource belongs to exactly one authenticated Firebase user. The Firebase Authentication `uid` is the authoritative user identifier.

Each user-owned document denormalizes an `ownerId` field (set by the backend from the verified token, immutable after create). This is defense-in-depth: the path enforces isolation, the field allows rule-level and query-level re-checks.

A user must never be able to:

* Read another user's observations, projects, conversations, messages, analyses, or research tasks.
* Read another user's media metadata or binary files.
* Create data under another user's UID.
* Modify or delete another user's data.
* Read or write another user's search index documents.

The client must never be trusted as the source of authorization. The backend derives the UID exclusively from the verified Firebase ID token.

---

## 5. Collections

## 5.1 Users

### Path

```text
users/{uid}
```

### Purpose

Stores minimal application-specific information about an authenticated user. Firebase Authentication remains the source of truth for identity. Preferences are stored **inline** on this document (no separate settings document).

### Example

```json
{
  "displayName": "Abubakar",
  "email": "user@example.com",
  "photoURL": "https://...",
  "avatarPath": null,
  "role": "user",
  "accountStatus": "active",
  "preferences": {
    "theme": "system",
    "timezone": "Asia/Karachi",
    "locationEnabled": true,
    "aiSuggestionsEnabled": true
  },
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp",
  "lastLoginAt": "Timestamp"
}
```

### Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `displayName` | string | Yes | Display name |
| `email` | string | Yes | Account email (from Firebase Auth) |
| `photoURL` | string | No | Profile image URL (legacy Auth mirror; the UI uses the uploaded avatar instead) |
| `avatarPath` | string \| null | No | Internal storage path of the uploaded avatar (`users/{uid}/avatar/avatar`). Never returned by the API — clients receive a signed `avatarUrl`. Absent in documents created before the field existed = no avatar |
| `role` | string | Yes | `user` \| `admin` — server-managed |
| `accountStatus` | string | Yes | `active` \| `suspended` \| `deleted` — server-managed |
| `preferences` | map | Yes | Inline user preferences (see below) |
| `preferences.theme` | string | Yes | `light` \| `dark` \| `system` — stored for API compatibility; the UI has no theme switcher (2026-09-07) |
| `preferences.timezone` | string | Yes | IANA timezone identifier — stored for API compatibility; timestamps render in the browser's locale (2026-09-07) |
| `preferences.locationEnabled` | boolean | Yes | New observations open the location panel and attempt GPS capture by default |
| `preferences.aiSuggestionsEnabled` | boolean | Yes | Stored for API compatibility; not consumed by the UI (2026-09-07 — the only proactive AI surface did not justify a setting) |
| `createdAt` | timestamp | Yes | Account creation (server timestamp) |
| `updatedAt` | timestamp | Yes | Last profile update (server timestamp) |
| `lastLoginAt` | timestamp | No | Last recorded login (server timestamp) |

### Security

* Users may read/update only their own user document.
* The client can never change: `uid` (path), `role`, `accountStatus`, `createdAt`.
* No passwords, credentials, or tokens are stored here.

---

# 6. Projects (optional organizational layer)

## Path

```text
users/{uid}/projects/{projectId}
```

## Purpose

An optional organizational entity that groups observations, conversations, analyses, and research tasks into a research effort (e.g., "Urban Bird Behavior Study"). **Per ADR-014, a Project is never a mandatory parent** — Observations and other entities may have `projectId: null`.

## Example

```json
{
  "ownerId": "<uid>",
  "title": "Urban Bird Behavior Study",
  "description": "Seasonal observations of feeder behavior.",
  "field": "ornithology",
  "status": "active",
  "tags": ["birds", "urban"],
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp",
  "archivedAt": null
}
```

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `ownerId` | string | Yes | Firebase UID — backend-set, immutable |
| `title` | string | Yes | Project name |
| `description` | string | No | Project description |
| `field` | string | No | Scientific field/discipline label |
| `status` | string | Yes | `active` \| `archived` \| `completed` |
| `tags` | string[] | Yes | Project-level tags (may be empty) |
| `createdAt` | timestamp | Yes | Creation (server timestamp) |
| `updatedAt` | timestamp | Yes | Last modification (server timestamp) |
| `archivedAt` | timestamp | No | Set when status becomes `archived` |

### Referential integrity

Entities referencing a `projectId` are validated on create/update: security rules verify the referenced project exists under the same `uid` (via `get()`), and the backend independently re-validates ownership.

---

# 7. Observations

## Path

```text
users/{uid}/observations/{observationId}
```

## Purpose

The fundamental user-created record (**ADR-013**). User-flat, not nested under projects (**ADR-014**). May represent a scientific observation, field note, measurement record, hypothesis-related note, or an ordinary personal journal entry — the scientific fields are simply optional.

## Example (scientific observation)

```json
{
  "ownerId": "<uid>",
  "projectId": "proj_123",
  "title": "High feeder activity before cold front",
  "description": "Observed unusually high bird activity at the feeder 30 minutes before the temperature drop.",
  "notes": "Compare with yesterday's counts.",
  "hypothesis": "Birds feed more heavily ahead of pressure drops.",
  "observedAt": "Timestamp",
  "location": {
    "latitude": 24.8607,
    "longitude": 67.0011,
    "accuracyMeters": 12,
    "label": "Backyard feeder",
    "precision": "exact"
  },
  "tags": ["birds", "weather"],
  "measurements": [
    { "id": "m1", "name": "temperature", "value": 27.4, "unit": "°C", "observedAt": "Timestamp", "notes": "shade reading" },
    { "id": "m2", "name": "visitor_count", "value": 14, "unit": "count", "observedAt": "Timestamp", "notes": null }
  ],
  "status": "observed",
  "mediaCount": 2,
  "version": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Example (ordinary journal entry — same entity, optional fields unpopulated)

```json
{
  "ownerId": "<uid>",
  "projectId": null,
  "title": "Thinking about my future",
  "description": "Reflected on career goals and possible directions.",
  "notes": null,
  "hypothesis": null,
  "observedAt": "Timestamp",
  "location": null,
  "tags": [],
  "measurements": [],
  "status": "observed",
  "mediaCount": 0,
  "version": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `ownerId` | string | Yes | Firebase UID — backend-set, immutable |
| `projectId` | string \| null | Yes | Optional project association; `null` = unfiled (**ADR-014**) |
| `title` | string | Yes | Human-readable title |
| `description` | string | Yes | Main observation content |
| `notes` | string | No | Supplementary user notes |
| `hypothesis` | string | No | User-authored hypothesis (user content — distinct from AI hypotheses in `analyses`) |
| `observedAt` | timestamp | Yes | When the phenomenon was observed (client-supplied, validated) |
| `location` | map \| null | No | Geospatial data (see below) |
| `location.latitude` | number | Cond. | Latitude −90…90 (required if `location` present) |
| `location.longitude` | number | Cond. | Longitude −180…180 (required if `location` present) |
| `location.accuracyMeters` | number | No | GPS accuracy |
| `location.label` | string | No | Human-readable place label |
| `location.precision` | string | Cond. | `exact` \| `approximate` \| `hidden` (required if `location` present; privacy control) |
| `tags` | string[] | Yes | User tags (may be empty) |
| `measurements` | Measurement[] | Yes | Structured measurements (may be empty; see §8) |
| `status` | string | Yes | `draft` \| `observed` \| `analyzed` \| `archived` |
| `mediaCount` | number | Yes | Denormalized count of media metadata documents (maintained by backend) |
| `version` | number | Yes | Current schema/content revision; starts at 1, incremented on edit |
| `createdAt` | timestamp | Yes | Creation (server timestamp) |
| `updatedAt` | timestamp | Yes | Last modification (server timestamp) |

### Field rules

* `projectId: null` is the default; a non-null value must reference an existing project owned by the same user (rules `get()` + backend check).
* `status: "analyzed"` is a convenience flag set by the backend when an analysis references this observation; AI output can never modify any other Observation field.
* `location.precision` controls **disclosure**, not retention: `exact` → coordinates stored and displayed as recorded; `approximate` → coordinates stored, UI renders an approximated position; `hidden` → coordinates remain stored (for the user's own scientific record and authorized access) but are **never displayed** and are excluded from any AI context, export, or other disclosure surface. Backends/UI must honor the precision in every response. Deleting the coordinates entirely is a separate user action (clearing the `location` field), not a `precision` value.

### Subcollections

* `versions/{versionId}` — edit provenance (§9)
* `media/{mediaId}` — evidence media metadata (§10)

---

# 8. Measurements (embedded in Observations)

Structured measurements are stored as an embedded array on the Observation — scientific data should not be forced into unstructured text. The array length is bounded by backend validation (keeping the document well under Firestore's 1 MiB limit).

```typescript
interface Measurement {
  id: string;            // unique within the observation
  name: string;          // e.g. "temperature"
  value: number;
  unit: string;          // e.g. "°C", "%", "m"
  observedAt?: Timestamp;
  notes?: string;
}
```

```text
temperature = 27.4 °C
humidity    = 63 %
distance    = 14.2 m
```

Measurements are user-authored data. AI-generated measurement values must never be written into this array; AI interpretations belong in `analyses`.

---

# 9. Observation Versions

## Path

```text
users/{uid}/observations/{observationId}/versions/{versionId}
```

## Purpose

Lightweight provenance for edits, protecting the integrity of the original scientific record (PRD NFR-06). Canonical per **ADR-016**; **implementation may be deferred until observation editing is implemented** — the schema is fixed now so enabling versions requires no migration.

## Example

```json
{
  "version": 1,
  "title": "High feeder activity before cold front",
  "description": "Observed unusually high bird activity ...",
  "hypothesis": "Birds feed more heavily ahead of pressure drops.",
  "measurements": [ ],
  "editedAt": "Timestamp",
  "editedBy": "<uid>",
  "changeReason": "Initial record"
}
```

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `version` | number | Yes | Matches the observation's `version` at snapshot time |
| `title` | string | Yes | Title at this version |
| `description` | string | Yes | Description at this version |
| `hypothesis` | string | No | Hypothesis at this version |
| `measurements` | Measurement[] | Yes | Measurements at this version (may be empty) |
| `editedAt` | timestamp | Yes | When the snapshot was taken (server timestamp) |
| `editedBy` | string | Yes | UID of the editing user |
| `changeReason` | string | No | Optional user-supplied reason for the edit |

Version documents are **immutable after creation**.

### Ownership (approved decision)

Versions deliberately have **no `ownerId` field**. Ownership is **path-inherited**: `users/{uid}/observations/{observationId}/versions/{versionId}` sits entirely within the owning user's subtree, so the parent path establishes ownership for rules and authorization. `editedBy` identifies the **actor** who created the version snapshot (always the authenticated UID in practice) — it is attribution, not an ownership claim.

---

# 10. Observation Media (metadata)

## Path

```text
users/{uid}/observations/{observationId}/media/{mediaId}
```

## Purpose

Metadata for evidence files attached to an observation (**ADR-016**). Binary files reside in Cloud Storage; Firestore stores metadata only.

### Binary storage path (backend-derived; clients never choose paths)

```text
gs://<bucket>/users/{uid}/observations/{observationId}/{mediaId}
```

> **Path disambiguation (do not confuse):** the **Firestore metadata** subcollection is `…/observations/{observationId}/media/{mediaId}` (with a `media/` segment), while the **Cloud Storage binary** path has **no** `media/` segment: `users/{uid}/observations/{observationId}/{mediaId}` (ADR-016). Implementations must derive the storage object path exactly as specified here — never by mirroring the Firestore subcollection layout.

## Example

```json
{
  "ownerId": "<uid>",
  "observationId": "obs_123",
  "type": "image",
  "storagePath": "users/<uid>/observations/obs_123/media_456",
  "fileName": "feeder-photo.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 842133,
  "caption": "Feeder at 07:40",
  "createdAt": "Timestamp"
}
```

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `ownerId` | string | Yes | Firebase UID — backend-set, immutable |
| `observationId` | string | Yes | Parent observation ID (matches path) |
| `type` | string | Yes | `image` \| `audio` \| `video` |
| `storagePath` | string | Yes | Cloud Storage object path (backend-derived) |
| `fileName` | string | Yes | Original file name (display only) |
| `mimeType` | string | Yes | Validated MIME type |
| `sizeBytes` | number | Yes | Validated file size |
| `caption` | string | No | User caption |
| `createdAt` | timestamp | Yes | Upload time (server timestamp) |

Uploads are validated (type, size, MIME) and treated as untrusted files (see `SECURITY.md` §15).

---

# 11. Conversations

## Path

```text
users/{uid}/conversations/{conversationId}
```

## Purpose

A multi-turn Gemini conversation. User-level (**ADR-014**); may optionally reference a project and/or a contextual entity.

## Example

```json
{
  "ownerId": "<uid>",
  "projectId": "proj_123",
  "title": "Feeder activity discussion",
  "contextType": "observation",
  "contextId": "obs_123",
  "messageCount": 8,
  "status": "active",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `ownerId` | string | Yes | Firebase UID — backend-set, immutable |
| `projectId` | string \| null | Yes | Optional project association |
| `title` | string | No | Conversation title |
| `contextType` | string | Yes | `general` \| `observation` \| `project` \| `research` |
| `contextId` | string \| null | Cond. | ID of the contextual entity (required when `contextType != "general"`) |
| `messageCount` | number | Yes | Denormalized message count (maintained by backend) |
| `status` | string | Yes | `active` \| `archived` |
| `createdAt` | timestamp | Yes | Creation (server timestamp) |
| `updatedAt` | timestamp | Yes | Last message/update (server timestamp) |

### Referential integrity

* `contextId` must reference an entity of the corresponding type owned by the same user.
* `contextType: "general"` requires `contextId: null`.

## Messages

### Path

```text
users/{uid}/conversations/{conversationId}/messages/{messageId}
```

### Purpose

Individual user and Gemini messages, kept as a subcollection so conversations can grow without document-size limits and support pagination (ADR-007 decision retained at user level).

### Example

```json
{
  "ownerId": "<uid>",
  "conversationId": "conv_123",
  "role": "user",
  "content": "Why did feeder activity spike before the cold front?",
  "sequence": 1,
  "createdAt": "Timestamp"
}
```

```json
{
  "ownerId": "<uid>",
  "conversationId": "conv_123",
  "role": "assistant",
  "content": "A common explanation is ...",
  "sequence": 2,
  "model": "gemini-model-name",
  "metadata": { "latencyMs": 1250, "tokenUsage": 812 },
  "createdAt": "Timestamp"
}
```

### Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `ownerId` | string | Yes | Firebase UID — backend-set, immutable |
| `conversationId` | string | Yes | Parent conversation ID (matches path) |
| `role` | string | Yes | `user` \| `assistant` \| `system` |
| `content` | string | Yes | Message content (validated, size-limited) |
| `sequence` | number | Yes | Strictly increasing ordering within the conversation |
| `model` | string | No | Gemini model (assistant messages only) |
| `metadata` | map | No | Non-sensitive AI metadata (`latencyMs`, `tokenUsage`, `sourceCount`) |
| `createdAt` | timestamp | Yes | Creation (server timestamp) |

Messages inherit the parent conversation's ownership boundary. Raw API keys, tokens, full system prompts, or infrastructure details must never be persisted in `metadata`.

---

# 12. Analyses (all AI-generated structured outputs)

## Path

```text
users/{uid}/analyses/{analysisId}
```

## Purpose

The **single** collection for persisted AI-generated structured outputs (**ADR-015**). A `type` field distinguishes kinds. This replaces the earlier separate `summaries` and `insights` collections, which no longer exist.

Design rules:

* **Append-only** — regeneration creates a new document; analyses are never overwritten.
* **Analyses are never cascade-deleted with their sources.** An analysis **may reference a deleted Observation** (dangling entry in `observationIds[]` or `supportingObservationIds[]`); analyses are historical, append-only AI records. Consumers (API/UI) must handle a missing source gracefully (e.g., render a "source deleted" state rather than failing). Whether an observation exists is always determined from the canonical `observations` collection — never from the analysis.
* Analyses are **AI artifacts and never mutate user content** (observations, projects, tasks).
* Persisted **only after** parse → schema validation → application validation (ADR-009). Invalid AI output is never stored.
* Every document carries provenance: `model`, `promptVersion`, `createdAt`, and its sources.

## Example

```json
{
  "ownerId": "<uid>",
  "projectId": "proj_123",
  "observationIds": ["obs_123", "obs_145"],
  "conversationId": null,
  "type": "analysis",
  "summary": "Feeder activity increased before two recorded temperature drops.",
  "keyFindings": [
    "Activity spiked within 30 minutes of pressure drops on both dates."
  ],
  "hypotheses": [
    {
      "statement": "Birds feed more heavily ahead of pressure drops.",
      "confidence": "medium",
      "supportingObservationIds": ["obs_123", "obs_145"]
    }
  ],
  "uncertainties": [
    "Only two pressure-drop events recorded; sample is small."
  ],
  "suggestedQuestions": [
    "Does activity correlate with time of day as well?"
  ],
  "openQuestions": [
    "Were other feeders in the area affected?"
  ],
  "suggestedNextSteps": [
    "Record visitor counts at three temperatures."
  ],
  "model": "gemini-model-name",
  "promptVersion": "observation-analysis-v1",
  "createdAt": "Timestamp"
}
```

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `ownerId` | string | Yes | Firebase UID — backend-set, immutable |
| `projectId` | string \| null | Yes | Optional project association |
| `observationIds` | string[] | Yes | Source observations (may be empty for conversation-sourced types) |
| `conversationId` | string \| null | Yes | Source conversation, when applicable |
| `type` | string | Yes | `summary` \| `analysis` \| `hypothesis` \| `classification` \| `research_suggestions` |
| `summary` | string | Yes | Concise AI-generated summary |
| `keyFindings` | string[] | Yes | Important AI-identified findings (may be empty) |
| `hypotheses` | Hypothesis[] | Yes | AI-generated hypotheses (may be empty; see below) |
| `hypotheses[].statement` | string | Yes | Hypothesis text |
| `hypotheses[].confidence` | string | No | `low` \| `medium` \| `high` |
| `hypotheses[].supportingObservationIds` | string[] | Yes | Observation IDs supporting this hypothesis (may be empty) |
| `uncertainties` | string[] | Yes | Explicit statements of insufficient evidence |
| `suggestedQuestions` | string[] | Yes | AI-suggested follow-up questions |
| `openQuestions` | string[] | Yes | Open questions from summarization (may be empty) |
| `suggestedNextSteps` | string[] | Yes | Suggested investigations (input to research tasks) |
| `model` | string | Yes | Gemini model that produced the output |
| `promptVersion` | string | Yes | Prompt template version (auditable/reproducible) |
| `createdAt` | timestamp | Yes | Creation (server timestamp) |

### Separation of knowledge categories (PRD FR-14 / SECURITY §13)

The schema deliberately lets the UI distinguish:

* **Observed facts** → the user's Observation fields.
* **AI interpretation** → `analyses.summary`, `keyFindings`.
* **Hypotheses** → `analyses.hypotheses[]` with confidence and explicit supporting observations.
* **Uncertainty** → `analyses.uncertainties[]`.

An analysis without valid required fields is rejected before persistence.

### Field applicability across types (forward-compatibility note)

All fields above are **required (possibly empty)** for every generatable type — this is a deliberate ADR-015 property: a single uniform envelope keeps validation, rendering, and the API contract simple while only three types are generatable. When the reserved types (`hypothesis`, `classification`) gain generation workflows, a **new ADR** may introduce type-specific payload shapes if a uniform field set proves awkward; until then no split is made, and per-capability prompts simply populate the fields each type actually uses (e.g., a summary leaves `hypotheses[]` empty).

---

# 13. Research Tasks

## Path

```text
users/{uid}/researchTasks/{taskId}
```

## Purpose

Concrete investigations, created by the user or accepted from AI suggestions (PRD FR-15). User-level (**ADR-014**); may optionally reference a project and related observations.

## Example

```json
{
  "ownerId": "<uid>",
  "projectId": "proj_123",
  "title": "Record bird activity at three different temperatures",
  "description": "Test whether feeder activity correlates with pre-frontal temperature drops.",
  "source": "gemini",
  "sourceAnalysisId": "anl_789",
  "status": "suggested",
  "relatedObservationIds": ["obs_123", "obs_145"],
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `ownerId` | string | Yes | Firebase UID — backend-set, immutable |
| `projectId` | string \| null | Yes | Optional project association |
| `title` | string | Yes | Task title |
| `description` | string | Yes | What to investigate and why |
| `source` | string | Yes | `user` \| `gemini` |
| `sourceAnalysisId` | string \| null | Cond. | Originating analysis when `source: "gemini"` |
| `status` | string | Yes | `suggested` \| `planned` \| `in_progress` \| `completed` \| `dismissed` |
| `relatedObservationIds` | string[] | Yes | Related observations (may be empty) |
| `createdAt` | timestamp | Yes | Creation (server timestamp) |
| `updatedAt` | timestamp | Yes | Last modification (server timestamp) |

AI never creates research tasks autonomously; `source: "gemini"` documents exist only when the **user accepts** an analysis's `suggestedNextSteps`.

---

# 14. Observation Search (derived — NOT a source of truth)

## Path

```text
users/{uid}/observationSearch/{observationId}
```

## Purpose

**Derived, user-scoped** retrieval index for RAG ("Ask My Journal", related observations), 1:1 with observations (**ADR-017**). It exists only to make retrieval efficient.

> **This is derived/indexed data.** It is **not** the source of truth — Firestore's canonical observation is. It is **not** an authorization source — ownership is enforced by the canonical model and security rules, never by index contents. If index and observation disagree, the observation wins and the index is rebuilt.

## Example

```json
{
  "observationId": "obs_123",
  "ownerId": "<uid>",
  "searchableText": "High feeder activity before cold front ... temperature 27.4 ... birds weather",
  "embeddingReference": "gs://<bucket>/embeddings/<uid>/obs_123.json",
  "embeddingVersion": "emb-v1",
  "indexedAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

## Fields

| Field | Type | Required | Description |
| ----- | ---- | -------: | ----------- |
| `observationId` | string | Yes | Document ID matches the source observation |
| `ownerId` | string | Yes | Denormalized UID — defense-in-depth only, **not** the authorization mechanism |
| `searchableText` | string | Yes | Text representation built from the observation |
| `embeddingReference` | string | No | Storage reference to embedding vector(s) |
| `embeddingVersion` | string | No | Embedding model/version for invalidation |
| `indexedAt` | timestamp | Yes | When the index entry was built (server timestamp) |
| `updatedAt` | timestamp | Yes | Last index rebuild (server timestamp) |

## Lifecycle

* **Written/updated asynchronously after** the source observation is created or updated. The canonical observation write **never depends on successful indexing** (PRD NFR-02: core journal functionality is independent of derived data); indexing is retryable and eventually consistent, and a missing/stale index entry is repaired by retry — never by blocking the observation.
* **Deleted when the source observation is deleted** (prevents stale-index retrieval). Where asynchronous deletion fails, the retrieval pipeline's re-check against canonical observations is the correctness backstop: a deleted observation must never surface regardless of index state.
* Embedding regeneration is required when `embeddingVersion` changes.
* Retrieval queries this subcollection **by user path only**; retrieved content is always treated as untrusted input for prompts.

---

# 15. Entity Relationships

```text
users/{uid}
   │ 1:N
   ├── projects ──────────────┐ (optional grouping only — no path dependency)
   │                          │
   │ 1:N                      │ projectId (nullable, optional)
   ├── observations ───────────┘
   │    │ 1:N        │ 1:N
   │    ├── versions │ └── media ──(binaries in Cloud Storage,
   │    │                        path users/{uid}/observations/{obsId}/{mediaId})
   │    │ (1:1, derived) 1:1
   │    └── observationSearch (rebuilt from observation; deleted with it)
   │
   ├── conversations ──1:N── messages
   │        │ projectId?, contextType + contextId (→ observation/project)
   │
   ├── analyses ── N:1 references → observationIds[], conversationId?, projectId?
   │        │ (append-only; sources referenced by ID, never embedded)
   │
   └── researchTasks ── relatedObservationIds[], projectId?, sourceAnalysisId?
```

Summary:

* Observation 1:N versions, 1:N media, 1:1 search index (derived).
* Conversation 1:N messages; optional links to project/context entity.
* Analysis N:1 to observations (one analysis may synthesize many); never mutates them. The reference is **soft** — analyses persist even when a source observation is deleted (consumers must handle missing sources gracefully).
* Research task references observations by ID; may originate from an analysis. `relatedObservationIds` is likewise a soft reference.

---

# 16. Timestamps

Firestore **server timestamps** are used for all authoritative events:

```text
createdAt, updatedAt, indexedAt, editedAt, lastLoginAt
```

* Reduces manipulation by malicious clients.
* Provides the ordering keys for **default** pagination cursors (`updatedAt DESC`, `createdAt ASC`, `sequence ASC`) — see the timestamp-semantics contract below.
* `observedAt` (when the phenomenon happened) is client-supplied but validated (present, valid date, not absurdly in the future); it is a scientific fact, not an ordering guarantee.

### Timestamp semantics (approved decision)

| Timestamp | Managed by | Meaning | Use |
| --------- | ---------- | ------- | --- |
| `observedAt` | Client-supplied, server-validated | When the real-world/scientific event occurred | **Scientific chronology**: display, filtering, scientific sorting |
| `createdAt` / `updatedAt` | Server (Firestore server timestamps) | Record creation / last modification | **Default pagination ordering, sync, and change tracking** — stable, manipulation-resistant |

**Cursor pagination rule (aligned with `API.md` §5.3):** a cursor always encodes the **same ordering fields as the query it paginates** — a Firestore cursor cannot span a different `ORDER BY` than its query.

* **Default lists (`sort=updated`):** order and page on `updatedAt DESC` — stable, manipulation-resistant; used for sync, change detection, and background processes.
* **Chronology views (`sort=observed`):** order and page on `observedAt DESC` with a deterministic tie-breaker (document ID) for equal timestamps. These cursors are **bound to the `sort=observed` choice** and are display-ordering cursors only — never used for sync or change detection.
* Cursors are opaque tokens bound to the query's sort/filter set; mixing sorts or filters between cursor pages is rejected (`API.md` §5). `observedAt` reflects user-asserted event time and may differ between records — which is exactly why `sort=observed` cursors are quarantined to display use.

---

# 17. Status Fields

| Entity | Field | Values | Notes |
| ------ | ----- | ------ | ----- |
| User | `accountStatus` | `active` \| `suspended` \| `deleted` | Server-managed |
| User | `role` | `user` \| `admin` | Server-managed |
| Project | `status` | `active` \| `archived` \| `completed` | |
| Observation | `status` | `draft` \| `observed` \| `analyzed` \| `archived` | `analyzed` set by backend when an analysis references it |
| Conversation | `status` | `active` \| `archived` | |
| ResearchTask | `status` | `suggested` \| `planned` \| `in_progress` \| `completed` \| `dismissed` | |

All status values are validated against these enums on write.

---

# 18. Indexing Strategy

Indexes exist to serve actual within-user queries (ADR-014). Single-field indexes are automatic; these composite indexes are required:

| Collection | Index | Serves |
| ---------- | ----- | ------ |
| `observations` | `projectId ASC, observedAt DESC` | Project observation lists |
| `observations` | `status ASC, observedAt DESC` | Status-filtered lists |
| `observations` | `tags ARRAY_CONTAINS, observedAt DESC` | Tag-filtered lists |
| `analyses` | `type ASC, createdAt DESC` | Analyses by kind |
| `researchTasks` | `status ASC, updatedAt DESC` | Task lists by status |
| `conversations` | — | `updatedAt DESC` (single-field) |
| `messages` | — | `sequence ASC` (single-field) |
| `observationSearch` | — | Retrieved by direct path; no composite needed |

Notes:

* The `observedAt DESC` composites serve **scientific-chronology views** (`sort=observed`): ordering *and* pagination both use `observedAt DESC` (plus a deterministic tie-breaker), per the cursor-pagination rule in §16. **Default lists (`sort=updated`)** order and page on `updatedAt DESC`; the two cursor flavors are never mixed (`API.md` §5.3).
* **No collectionGroup queries or indexes are required** — a direct benefit of the user-flat model (ADR-014).
* Additional composite indexes are added only when a real query requires them.

---

# 19. Deletion and Cascade Behavior

Deletion is always scoped to the authenticated user's own documents.

## Delete observation

```text
Delete users/{uid}/observations/{observationId}
  → delete versions/*
  → delete media/* metadata AND Cloud Storage objects
       users/{uid}/observations/{observationId}/*
  → delete users/{uid}/observationSearch/{observationId}
  → analyses in users/{uid}/analyses referencing this observation:
       RETAINED (approved decision — append-only historical record; never
       cascade-deleted). References become dangling; API/UI must handle a
       missing source gracefully. Retrieval no longer surfaces the deleted
       observation from the live index.
```

## Delete project

```text
Delete users/{uid}/projects/{projectId}
  → observations with projectId == deleted: set projectId = null ("unfiled")
  → conversations / researchTasks with projectId == deleted: set projectId = null
  → analyses with projectId == deleted: RETAINED unchanged (ADR-021 — analyses are
       append-only historical records and are never mutated by project deletion;
       the dangling projectId is rendered as "deleted project", like dangling
       observation references)
  → Observations and other records are NOT deleted by project deletion.
```

## Delete conversation

```text
Delete users/{uid}/conversations/{conversationId}
  → delete messages/*
  → analyses with conversationId == deleted: RETAINED (same rationale).
```

## Delete media

```text
Delete users/{uid}/observations/{obsId}/media/{mediaId}
  → delete Cloud Storage object
  → decrement observation.mediaCount
```

## Account deletion

Cleanup must cover the entire tree and storage namespace:

```text
users/{uid}
users/{uid}/projects/*
users/{uid}/observations/*  (including versions/*, media/*)
users/{uid}/conversations/* (including messages/*)
users/{uid}/analyses/*
users/{uid}/researchTasks/*
users/{uid}/observationSearch/*
gs://<bucket>/users/{uid}/**
Firebase Auth user record
```

**Firestore implementation requirement:** deleting a parent document does **not** automatically delete its subcollections — `delete users/{uid}` alone is insufficient. Account deletion must **recursively enumerate and delete every descendant document** (each list above) and the associated Cloud Storage objects, or use an equivalent recursive-delete mechanism. Deletion must not leave orphaned private data. If deletion is asynchronous, the process is communicated to the user.

---

# 20. Data Lifecycle

```text
Create → Active → Updated/versioned → Analyzed → Organized → Archived → Deleted
```

* Observations start as `draft` or `observed`; editing creates a version snapshot (when versions are enabled).
* Analysis generation is idempotent-safe: failures never lose user content; regeneration appends a new analysis.
* Archiving (observations, projects, conversations) hides content without deleting it.
* AI artifacts are never edited after creation; supersession is expressed by appending a newer analysis.
* Index documents follow the observation lifecycle exactly (§14).

---

# 21. Data Validation

All user-controlled data is validated server-side before persistence:

* String presence, length, and size limits (title, description, notes, message content).
* Enum membership for all `status`, `type`, `role`, `role`-like, `precision`, and `contextType` fields.
* Coordinate ranges for `location.latitude`/`longitude`.
* `measurements` array bounds and numeric values.
* ID format for `projectId`, `contextId`, and reference arrays.
* Rejection of unknown/unexpected fields.
* Timestamp sanity (`observedAt` present and plausible).

Frontend validation is for usability; backend validation is for security.

---

# 22. Privacy Principles

The database follows data-minimization principles. Store only what is required for journaling, research organization, conversation history, AI features, and reliability/debugging.

Never store:

* Passwords or authentication tokens.
* Gemini API keys or any server credentials.
* Firebase private credentials.
* Full request headers.
* Secrets of any kind in logs or documents.

Location data is stored only at the precision the user selected (`location.precision`); `"hidden"` means no displayable coordinates. Precise coordinates are not logged unnecessarily (see `SECURITY.md` §14).

---

# 23. Design Principles

1. **Firebase UID is the ownership boundary**; all private data lives beneath `users/{uid}`.
2. **Never trust client-provided ownership information**; `ownerId` is backend-set and immutable.
3. **Observation is the single fundamental record**; freeform journaling is an Observation with optional fields unpopulated (ADR-013).
4. **Projects organize, never gate** — `projectId` is optional everywhere (ADR-014).
5. **Derived data is clearly separated** from source-of-truth data and is never an authorization source (ADR-017).
6. **AI artifacts are append-only, provenance-stamped, and validated before persistence**; they never mutate user content — including when their referenced project is deleted (dangling `projectId` retained per ADR-021) (ADR-015, ADR-009, ADR-021).
7. **Media binaries live in observation-scoped Cloud Storage paths derived by the backend** (ADR-016).
8. **Use server timestamps for authoritative events.**
9. **Validate all data before persistence, server-side.**
10. **Minimize stored sensitive information** (including location precision).
11. **Design indexes around real access patterns; no collectionGroup queries under the flat model.**
12. **Schema extensions must preserve these boundaries.**