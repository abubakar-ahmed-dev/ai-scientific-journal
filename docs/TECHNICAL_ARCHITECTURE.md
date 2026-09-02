# Technical Architecture Document

## Personal Gemini Scientific Journal

**Document Version:** 1.0
**Status:** Architecture Baseline
**Application Type:** Secure AI-powered scientific journaling web application
**Primary Cloud:** Google Cloud
**Primary AI:** Gemini API
**Development Environment:** Google Antigravity
**AI Development/Prototyping Platform:** Google AI Studio
**Deployment Platform:** Google Cloud Run

---

# 1. Executive Summary

The Personal Gemini Scientific Journal is a secure, AI-assisted web application that allows authenticated users to record scientific observations, organize research projects, attach evidence and locations, interact with Gemini, and receive AI-generated summaries, hypotheses, insights, and research suggestions.

The application is intentionally designed to be more than a generic AI chat application.

Its core architecture separates:

* **User-authored scientific information**
* **Evidence and observations**
* **AI-generated interpretations**
* **Conversation history**
* **Search/RAG infrastructure**
* **Authentication and authorization**
* **Application infrastructure**

This separation improves security, reliability, explainability, and future extensibility.

The architecture follows four competition priorities:

| Judging Area     | Architectural Strategy                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Authenticity** | Scientific observations, evidence, projects, hypotheses, measurements, AI analysis, research tasks   |
| **Usability**    | Projects, search, timeline, maps, AI assistant, summaries, tags, autosave/recovery                   |
| **Stability**    | Layered architecture, validation, error handling, retry mechanisms, isolated AI processing           |
| **Security**     | Firebase Auth, Firestore Security Rules, backend authorization, IAM, Secret Manager, least privilege |

---

# 2. Architectural Goals

## Primary Goals

1. Build a genuinely useful scientific journaling application.
2. Provide secure multi-user data isolation.
3. Integrate Gemini as an intelligent research assistant rather than a simple chatbot.
4. Maintain a clear separation between observations and AI-generated claims.
5. Support location-aware scientific observations.
6. Support future RAG/retrieval capabilities.
7. Provide reliable behavior when external services fail.
8. Deploy using Google Cloud infrastructure.
9. Maintain a professional, maintainable codebase.
10. Make the architecture easy to demonstrate to hackathon judges.

---

# 3. Non-Goals

The first release will NOT attempt to become:

* A full laboratory information management system.
* A scientific publishing platform.
* A social network.
* A medical diagnostic system.
* A replacement for peer-reviewed scientific research.
* A complex multi-tenant enterprise SaaS platform.

The architecture should allow these capabilities in the future without making the initial implementation unnecessarily complicated.

---

# 4. High-Level Architecture

```text
                              ┌───────────────────┐
                              │       User        │
                              │     Browser       │
                              └─────────┬─────────┘
                                        │
                                        │ HTTPS
                                        ▼
                              ┌───────────────────┐
                              │   React Web App   │
                              │                   │
                              │ UI / State / UX   │
                              └─────────┬─────────┘
                                        │
                              Firebase Auth Token
                                        │
                                        ▼
                         ┌──────────────────────────┐
                         │       Cloud Run           │
                         │                          │
                         │ Node.js + TypeScript     │
                         │ Express API              │
                         │                          │
                         │ Authentication           │
                         │ Authorization            │
                         │ Validation               │
                         │ Business Logic           │
                         │ AI Orchestration         │
                         │ RAG Orchestration        │
                         └──────┬────────┬──────────┘
                                │        │
                   ┌────────────┘        └─────────────┐
                   ▼                                    ▼
          ┌────────────────┐                   ┌─────────────────┐
          │ Cloud Firestore│                   │   Gemini API    │
          │                │                   │                 │
          │ User Data      │                   │ AI Generation   │
          │ Observations   │                   │ Summarization   │
          │ Conversations  │                   │ Analysis        │
          │ Projects       │                   │ Reranking/etc.  │
          └────────────────┘                   └─────────────────┘
                   │                                    ▲
                   │                                    │
                   ▼                                    │
          ┌────────────────┐                   ┌─────────────────┐
          │ Cloud Storage  │                   │ Secret Manager  │
          │                │                   │                 │
          │ Images         │                   │ Gemini API Key  │
          │ Evidence       │                   │ External Keys   │
          └────────────────┘                   └─────────────────┘

                  ┌──────────────────────────────┐
                  │ Google Cloud IAM             │
                  │ Logging + Monitoring         │
                  └──────────────────────────────┘
```

---

# 5. Technology Stack

## 5.1 Frontend

| Technology               | Purpose                               |
| ------------------------ | ------------------------------------- |
| React                    | UI framework                          |
| TypeScript               | Type safety                           |
| Vite                     | Development/build tooling             |
| React Router             | Application routing                   |
| Firebase Web SDK         | Authentication                        |
| TanStack Query           | Server-state management/caching       |
| Zustand or Redux Toolkit | Local/global UI state where necessary |
| Tailwind CSS             | UI styling                            |
| shadcn/ui or equivalent  | Consistent UI components              |
| Zod                      | Client-side schema validation         |
| Leaflet / Google Maps    | Location visualization                |

### Frontend principle

The frontend is responsible for:

* Presentation
* User interaction
* Client-side validation
* Authentication state
* Optimistic UI where appropriate
* Error presentation

It is **not responsible for security decisions**.

---

# 5.2 Backend

| Technology                 | Purpose                                 |
| -------------------------- | --------------------------------------- |
| Node.js                    | Runtime                                 |
| TypeScript                 | Type safety                             |
| Express                    | HTTP API                                |
| Firebase Admin SDK         | Server-side authentication verification |
| Google Cloud Firestore SDK | Database access                         |
| Google Cloud Storage SDK   | Media storage                           |
| Gemini SDK                 | Gemini API integration                  |
| Zod                        | Request/response validation             |
| Pino                       | Structured logging                      |
| Helmet                     | HTTP security headers                   |
| CORS                       | Controlled cross-origin access          |
| Rate limiter               | Abuse protection                        |

---

# 5.3 Database

**Cloud Firestore**

Reasons:

* Native Google/Firebase ecosystem.
* Firebase Authentication integration.
* Security Rules.
* Horizontal scalability.
* Serverless operation.
* Suitable for user-centric document data.
* Strong fit with the competition requirements.

Firestore Security Rules can enforce authenticated user ownership, and Google explicitly recommends Firebase Authentication + Firestore Security Rules for securing web applications.

---

# 5.4 Authentication

**Firebase Authentication**

Initial provider:

```text
Google Sign-In
```

Firebase supports Google authentication directly through its web SDK.

Authentication responsibility:

```text
Firebase Auth
      ↓
Identity
      ↓
Firebase UID
      ↓
Backend authorization
```

---

# 5.5 AI

**Gemini API**

Gemini will be used for:

* Multi-turn conversations
* Summarization
* Observation analysis
* Hypothesis generation
* Research suggestions
* Question answering over personal journal data
* Classification/tag suggestions
* Optional semantic retrieval/reranking

The exact Gemini model should be configured through an application-level model configuration rather than hardcoded throughout the codebase.

Example:

```text
AI_MODEL=...
```

This allows the model to be changed without restructuring the application.

---

# 5.6 Cloud Infrastructure

| Google Cloud Service         | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| Cloud Run                    | Backend/web application deployment               |
| Cloud Firestore              | Primary database                                 |
| Cloud Storage                | User media/evidence                              |
| Secret Manager               | API keys/secrets                                 |
| IAM                          | Identity and access control                      |
| Cloud Logging                | Application logs                                 |
| Cloud Monitoring             | Metrics/alerts                                   |
| Artifact Registry            | Container images if using explicit Docker builds |
| Cloud Build / GitHub Actions | CI/CD                                            |
| Firebase Authentication      | User identity                                    |

Cloud Run is appropriate because the application can be packaged as a containerized service and deployed as a scalable managed service. Google AI Studio also supports deploying applications to Cloud Run.

---

# 6. Development Platform

## Google AI Studio

Google AI Studio is primarily used for:

* Gemini experimentation
* Initial application generation
* Prompt/model experimentation
* AI-assisted application building
* Testing Gemini integrations
* Security Custom Instructions
* Rapid prototyping

AI Studio's current Build environment can also provide a server-side Node.js runtime and server-side secret handling.

---

# 7. Antigravity

**Antigravity is the primary engineering environment.**

Use it for:

* Repository development
* Architecture implementation
* Refactoring
* Testing
* Debugging
* Security reviews
* Git operations
* CI/CD preparation
* Production hardening

The recommended relationship is:

```text
Google AI Studio
       │
       │ AI experimentation
       │ Gemini prototyping
       │ Security instructions
       ▼
Architecture / Prototype
       │
       ▼
Antigravity
       │
       │ production engineering
       ▼
GitHub
       │
       ▼
Cloud Run
```

The application should not become dependent on AI Studio for runtime execution.

---

# 8. Architectural Style

The application will use a **modular monolithic architecture**.

This is intentionally preferred over microservices for the hackathon.

```text
                 Cloud Run
                    │
          ┌─────────┴─────────┐
          │ Modular Monolith  │
          │                   │
          │ Auth              │
          │ Users             │
          │ Projects          │
          │ Observations      │
          │ Conversations     │
          │ AI                │
          │ RAG               │
          │ Media             │
          │ Research Tasks    │
          └───────────────────┘
```

### Why not microservices?

Microservices would introduce:

* More deployment complexity
* More networking
* More authentication boundaries
* More monitoring
* More failure points
* More development overhead

The project does not currently require them.

The code should be modular enough that individual modules can later be extracted if scale demands it.

---

# 9. Complete Project Structure

Recommended repository:

```text
scientific-gemini-journal/
│
├── frontend/
│   ├── public/
│   │   ├── favicon.ico
│   │   └── ...
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── router.tsx
│   │   │   └── providers.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── layout/
│   │   │   ├── common/
│   │   │   ├── journal/
│   │   │   ├── observations/
│   │   │   ├── ai/
│   │   │   └── map/
│   │   │
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ProjectsPage.tsx
│   │   │   ├── ProjectPage.tsx
│   │   │   ├── ObservationPage.tsx
│   │   │   ├── ResearchAssistantPage.tsx
│   │   │   ├── MapPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   │
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── projects/
│   │   │   ├── observations/
│   │   │   ├── conversations/
│   │   │   ├── ai/
│   │   │   ├── search/
│   │   │   ├── media/
│   │   │   └── location/
│   │   │
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── firebase.ts
│   │   │   ├── api.ts
│   │   │   └── queryClient.ts
│   │   │
│   │   ├── types/
│   │   ├── utils/
│   │   ├── constants/
│   │   └── styles/
│   │
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   ├── firebase.ts
│   │   │   └── gemini.ts
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── authorization.ts
│   │   │   ├── validation.ts
│   │   │   ├── errorHandler.ts
│   │   │   ├── rateLimit.ts
│   │   │   └── requestId.ts
│   │   │
│   │   ├── modules/
│   │   │   ├── users/
│   │   │   ├── projects/
│   │   │   ├── observations/
│   │   │   ├── conversations/
│   │   │   ├── ai/
│   │   │   ├── summaries/
│   │   │   ├── researchTasks/
│   │   │   ├── media/
│   │   │   └── search/
│   │   │
│   │   ├── services/
│   │   │   ├── firestore/
│   │   │   ├── gemini/
│   │   │   ├── storage/
│   │   │   ├── search/
│   │   │   └── location/
│   │   │
│   │   ├── ai/
│   │   │   ├── prompts/
│   │   │   ├── schemas/
│   │   │   ├── pipelines/
│   │   │   ├── evaluators/
│   │   │   └── reranking/
│   │   │
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── app.ts
│   │   └── server.ts
│   │
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── security/
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── firebase/
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── firebase.json
│
├── infrastructure/
│   ├── cloud-run/
│   ├── iam/
│   ├── secrets/
│   └── monitoring/
│
├── docs/
│   ├── PRD.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── SECURITY.md
│   ├── DATABASE_SCHEMA.md
│   ├── API.md
│   ├── AI_ARCHITECTURE.md
│   ├── DEPLOYMENT.md
│   └── ADR/
│
├── scripts/
│   ├── seed.ts
│   ├── validate-env.ts
│   └── smoke-test.ts
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── README.md
└── CLAUDE.md
```

---

# 10. Why Separate Frontend and Backend?

The frontend should never directly contain privileged Gemini operations.

Recommended:

```text
Frontend
    ↓
Backend API
    ↓
Gemini
```

rather than:

```text
Frontend
    ↓
Gemini API
```

This protects the Gemini credential and allows the backend to perform:

* Authentication
* Authorization
* Prompt construction
* RAG
* Validation
* Rate limiting
* AI evaluation
* Logging
* Cost controls

Google AI Studio's current full-stack environment similarly supports server-side Gemini calls and server-side secrets rather than exposing the key in browser code.

---

# 11. Database Architecture

## Database

**Cloud Firestore**

Primary hierarchy:

```text
users/{uid}
│
├── projects/{projectId}                     ← optional organizational layer (ADR-014)
│
├── observations/{observationId}             ← fundamental user-created record (ADR-013)
│   ├── versions/{versionId}
│   └── media/{mediaId}
│
├── conversations/{conversationId}           ← user-level; optional projectId + contextType/contextId
│   └── messages/{messageId}
│
├── analyses/{analysisId}                    ← ALL AI-generated structured outputs (ADR-015)
│
├── researchTasks/{taskId}                   ← user-level; optional projectId
│
└── observationSearch/{observationId}        ← DERIVED RAG index — not a source of truth (ADR-017)
```

This hierarchy aligns private data with the authenticated user: **every** user-owned resource — canonical and derived — lives beneath `users/{uid}` (ADR-014, ADR-017). Observations are user-flat; `projectId` is an optional field, never a path requirement. The full field-level schema is the canonical `DATABASE_SCHEMA.md`; preferences are stored inline on the user document (no separate settings document).

---

# 12. User Schema

```text
users/{uid}
```

> **Scope note:** Entity schemas in this document (§12–§23) are informative summaries. The canonical, field-level definitions — including required/optional semantics and validation — are in `DATABASE_SCHEMA.md`. Where the two differ, `DATABASE_SCHEMA.md` and the ADRs prevail.

```typescript
interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt?: Timestamp;

  role: "user" | "admin";

  preferences: {
    theme: "light" | "dark" | "system";
    timezone: string;
    locationEnabled: boolean;
    aiSuggestionsEnabled: boolean;
  };

  accountStatus: "active" | "suspended" | "deleted";
}
```

### Security

`uid` is derived from Firebase Authentication.

The client must never be allowed to change:

```text
uid
role
accountStatus
createdAt
```

---

# 13. Project Schema

```text
users/{uid}/projects/{projectId}
```

```typescript
interface Project {
  id: string;
  ownerId: string;

  title: string;
  description?: string;

  field?: string;

  status: "active" | "archived" | "completed";

  tags: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt?: Timestamp;
}
```

A project provides an **optional** organizational layer for research (**ADR-014**): it groups observations, conversations, analyses, and research tasks, but is **never a mandatory parent** — every one of those entities may have `projectId: null`. Project deletion re-files affected records (`projectId = null`); it never deletes them.

Example:

```text
Project:
"Urban Bird Behavior Study"

    Observation 1        ← projectId reference, NOT path-nested
    Observation 2        ← (may also be unfiled / belong elsewhere)
    Observation 3

    Gemini conversations
    AI analyses
    Research tasks
```

---

# 14. Observation Schema

This is the most important domain entity — and the **fundamental user-created record** (**ADR-013**): it may represent a scientific observation, field note, measurement record, hypothesis-related note, or an ordinary personal journal entry, with the scientific fields simply left unpopulated.

Observations are **user-flat** (**ADR-014**):

```text
users/{uid}/observations/{observationId}
```

```typescript
interface Observation {
  id: string;
  ownerId: string;
  projectId: string | null;   // optional project association (ADR-014); null = unfiled

  title: string;
  description: string;
  notes?: string;

  observedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    label?: string;
    precision: "exact" | "approximate" | "hidden";
  };

  tags: string[];

  hypothesis?: string;

  status:
    | "draft"
    | "observed"
    | "analyzed"
    | "archived";

  measurements: Measurement[];   // embedded; may be empty

  mediaCount: number;

  version: number;
}
```

`observedAt` records when the real-world event occurred (client-supplied, server-validated); `createdAt`/`updatedAt` are server-managed and drive cursor pagination and change tracking. `status: "analyzed"` is a backend-set convenience flag — the only write-back AI features ever perform on an observation.

---

# 15. Measurement Schema

```typescript
interface Measurement {
  id: string;

  name: string;
  value: number;
  unit: string;

  observedAt?: Timestamp;

  notes?: string;
}
```

This avoids forcing scientific measurements into unstructured text.

Measurements are **user-authored data**. AI-generated values must never be written into this array — AI interpretation belongs in `analyses` (§20).

Example:

```text
temperature = 27.4 °C
humidity = 63 %
distance = 14.2 m
```

---

# 16. Observation Version Schema

```text
users/{uid}/observations/{observationId}/versions/{versionId}
```

```typescript
interface ObservationVersion {
  id: string;
  version: number;

  title: string;
  description: string;

  hypothesis?: string;
  measurements?: Measurement[];

  editedAt: Timestamp;
  editedBy: string;

  changeReason?: string;
}
```

This provides lightweight provenance and protects the integrity of the original scientific record (**ADR-016**). Versions are immutable snapshots created internally as a **consequence of editing** — never arbitrary client-created resources. Ownership is path-inherited from the parent observation (no `ownerId` on versions; `editedBy` identifies the actor). Implementation may be deferred until observation editing ships; the schema is fixed now to avoid later migration.

---

# 17. Media Schema

```text
users/{uid}/observations/{observationId}/media/{mediaId}
```

```typescript
interface Media {
  id: string;

  ownerId: string;
  observationId: string;

  type: "image" | "audio" | "video";
  storagePath: string;

  fileName: string;
  mimeType: string;
  sizeBytes: number;

  caption?: string;

  createdAt: Timestamp;
}
```

Actual files reside in private Cloud Storage (**ADR-016**); Firestore stores metadata rather than the binary file itself. The **backend derives all storage paths** (`users/{uid}/observations/{observationId}/{mediaId}`); clients never choose, see, or transmit paths, and raw storage objects are never publicly exposed — binary access flows through backend-authorized read URLs. The concrete storage client (Firebase Storage SDK vs Cloud Storage SDK) is an implementation detail deferred to the media phase (**ADR-020**).

---

# 18. Conversation Schema

```text
users/{uid}/conversations/{conversationId}
```

```typescript
interface Conversation {
  id: string;

  ownerId: string;
  projectId: string;

  title?: string;

  contextType:
    | "general"
    | "observation"
    | "project"
    | "research";

  contextId?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;

  messageCount: number;

  status: "active" | "archived";
}
```

---

# 19. Message Schema

```text
users/{uid}/conversations/{conversationId}/messages/{messageId}
```

```typescript
interface Message {
  id: string;

  ownerId: string;
  conversationId: string;

  role: "user" | "assistant" | "system";

  content: string;

  createdAt: Timestamp;

  model?: string;

  metadata?: {
    latencyMs?: number;
    tokenUsage?: number;
    sourceCount?: number;
  };
}
```

---

# 20. AI Analysis Schema

AI analysis must remain separate from the original observation.

```text
users/{uid}/analyses/{analysisId}
```

This is the **single** collection for all persisted AI-generated structured outputs (**ADR-015**). The earlier separate `summaries` collection (former §21) has been **merged into this schema** — `type: "summary"` (with `openQuestions[]` absorbed below) covers it — and the never-defined `insights` collection no longer exists. Design rules:

* **Append-only** — regeneration creates a new analysis; nothing is overwritten.
* **Never cascade-deleted with sources** — an analysis may reference a deleted observation (dangling `observationIds[]`); consumers resolve existence via the canonical observations data and render missing sources gracefully.
* Persisted only after parse → schema validation → application validation (ADR-009).
* **AI outputs never mutate user-authored content.**

```typescript
interface AIAnalysis {
  id: string;

  ownerId: string;
  projectId: string | null;
  observationIds: string[];      // source observations (soft references — may dangle)
  conversationId: string | null; // source conversation, when applicable

  type:
    | "summary"
    | "analysis"
    | "hypothesis"
    | "classification"
    | "research_suggestions";

  summary: string;

  keyFindings: string[];

  hypotheses: {
    statement: string;
    confidence?: "low" | "medium" | "high";
    supportingObservationIds: string[];
  }[];

  uncertainties: string[];

  suggestedQuestions: string[];

  openQuestions: string[];       // absorbed from the former summaries schema

  suggestedNextSteps: string[];

  model: string;
  promptVersion: string;

  createdAt: Timestamp;
}
```

This creates a clear distinction:

```text
User observation
       ≠
AI interpretation
```

This is important for scientific credibility.

---

# 21. Summary Schema *(merged — see §20)*

The former standalone `summaries` collection was **eliminated** by **ADR-015**. A conversation- or observation-sourced summary is an analysis with `type: "summary"` in the single `analyses` collection (§20), with `openQuestions[]` absorbed into that schema. There is no separate summaries entity, and the formerly listed `insights` collection never had a defined schema and no longer appears in the model.

---

# 22. Research Task Schema

This makes the AI assistant more useful than a chatbot.

```text
users/{uid}/researchTasks/{taskId}
```

Tasks are user-level (**ADR-014**), with an optional `projectId` and `relatedObservationIds[]` references. **AI never autonomously creates tasks**: a `source: "gemini"` task exists only after the user explicitly accepts a suggestion from an analysis's `suggestedNextSteps[]` (the analysis ID is recorded as provenance).

```typescript
interface ResearchTask {
  id: string;

  ownerId: string;
  projectId: string;

  title: string;
  description: string;

  source: "user" | "gemini";

  status:
    | "suggested"
    | "planned"
    | "in_progress"
    | "completed"
    | "dismissed";

  relatedObservationIds: string[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Example:

```text
Gemini:
"Your observations suggest a possible relationship
between temperature and bird activity."

Suggested task:
"Record bird activity at three different temperatures."
```

This is a strong authenticity/usability feature.

---

# 23. Search / RAG Architecture

The canonical Firestore data remains the source of truth.

A **derived, user-scoped** search representation is maintained (**ADR-017**):

```text
users/{uid}/observationSearch/{observationId}
```

```typescript
interface ObservationSearchDocument {
  observationId: string;
  ownerId: string;

  searchableText: string;

  embeddingReference?: string;

  embeddingVersion?: string;

  indexedAt: Timestamp;
  updatedAt: Timestamp;
}
```

Lifecycle: the index document is written/updated when the observation is written and **deleted with the observation** — preventing stale-index retrieval. Retrieval queries this subcollection **by user path only**; retrieved content is always treated as untrusted prompt input. Conversations/messages are out of retrieval scope initially.

Important:

> Search/index data is **derived data**: it is never a source of truth for application data and never a source of truth for authorization.

The authoritative ownership information remains in the application's canonical data model. If index and observation disagree, the observation wins and the index is rebuilt. A root-level search collection was considered and rejected (ADR-017) — it would create a second top-level ownership domain with weaker field-based rules for no query benefit.

---

# 24. AI Pipeline

Gemini calls should follow a controlled pipeline.

```text
User Request
     │
     ▼
Authentication
     │
     ▼
Authorization
     │
     ▼
Input Validation
     │
     ▼
Intent Detection
     │
     ▼
Retrieve user's authorized context
     │
     ▼
Filtering
     │
     ▼
Ranking / Reranking
     │
     ▼
Prompt Construction
     │
     ▼
Gemini
     │
     ▼
Output Schema Validation
     │
     ▼
AI Evaluation / Guardrails
     │
     ▼
Persistence
     │
     ▼
User
```

---

# 25. RAG Security

The RAG pipeline must always start with:

```text
authenticated UID
```

and retrieve only:

```text
documents owned by authenticated UID
```

Never:

```text
retrieve globally
       ↓
filter afterward
```

Prefer:

```text
UID-scoped retrieval
       ↓
ranking
       ↓
Gemini
```

Firestore Security Rules are not filters; queries must themselves satisfy the security constraints.

---

# 26. AI Evaluation

The application should not blindly trust Gemini output.

For important AI features, evaluate:

### Relevance

Does the answer address the question?

### Groundedness

Is the answer supported by retrieved observations?

### Citation/source coverage

Does the answer identify supporting observations?

### Consistency

Does it contradict known user observations?

### Structured validity

Does generated structured data match the expected schema?

### Safety

Does the response contain dangerous or inappropriate instructions?

---

# 27. AI Response Structure

For research-oriented responses, prefer:

```text
Answer

Evidence
- Observation A
- Observation B

Interpretation
- Possible explanation

Uncertainty
- What is not known

Suggested next steps
- Experiment/question
```

This is much stronger than returning an unqualified paragraph generated by Gemini.

---

# 28. API Architecture

Base URLs:

```text
/api/v1       ← all business endpoints (ADR-018)
/api/health   ← health check, intentionally unversioned (liveness probes)
```

## Authentication

Authentication is primarily handled by Firebase.

Backend receives:

```text
Authorization: Bearer <Firebase ID Token>
```

The authenticated UID is derived from the **verified token only** — never from client-supplied fields. The complete endpoint specification (routes, validation, pagination, error contract, rate limits, idempotency) is the canonical `API.md`; the sections below are an informative summary.

---

# 29. Project APIs

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:projectId
PATCH  /api/v1/projects/:projectId
DELETE /api/v1/projects/:projectId
```

---

# 30. Observation APIs

Observations are user-flat (**ADR-014**) — project scoping is a query parameter, never a path segment:

```text
GET    /api/v1/observations?projectId=&status=&tag=&sort=&limit=&cursor=
POST   /api/v1/observations

GET    /api/v1/observations/:observationId
PATCH  /api/v1/observations/:observationId
DELETE /api/v1/observations/:observationId

GET    /api/v1/observations/:observationId/versions[/:versionId]     ← read-only (when versioning ships)

POST   /api/v1/observations/:observationId/media
GET|DELETE /api/v1/observations/:observationId/media/:mediaId
```

---

# 31. AI APIs

Stateful chat is **not** an AI endpoint — it is conversation messaging (§32). `/ai/chat` does not exist (ADR-018):

```text
POST /api/v1/ai/summarize
POST /api/v1/ai/analyze
POST /api/v1/ai/suggest-research
POST /api/v1/ai/ask          ← grounded Q&A over the user's own observations (PRD FR-16)
POST /api/v1/ai/search       ← retrieval-only (PRD FR-17; no generation)
```

Every endpoint:

```text
Authenticate
→ Authorize
→ Validate
→ Execute
→ Validate AI output
→ Return
```

---

# 32. Conversation APIs

`POST /conversations/:id/messages` is the **single stateful chat surface** — the user message and the Gemini response are both persisted through the conversation pipeline (ADR-018):

```text
GET  /api/v1/conversations
POST /api/v1/conversations

GET  /api/v1/conversations/:id
PATCH /api/v1/conversations/:id          ← title / archive status only

GET  /api/v1/conversations/:id/messages
POST /api/v1/conversations/:id/messages  ← stateful chat

DELETE /api/v1/conversations/:id
```

Additionally (closed API gaps; full specs in `API.md`):

```text
GET  /api/v1/analyses                    ← list/read AI outputs (no client POST — creation only via /ai/*)
GET  /api/v1/research-tasks              ← + POST (incl. AI-suggestion acceptance), PATCH, DELETE
GET|PATCH /api/v1/me
GET|POST /api/v1/projects …
```

---

# 33. Media APIs

```text
POST   /api/v1/observations/:id/media
GET    /api/v1/observations/:id/media/:mediaId     ← metadata + short-lived authorized read URL
DELETE /api/v1/observations/:id/media/:mediaId
```

A globally-scoped `/media/:mediaId` resource deliberately does not exist — media access is observation-scoped, and raw storage objects are never publicly exposed.

The backend determines the authorized storage path.

The client cannot arbitrarily select another user's storage path.

---

# 34. API Response Format

Success:

```json
{
  "data": {},
  "meta": {}
}
```

Error:

```json
{
  "error": {
    "code": "OBSERVATION_NOT_FOUND",
    "message": "The requested observation could not be found.",
    "requestId": "req_123"
  }
}
```

Never expose:

* Stack traces
* API keys
* Database errors
* Internal file paths
* Provider credentials

---

# 35. Firestore Security Architecture

Firestore rules enforce the client-side database boundary.

Conceptually:

```text
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null
                     && request.auth.uid == uid;
}
```

with per-collection field validation: immutable backend-set `ownerId`, enum checks, length caps, and — when an optional `projectId` is non-null — a `get()` verification that the referenced project exists under the same `uid` (**ADR-014**). Firestore Security Rules support conditions based on `request.auth.uid` and document ownership.

The user-flat hierarchy makes these rules simple and path-based: no collectionGroup rules or indexes are required, and derived data (`observationSearch`) is covered by the same UID-subtree match.

---

# 36. Backend vs Firestore Security

Both layers are required.

```text
Browser
   ↓
Backend authorization
   ↓
Firestore
   ↓
Firestore Rules
```

The backend must not assume:

> "The frontend already checked ownership."

Likewise, the database must not rely solely on backend code where direct client access is permitted.

---

# 37. Important Firestore Architecture Decision

There are two possible data-access patterns.

### Pattern A

```text
React
 ↓
Firestore directly
```

### Pattern B

```text
React
 ↓
Cloud Run
 ↓
Firestore
```

For this project, use:

> **Pattern B for privileged/business operations.**

This gives us a central place for:

* AI orchestration
* authorization
* validation
* rate limiting
* business rules
* audit behavior
* external API integration

Firebase Authentication remains the identity provider.

Firestore Security Rules remain an additional defense layer.

---

# 38. Secret Management

Secrets:

```text
GEMINI_API_KEY
```

and any future external service keys must be stored server-side.

Google Cloud Secret Manager is designed for storing API keys, passwords, certificates and other sensitive values.

Architecture:

```text
Cloud Run Service Account
        │
        │ IAM permission
        ▼
Secret Manager
        │
        ▼
Runtime Secret
        │
        ▼
Gemini Client
```

The secret must never be included in:

```text
React bundle
Git repository
Firestore
localStorage
URL
logs
```

---

# 39. IAM Architecture

Use separate service identities where practical.

Example:

```text
Cloud Run Runtime Service Account
```

Permissions:

* Firestore access
* Secret Manager secret access
* Cloud Storage access
* Required Google APIs only

Avoid broad roles such as:

```text
Owner
Editor
```

for runtime services.

---

# 40. Storage Architecture

Cloud Storage:

```text
gs://bucket/
    users/
        {uid}/
            observations/
                {observationId}/
                    {mediaId}
```

Paths are **backend-derived** and private; clients never select or receive raw object paths (§17).

Security boundary:

```text
authenticated UID
      ↓
users/{uid}/...
```

Users may only access their own media.

---

# 41. Docker Architecture

Use Docker for reproducible production deployment.

Example:

```text
Dockerfile
```

The production image should:

* Use a small Node.js base image.
* Install production dependencies only.
* Run as a non-root user where practical.
* Avoid secrets in build arguments.
* Expose only required ports.
* Use environment/runtime secrets.

Docker is not mandatory for local frontend development, but it is valuable for a professional Cloud Run deployment.

---

# 42. Deployment Architecture

```text
Developer
    │
    ▼
Antigravity
    │
    ▼
GitHub
    │
    ▼
CI
 ┌──┴────────────────┐
 │                   │
Tests              Security
 │                   │
 └────────┬──────────┘
          ▼
      Docker Build
          │
          ▼
   Artifact Registry
          │
          ▼
      Cloud Run
          │
          ▼
 Production
```

---

# 43. Environment Strategy

Use:

```text
development
staging
production
```

At minimum, production secrets must never be copied into source control.

Example:

```text
.env.example
```

contains:

```text
GEMINI_API_KEY=
GOOGLE_CLOUD_PROJECT_ID=
FIREBASE_PROJECT_ID=
```

but never actual values.

---

# 44. Configuration

Centralize environment configuration:

```text
backend/src/config/env.ts
```

Validate configuration during startup.

If a required secret is missing:

```text
Application startup
      ↓
Configuration validation
      ↓
Missing required variable
      ↓
FAIL FAST
```

Do not start a partially configured production application.

---

# 45. Error Handling

All backend errors pass through:

```text
errorHandler.ts
```

Categories:

```text
AuthenticationError
AuthorizationError
ValidationError
NotFoundError
ConflictError
RateLimitError
AIServiceError
DatabaseError
StorageError
ExternalServiceError
InternalServerError
```

The API returns safe, standardized errors.

---

# 46. Reliability Strategy

### Gemini unavailable

The user's observation should still be saved.

```text
Save observation
      ↓
Attempt AI analysis
      ↓
Gemini failure
      ↓
Observation remains safe
      ↓
Retry later
```

### Firestore unavailable

Do not pretend the data was saved.

Display:

> "We couldn't save your observation. Please try again."

Preserve the user's input where possible.

---

# 47. Idempotency

Important write operations should consider duplicate requests.

Example:

```text
User clicks Save twice
```

The system should not accidentally create:

```text
Observation A
Observation A duplicate
```

Possible strategy:

```text
clientOperationId
```

combined with backend duplicate detection.

---

# 48. Caching

Do not aggressively cache private user data in shared infrastructure.

Safe caching candidates:

* Static assets
* Public application configuration
* Public metadata

Potentially cache:

* AI model configuration
* Non-sensitive reference data

Avoid shared caches containing:

```text
private journal content
private observations
private AI conversations
```

---

# 49. Rate Limiting

Rate-limit expensive operations:

```text
POST /api/v1/conversations/:id/messages      ← stateful chat
POST /api/v1/ai/summarize | analyze | suggest-research | ask | search
POST /api/v1/observations/:id/media
```

This protects:

* Cost
* Availability
* Gemini quota
* Abuse resistance

---

# 50. Observability

Use:

**Cloud Logging**

for structured application logs.

Use:

**Cloud Monitoring**

for:

* Request latency
* Error rate
* Cloud Run health
* Request volume
* AI failure rate

Important metrics:

```text
request_count
error_rate
p95_latency
gemini_latency
gemini_error_rate
firestore_error_rate
auth_failure_count
rate_limit_count
```

---

# 51. Logging Rules

Never log:

```text
Gemini API keys
Firebase tokens
Passwords
Private journal content
Full AI prompts
Full AI responses
Precise location unnecessarily
```

Use:

```text
requestId
userId
endpoint
status
latency
errorCode
timestamp
```

---

# 52. Frontend State Architecture

Separate:

### Server state

Use TanStack Query for:

* Projects
* Observations
* Conversations
* AI results

### UI state

Use lightweight state management for:

* Sidebar
* Modals
* Theme
* Temporary UI preferences

### Authentication state

Firebase Authentication remains the source of truth.

---

# 53. User Workflow

Primary workflow:

```text
Landing
   ↓
Google Sign-In
   ↓
Dashboard
   ↓
Create Project        ← optional (ADR-014): may be skipped entirely
   ↓
Create Observation    ← always available; may be unfiled
   ↓
Add evidence/location
   ↓
Save
   ↓
Gemini Analysis
   ↓
Review AI Findings
   ↓
Ask Follow-up Questions
   ↓
Generate Research Tasks
   ↓
Continue Research
```

This creates a meaningful product loop:

```text
Observe
   ↓
Record
   ↓
Analyze
   ↓
Question
   ↓
Discover
   ↓
Investigate
   ↓
Record again
```

This loop is a major authenticity differentiator.

---

# 54. UX Architecture

Important UI states must be explicitly designed.

Every major feature should support:

```text
Loading
Empty
Success
Error
Retry
Unauthorized
Offline/network failure
```

Example:

### Observation page

```text
Loading observation
      ↓
Observation loaded
      ↓
Edit
      ↓
Saving...
      ↓
Saved
```

If saving fails:

```text
Saving...
      ↓
Failed
      ↓
Retry
```

---

# 55. Accessibility

The application should support:

* Keyboard navigation
* Proper semantic HTML
* Visible focus states
* Accessible form labels
* Sufficient contrast
* Screen-reader-friendly controls
* Accessible map alternatives

Location/map functionality should not make the application unusable for users who cannot use a map.

---

# 56. Search Architecture

Search should eventually support:

```text
Keyword search
+
Filters
+
Semantic search
+
Reranking
```

Example:

```text
"observations where temperature increased
and bird activity was high"
```

Pipeline:

```text
Query
 ↓
Query understanding
 ↓
UID-scoped retrieval
 ↓
Keyword/semantic retrieval
 ↓
Reranking
 ↓
Relevant observations
 ↓
Gemini
```

---

# 57. Data Lifecycle

```text
Create
  ↓
Active
  ↓
Updated/versioned
  ↓
Analyzed
  ↓
Archived
  ↓
Deleted
```

AI-generated artifacts should reference source observations rather than duplicating their entire contents unnecessarily.

---

# 58. Data Ownership

Every user-generated resource should have:

```text
ownerId
```

Examples:

```text
Project.ownerId
Observation.ownerId
Media.ownerId
Conversation.ownerId
Message.ownerId
Analysis.ownerId
Summary.ownerId
ResearchTask.ownerId
```

The owner is always derived from Firebase Authentication.

---

# 59. Security Boundary

The fundamental invariant is:

```text
Authenticated UID
        =
Resource ownerId
```

unless an explicitly authorized administrative capability applies.

Firestore's security model supports owner-based access using `request.auth.uid`, while updates can also prevent ownership from being changed.

---

# 60. Testing Architecture

Testing layers:

```text
Unit Tests
    ↓
Integration Tests
    ↓
Security Tests
    ↓
API Tests
    ↓
AI Evaluation
    ↓
E2E Tests
    ↓
Production Smoke Test
```

---

# 61. Unit Tests

Test:

* Validation
* AI prompt builders
* RAG ranking
* Data transformations
* Permission functions
* Error mapping
* Utility functions

---

# 62. Integration Tests

Test:

* Firebase authentication verification
* Firestore operations
* API endpoints
* Gemini integration
* Storage integration

---

# 63. Security Tests

Critical scenarios:

```text
User A → User A resource ✓

User A → User B resource ✕

User A → modify User B ✕

User A → delete User B ✕

Unauthenticated → private API ✕

Client changes ownerId ✕

Client changes role ✕

Client accesses another user's media ✕
```

---

# 64. Firestore Rules Testing

Security Rules must be tested automatically before deployment.

Firestore Rules are not merely frontend filtering; queries must be compatible with the rules because Firestore evaluates whether the potential result set is authorized.

Test:

* authenticated access
* unauthenticated access
* owner access
* non-owner access
* ownership modification
* invalid writes
* admin access if introduced

---

# 65. AI Evaluation Testing

Maintain a small evaluation dataset.

Example:

```text
Question
Expected relevant observations
Expected answer characteristics
Forbidden claims
```

Evaluate:

* Retrieval relevance
* Groundedness
* Hallucination
* Citation/source correctness
* Response structure
* Prompt injection resistance

---

# 66. End-to-End Testing

Important journey:

```text
Open application
 ↓
Sign in
 ↓
Create project
 ↓
Create observation
 ↓
Attach location
 ↓
Upload evidence
 ↓
Save
 ↓
Ask Gemini
 ↓
Receive analysis
 ↓
View evidence
 ↓
Create research task
 ↓
Logout
 ↓
Login again
 ↓
Verify persistence
```

---

# 67. CI/CD

Every pull request should run:

```text
Install
 ↓
Lint
 ↓
Typecheck
 ↓
Unit Tests
 ↓
Integration Tests
 ↓
Security Tests
 ↓
Build
```

Production deployment should happen only after successful checks.

---

# 68. Git Strategy

Recommended:

```text
main
```

= production-ready

Feature branches:

```text
feature/observations
feature/ai-analysis
feature/rag
feature/location
```

Only tested changes should reach `main`.

---

# 69. Documentation

Repository must contain:

```text
README.md
docs/
 ├── PRD.md
 ├── TECHNICAL_ARCHITECTURE.md
 ├── SECURITY.md
 ├── DATABASE_SCHEMA.md
 ├── API.md
 ├── AI_ARCHITECTURE.md
 └── DEPLOYMENT.md
```

README must explain:

* Product
* Architecture
* Features
* Local setup
* Environment variables
* Firebase setup
* Firestore setup
* Google Cloud setup
* Secret configuration
* Deployment
* Security rules
* Testing
* AI architecture

This directly supports the competition requirement for a repository with deployment instructions and security configuration.

---

# 70. Architecture Decision Records

Architectural decisions are documented in the single canonical record:

```text
docs/ADR.md
```

ADR-001…ADR-012 record the founding decisions; **ADR-013…ADR-020** record the 2026-09 documentation reconciliation (scientific domain model, user-flat observations with optional projects, unified `analyses`, observation-scoped versions/media, user-scoped derived search index, API v1 surface, naming/structure, deferred Maps/storage decisions). New decisions continue the numbering in that file; supersession follows the ADR Maintenance section there. This makes the repository look substantially more professional and demonstrates deliberate engineering decisions.

---

# 71. Scalability Strategy

The initial architecture should scale vertically and horizontally without redesign.

### Cloud Run

Can scale application instances.

### Firestore

Handles distributed document workloads.

### Cloud Storage

Handles media independently from Firestore.

### Gemini

AI processing remains an external managed service.

### Stateless backend

Cloud Run instances should not depend on local memory for persistent state.

```text
Instance A
Instance B
Instance C

      ↓

Shared Firestore
Shared Storage
Gemini
```

This allows multiple Cloud Run instances to serve the application.

---

# 72. Avoiding Stateful Cloud Run

Do not store important state in:

```text
local filesystem
process memory
in-memory sessions
```

Instead:

```text
Authentication → Firebase
Data → Firestore
Media → Cloud Storage
Secrets → Secret Manager
```

This makes Cloud Run instances replaceable.

---

# 73. Cost Control

AI is potentially the largest variable cost.

Implement:

* Request rate limits
* Input size limits
* Output token limits
* Appropriate model selection
* Avoid unnecessary repeated AI calls
* Cache reusable AI results where safe
* Monitor Gemini usage

Do not send the entire user's journal to Gemini for every request.

Use:

```text
retrieval
+
ranking
+
relevant context
```

instead.

---

# 74. Performance Strategy

Optimize:

### Frontend

* Code splitting
* Lazy-loaded routes
* Image optimization
* Query caching
* Pagination

### Backend

* Efficient Firestore queries
* Input limits
* Avoid unnecessary sequential calls
* Parallelize independent operations

### AI

* Retrieve only relevant context
* Limit prompt size
* Avoid redundant calls
* Use streaming where UX benefits

---

# 75. Pagination

Large collections must not be loaded completely.

Use cursor-based pagination:

```text
GET /observations?limit=20&cursor=...
```

Avoid:

```text
GET /observations
```

returning thousands of documents.

---

# 76. Firestore Index Strategy

Indexes should be created based on actual queries. Under the user-flat model (**ADR-014**) all indexes are **within-user composites** — no collectionGroup indexes are required. Likely indexes (canonical list in `DATABASE_SCHEMA.md` §18):

```text
observations
  projectId ASC + observedAt DESC      ← project lists (scientific ordering)

observations
  status ASC + observedAt DESC

observations
  tags ARRAY_CONTAINS + observedAt DESC

analyses
  type ASC + createdAt DESC

researchTasks
  status ASC + updatedAt DESC

conversations  → updatedAt DESC (single-field)
messages       → sequence ASC (single-field)
```

Cursor pagination uses stable server timestamps (`updatedAt`/`createdAt`/`sequence`); `observedAt DESC` composites serve scientific-chronology views. Do not create unnecessary indexes indiscriminately.

---

# 77. API Security Middleware Order

Recommended:

```text
Request ID
   ↓
Security Headers
   ↓
CORS
   ↓
Rate Limiting
   ↓
Authentication
   ↓
Authorization
   ↓
Validation
   ↓
Controller
   ↓
Service
   ↓
Repository
   ↓
Error Handler
```

---

# 78. Backend Layering

Use:

```text
Route
 ↓
Controller
 ↓
Service
 ↓
Repository
 ↓
Firestore
```

Example:

```text
observation.routes.ts
        ↓
observation.controller.ts
        ↓
observation.service.ts
        ↓
observation.repository.ts
        ↓
Firestore
```

This prevents business logic from being scattered throughout routes.

---

# 79. AI Layering

Use:

```text
AI Controller
      ↓
AI Service
      ↓
Context Builder
      ↓
Retriever
      ↓
Reranker
      ↓
Prompt Builder
      ↓
Gemini Client
      ↓
Output Validator
      ↓
AI Evaluator
```

This is much more professional than:

```text
route → Gemini.generateContent()
```

---

# 80. AI Prompt Management

Prompts should not be scattered throughout application code.

Use:

```text
backend/src/ai/prompts/
```

Example:

```text
journal-analysis.prompt.ts
summary.prompt.ts
research-assistant.prompt.ts
observation-classification.prompt.ts
```

Each important prompt should have a version:

```text
promptVersion: "observation-analysis-v2"
```

This makes AI behavior reproducible and auditable.

---

# 81. AI Model Configuration

Centralize:

```typescript
const AI_CONFIG = {
  analysisModel: "...",
  summaryModel: "...",
  chatModel: "...",
  maxOutputTokens: ...,
};
```

Do not hardcode model names across 20 files.

This allows future model upgrades without major refactoring.

---

# 82. External Integration Architecture

The **maps provider is deliberately deferred** (**ADR-020**) to the phase where map features (PRD FR-12/FR-13) are implemented; the domain model is unaffected — location remains an optional Observation field with a precision enum. When the provider is chosen (Google Maps Platform vs Leaflet), a new ADR records it, including the security note that a Maps JavaScript API key is public-but-restricted and must be documented in SECURITY.md.

If Google Maps is added:

```text
Frontend
   ↓
Location Service
   ↓
Google Maps API
```

If another external service is added:

```text
Feature
 ↓
Service abstraction
 ↓
External provider
```

External credentials must be stored securely.

Whenever a new external integration is added, update the security instructions and threat model before implementation.

---

# 83. Threat Model

Major threats:

| Threat                      | Mitigation                             |
| --------------------------- | -------------------------------------- |
| Cross-user data access      | UID ownership + Firestore Rules        |
| Stolen Firebase token       | Token verification + expiration        |
| API key exposure            | Secret Manager/server-side Gemini      |
| Prompt injection            | Treat user/retrieved text as untrusted |
| AI hallucination            | Evidence + uncertainty + evaluation    |
| Malicious upload            | Validation + private storage           |
| API abuse                   | Rate limiting                          |
| Data leakage through logs   | Sanitized structured logging           |
| Unauthorized admin access   | Least privilege + explicit RBAC        |
| Duplicate requests          | Idempotency                            |
| Data loss during AI failure | Persist source data independently      |
| Client manipulation         | Backend validation                     |
| Excessive AI cost           | Rate/token limits + monitoring         |

---

# 84. Security Invariants

The following statements must **always** remain true:

### Invariant 1

```text
A user can never read another user's private data.
```

### Invariant 2

```text
A client can never modify its own ownerId.
```

### Invariant 3

```text
A client can never modify its own role.
```

### Invariant 4

```text
Gemini can never bypass application authorization.
```

### Invariant 5

```text
Gemini API secrets are never exposed to the browser.
```

### Invariant 6

```text
AI-generated content can never directly execute privileged operations.
```

### Invariant 7

```text
AI failure cannot destroy the user's original observation.
```

---

# 85. Backup & Recovery

Firestore data and Cloud Storage should have an appropriate backup/recovery strategy before production launch.

At minimum:

* Document important backup strategy in deployment documentation.
* Avoid irreversible destructive operations without confirmation.
* Preserve observation versions where appropriate.
* Keep source observations independent from AI-generated artifacts.

For the hackathon, full enterprise disaster recovery is not necessary, but the architecture should not make recovery impossible.

---

# 86. Production Deployment Checklist

Before deployment:

### Application

* [ ] Production build succeeds.
* [ ] TypeScript passes.
* [ ] Lint passes.
* [ ] Unit tests pass.
* [ ] Integration tests pass.
* [ ] E2E smoke test passes.

### Authentication

* [ ] Google Sign-In works.
* [ ] Logout works.
* [ ] Expired tokens handled.
* [ ] Unauthorized requests rejected.

### Database

* [ ] Firestore rules deployed.
* [ ] Cross-user access tested.
* [ ] Required indexes deployed.
* [ ] Pagination implemented.

### AI

* [ ] Gemini server-side.
* [ ] Secrets protected.
* [ ] Prompt injection tests pass.
* [ ] Output validation works.
* [ ] AI failure handling works.

### Infrastructure

* [ ] Cloud Run deployed.
* [ ] Runtime service account configured.
* [ ] IAM reviewed.
* [ ] Secret Manager configured.
* [ ] HTTPS working.
* [ ] Logging enabled.
* [ ] Monitoring enabled.

### Repository

* [ ] No secrets committed.
* [ ] README complete.
* [ ] Security documentation included.
* [ ] Deployment documentation included.

---

# 87. Recommended Development Order

The implementation should follow dependency order.

## Phase 1 — Foundation

```text
Repository
TypeScript
React
Express
Docker
CI
Environment configuration
```

## Phase 2 — Security Foundation

```text
Firebase
Authentication
Backend token verification
Firestore
Security Rules
Secret Manager
IAM
```

## Phase 3 — Core Domain

```text
Users
Projects
Observations
Measurements
Media
```

## Phase 4 — Core AI

```text
Gemini client
Conversation
Summarization
Observation analysis
Structured output
```

## Phase 5 — Differentiation

```text
Location
Research tasks
Evidence-based AI
AI uncertainty
Research workflow
```

## Phase 6 — Advanced AI

```text
Embeddings
RAG
Retrieval
Reranking
AI evaluation
```

## Phase 7 — Production Hardening

```text
Rate limiting
Error handling
Monitoring
Performance
Security testing
E2E testing
```

## Phase 8 — Deployment

```text
Docker
Artifact Registry
Cloud Run
Production secrets
Smoke tests
GitHub
README
```

---

# 88. MVP Boundary

The minimum technically complete product is:

```text
Firebase Authentication
        +
Observations            ← the fundamental record; projects optional (ADR-014)
        +
Firestore
        +
Gemini conversations
        +
Automatic summaries     ← analyses with type: "summary" (ADR-015)
        +
Secure user isolation
        +
Cloud Run
        +
Secret Manager
```

This satisfies the competition's core architecture.

---

# 89. Differentiation Layer

The features that should make the project stand out are:

### 1. Scientific Observation Model

Not just "journal entries" — one fundamental record that spans freeform journaling and structured science (ADR-013), with projects as optional organization (ADR-014).

### 2. Evidence

Images/media attached to observations, observation-scoped, never publicly exposed.

### 3. Location

Location-aware observation recording; map rendering deferred per ADR-020.

### 4. Evidence-Grounded AI

Gemini explicitly identifies supporting observations.

### 5. Uncertainty

AI distinguishes facts, hypotheses, and uncertainty.

### 6. Research Tasks

AI turns observations into suggested next investigations.

### 7. RAG

Users can ask questions across their own research history.

### 8. Reranking

Retrieved observations are ranked before being sent to Gemini.

### 9. Provenance

AI analyses record:

```text
model
prompt version
source observations
timestamp
```

### 10. Security

Strong user isolation is demonstrable rather than merely claimed.

---

# 90. Architecture Success Criteria

The architecture is successful when:

## Authenticity

The application behaves like a real scientific research assistant rather than a generic Gemini wrapper.

## Usability

A user can move naturally through:

```text
Observe
→ Record
→ Organize
→ Analyze
→ Ask
→ Discover
→ Plan
→ Continue
```

## Stability

A failure in Gemini, Maps, Storage, or another external dependency does not unnecessarily destroy the user's work.

## Security

The application can demonstrate:

```text
User A
  ✕
User B's data

Browser
  ✕
Gemini secret

Gemini
  ✕
Authorization

Client
  ✕
Security rules

Runtime
  ✕
Unnecessary IAM privileges
```

---

# 91. Final Architecture

```text
                         ┌──────────────────────┐
                         │        USER          │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    React + Vite      │
                         │    TypeScript        │
                         └──────────┬───────────┘
                                    │
                         Firebase Authentication
                                    │
                              Firebase UID
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │          Cloud Run          │
                    │                             │
                    │       Node + TypeScript     │
                    │          Express             │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │ Authentication        │  │
                    │  │ Authorization         │  │
                    │  │ Validation            │  │
                    │  │ Rate Limiting         │  │
                    │  └───────────────────────┘  │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │ Domain Services       │  │
                    │  │ Projects              │  │
                    │  │ Observations          │  │
                    │  │ Conversations         │  │
                    │  │ Media                 │  │
                    │  └───────────────────────┘  │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │ AI Pipeline            │  │
                    │  │ Retrieval              │  │
                    │  │ Reranking              │  │
                    │  │ Prompting              │  │
                    │  │ Gemini                 │  │
                    │  │ Output Validation     │  │
                    │  │ Evaluation             │  │
                    │  └───────────────────────┘  │
                    └───────┬──────────┬──────────┘
                            │          │
                ┌───────────┘          └──────────────┐
                ▼                                      ▼
       ┌─────────────────┐                   ┌─────────────────┐
       │ Cloud Firestore │                   │   Gemini API    │
       │ (source of      │                   │                 │
       │  truth)         │                   │ Chat            │
       │ Users           │                   │ Analysis        │
       │ Projects        │                   │ Summaries       │
       │ Observations    │                   │ Suggestions     │
       │ Conversations   │                   └─────────────────┘
       │ Analyses (AI)   │
       │ ResearchTasks   │
       │ observationSearch│ ← derived index (not source of truth)
       └─────────────────┘
                │
                ▼
       ┌─────────────────┐
       │  Cloud Storage  │
       │                 │
       │ Research Media  │
       └─────────────────┘

       ┌────────────────────────────────────────────┐
       │              Security Layer                │
       │                                            │
       │ Firebase Auth                              │
       │ Firestore Security Rules                   │
       │ Google Cloud IAM                           │
       │ Secret Manager                             │
       │ Backend Authorization                      │
       │ Rate Limiting                              │
       └────────────────────────────────────────────┘

       ┌────────────────────────────────────────────┐
       │             Operations Layer               │
       │                                            │
       │ Cloud Logging                              │
       │ Cloud Monitoring                           │
       │ CI/CD                                      │
       │ Artifact Registry                          │
       │ Automated Tests                             │
       └────────────────────────────────────────────┘
```

---

# 92. Architectural Principle

The most important architectural decision for this project is:

> **Gemini is the intelligence layer, not the application architecture.**

The application owns:

```text
Identity
Authorization
Data
Scientific observations
Evidence
Retrieval
Validation
Security
Business rules
```

Gemini provides:

```text
Reasoning
Summarization
Classification
Hypothesis generation
Research suggestions
Natural-language interaction
```

This distinction prevents the application from becoming a thin "prompt → Gemini → response" demo and gives the project a credible production architecture.

---

# 93. Final Technology Decision Summary

| Area               | Decision                                                 |
| ------------------ | -------------------------------------------------------- |
| Application        | Scientific AI Journal                                    |
| Frontend           | React + TypeScript + Vite                                |
| Backend            | Node.js + TypeScript + Express                           |
| Authentication     | Firebase Authentication                                  |
| Database           | Cloud Firestore                                          |
| Media              | Cloud Storage                                            |
| AI                 | Gemini API                                               |
| AI orchestration   | Custom backend AI pipeline                               |
| RAG                | UID-scoped retrieval + reranking                         |
| Secrets            | Google Cloud Secret Manager                              |
| Runtime            | Cloud Run                                                |
| Containers         | Docker                                                   |
| Container registry | Artifact Registry                                        |
| IAM                | Google Cloud IAM                                         |
| Monitoring         | Cloud Monitoring                                         |
| Logging            | Cloud Logging                                            |
| Development        | Antigravity                                              |
| AI prototyping     | Google AI Studio                                         |
| Source control     | GitHub                                                   |
| CI/CD              | GitHub Actions / Cloud Build                             |
| Testing            | Vitest + integration + E2E + security tests              |
| API validation     | Zod                                                      |
| Styling            | Tailwind CSS                                             |
| Maps               | Google Maps or Leaflet, depending on final UX            |
| Architecture       | Modular monolith                                         |
| Data model         | User-scoped hierarchical Firestore                       |
| AI architecture    | Retrieval → reranking → Gemini → validation → evaluation |
| Security model     | Defense in depth + least privilege                       |

---

# 94. Architecture Status

### Locked Decisions

* React + TypeScript
* Node.js + TypeScript
* Firebase Authentication
* Google Sign-In
* Cloud Firestore
* Cloud Run
* Gemini API
* Secret Manager
* Cloud Storage
* Modular monolith
* User-scoped data
* Backend AI orchestration
* Server-side Gemini calls
* Docker-based production deployment

### Flexible Decisions

* Exact Gemini model
* Exact UI component library
* Maps provider — **explicitly deferred** to the map-feature phase (ADR-020)
* Storage client (Firebase Storage SDK vs Cloud Storage SDK) — deferred to the media phase (ADR-020)
* RAG implementation technology
* Embedding/vector infrastructure
* Exact CI/CD provider
* Advanced caching
* Admin functionality

These flexible decisions should be finalized when the corresponding feature is actually implemented rather than adding unnecessary infrastructure prematurely.

---

## Architectural North Star

The application should ultimately feel like:

> **"A secure personal scientific research workspace where Gemini helps you turn observations into structured knowledge and better questions."**

Not:

> **"A website with a Gemini chatbot and a database."**

That distinction should guide every subsequent implementation decision.
