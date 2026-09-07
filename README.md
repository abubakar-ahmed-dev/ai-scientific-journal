# AI Scientific Journal

> A secure, AI-powered scientific journal — record observations, converse with Gemini, and turn your personal observations into grounded analyses, hypotheses, and next investigations.

[![Google Cloud](https://img.shields.io/badge/Google%20Cloud-Cloud%20Run-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Gemini](https://img.shields.io/badge/AI-Gemini-8E75B2)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Auth-Firebase-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Firestore](https://img.shields.io/badge/Database-Firestore-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/docs/firestore)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**Status:** 🚧 In Development — built for the **Gen AI Academy APAC Edition** challenge (Cloud Run AI Challenge, label `dev-tutorial=cloud-run-ai-challenge`), deployed and usable.

---

## Overview

The AI Scientific Journal is a responsive web application for anyone who observes the world and wants their records to *work for them* — naturalists, citizen scientists, hobby researchers, students, or anyone keeping a personal journal of observations.

Generic journaling apps store text. The AI Scientific Journal turns a journal into a research companion:

* **One fundamental record — the Observation.** An Observation may be a structured scientific record (measurements, hypothesis, location, tags, evidence) or an ordinary freeform journal note; scientific fields are simply optional.
* **Conversational AI.** Multi-turn Gemini conversations help you reflect, brainstorm, and interpret what you've recorded.
* **Structured AI analyses.** Gemini produces validated, provenance-stamped analyses that explicitly separate observed facts, AI hypotheses, and uncertainty — and never overwrite what you wrote.
* **Ask My Journal.** Ask questions across your own research history and get answers grounded in your actual observations, with supporting evidence cited.
* **Research tasks.** Accept AI-suggested next investigations as trackable tasks.

Core product loop: **Observe → Record → Analyze → Organize → Discover → Investigate Further.**

The four design priorities:

> **Authenticity · Usability · Stability · Security**

AI is the intelligence layer — never the source of truth, never the authorization layer.

---

## Key Capabilities

* **Observations** — create, edit, list, archive, and delete structured records with optional measurements, hypothesis, tags, location (with user-controlled precision), and evidence media; optionally grouped into projects. Freeform journal notes are the same resource with the scientific fields unpopulated.
* **Projects (optional)** — organize observations, conversations, analyses, and tasks into research efforts; nothing requires a project, and deleting one re-files its records rather than deleting them (AI analyses retain their historical project reference — never mutated).
* **Conversational AI** — persistent multi-turn conversations with Gemini, including context-linked discussions of a specific observation or project.
* **AI analyses** — summarization, observation analysis, and research suggestions as validated, append-only documents (`type`: `summary`, `analysis`, `research_suggestions`), each stamped with model and prompt version.
* **Research suggestions → tasks** — Gemini suggests next investigations; a research task exists only after you explicitly accept a suggestion.
* **Ask My Journal (RAG)** — grounded question answering over your own observations, with evidence attribution and honest "insufficient evidence" behavior.
* **Research map** — your observations displayed geographically (map provider deferred; see [Scope](#mvp-scope--deferred-capabilities)).
* **Strict data isolation** — every record is owned by its authenticated creator and inaccessible to anyone else.

---

## High-Level Architecture

```text
                     ┌──────────────────────┐
                     │    React + Vite      │
                     │    TypeScript SPA    │
                     └──────────┬───────────┘
                                │ Firebase ID token
                                ▼
                     ┌──────────────────────┐
                     │  Firebase Auth       │
                     │  (Google Sign-In)    │
                     └──────────┬───────────┘
                                ▼
                    ┌───────────────────────────┐
                    │        Cloud Run          │
                    │  Node.js + TS + Express   │
                    │  Auth · AuthZ · Validation│
                    │  Domain services          │
                    │  AI Service → Gemini      │
                    │  RAG (retrieve + rerank)  │
                    └──────┬─────────┬──────────┘
                           │         │
              ┌────────────┘         └────────────┐
              ▼                                   ▼
     ┌─────────────────┐                ┌─────────────────┐
     │ Cloud Firestore │                │    Gemini API   │
     │ (source of      │                │ (via AI Service │
     │  truth)         │                │     abstraction)│
     └─────────────────┘                └─────────────────┘
              │                                   ▲
              ▼                                   │
     ┌─────────────────┐                ┌─────────────────┐
     │  Cloud Storage  │                │ Secret Manager  │
     │ (private media) │                │ (server secrets)│
     └─────────────────┘                └─────────────────┘
```

The application follows a **modular monolith** on Cloud Run (stateless, horizontally scalable). AI calls flow through an application-level AI service abstraction — application code depends on that interface, not directly on the Gemini SDK. Firestore is the single source of truth; the RAG search index is derived, user-scoped, and never authoritative. See [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) and [`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md).

---

## Technology Stack

| Layer | Technology |
| ----- | ---------- |
| Frontend | React + TypeScript + Vite, Tailwind CSS + shadcn/ui, TanStack Query |
| Backend | Node.js + TypeScript + Express |
| AI | Gemini API (server-side, behind the AI Service abstraction) |
| Authentication | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore |
| Media | Cloud Storage (private; binaries + Firestore metadata) |
| Maps | Provider deferred — decided at the map-feature implementation ([ADR-020](docs/ADR.md)) |
| Secrets | Google Cloud Secret Manager |
| Validation | Zod |
| Deployment | Docker → Google Cloud Run |
| CI/CD | GitHub Actions |
| Monitoring | Cloud Logging + Cloud Monitoring |
| Testing | Vitest (unit/integration/security) |

---

## Core Domain Model

The **Observation is the fundamental user-created record** — a scientific observation, field note, measurement record, hypothesis note, or an ordinary personal journal entry. All user data lives beneath the authenticated user's document:

```text
users/{uid}                                ← ownership boundary (Firebase UID)
│
├── projects/{projectId}                   ← optional organizational layer
│
├── observations/{observationId}           ← the fundamental record
│   ├── versions/{versionId}               ← edit provenance (ships with editing)
│   └── media/{mediaId}                    ← evidence metadata (binaries in Cloud Storage)
│
├── conversations/{conversationId}         ← multi-turn AI conversations
│   └── messages/{messageId}
│
├── analyses/{analysisId}                  ← ALL AI-generated structured outputs
│                                            (type: summary | analysis | hypothesis |
│                                             classification | research_suggestions)
├── researchTasks/{taskId}                 ← user-accepted investigations
│
└── observationSearch/{observationId}      ← derived RAG index — never a source of truth
```

Key properties:

* **User-flat observations** with an optional, nullable `projectId` — projects organize, they are not parents.
* **Analyses are append-only** and reference their source observations; they are retained even if a source is later deleted.
* **AI content is distinguishable by schema** — user observations vs AI analyses vs AI-suggested tasks.
* Full field-level definitions: [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md).

---

## AI Capabilities

| Capability | What it does | Persisted as |
| ---------- | ------------ | ------------ |
| Conversational AI | Multi-turn reflection/brainstorming in context | conversation `messages` |
| Summarization | Condenses conversations or observations | analysis (`type: "summary"`) |
| Observation analysis | Findings, hypotheses with confidence, uncertainties, next steps | analysis (`type: "analysis"`) |
| Research suggestions | Suggested follow-up investigations | analysis (`type: "research_suggestions"`) |
| Ask My Journal | Grounded Q&A over your own observations | grounded answer + evidence |
| Related-observation search | Retrieval over your own records (no generation) | ranked references |

Every AI output passes through an application pipeline — input validation → authorized context assembly → Gemini → schema validation → application validation → persistence. Invalid AI output is never persisted. Two additional analysis types (`hypothesis`, `classification`) exist in the data model but are **reserved** — no generation workflows for them are implemented.

See [`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md) for the pipeline, prompt architecture, and failure behavior.

---

## RAG Overview

Ask My Journal answers questions from **your own** observations:

```text
Your observations (source of truth, Firestore)
      ↓ derived, user-scoped search index (observationSearch)
Retrieval → reranking
      ↓ re-checked against canonical data
Gemini, with retrieved content as untrusted context
      ↓
Grounded answer + evidence[] + uncertainties[]
```

* Retrieval is scoped to the authenticated user **before** any model call — the index is derived and is never an authorization mechanism.
* When the evidence is insufficient, the system says so rather than fabricating observations.

Details: [`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md) §5; evaluation methodology: [`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md).

---

## Security & Privacy Highlights

* **Firebase Authentication** (Google Sign-In); the backend derives the user identity **only** from the verified Firebase ID token — never from client-supplied fields.
* **Server-side authorization** on every endpoint; ownership is enforced by application code *and* Firestore Security Rules (defense in depth). Foreign resources are indistinguishable from missing ones (`404`).
* **UID-based data isolation** — all private data lives under `users/{uid}/…`; cross-user access is denied at every layer.
* **Secrets stay server-side** — the Gemini API key lives in Google Cloud Secret Manager, never in the browser, the repository, or logs.
* **Private media** — binaries in private Cloud Storage at backend-derived paths; storage paths are never exposed to clients; access via short-lived authorized read URLs.
* **Prompt-injection resistance** — user and retrieved content are treated as untrusted data, never as instructions; AI output is validated before persistence and never mutates user-authored records.
* **Privacy-aware observability** — logs contain operational metadata, never journal content, tokens, or secrets.
* **Rate limiting & input limits** on expensive (AI/media) endpoints to protect cost, availability, and abuse resistance.

Full model: [`docs/SECURITY.md`](docs/SECURITY.md); API contract: [`docs/API.md`](docs/API.md).

---

## Repository Structure

```text
ai-scientific-journal/
│
├── frontend/          ← React + TypeScript + Vite SPA        (implementation)
├── backend/           ← Node.js + TypeScript + Express API   (implementation)
│
├── firebase/          ← firestore.rules, indexes, config
├── infrastructure/    ← Cloud Run / IAM / secrets / monitoring configs
├── scripts/           ← dev utilities (seed, env validation, smoke tests)
├── docs/              ← canonical documentation (below)
├── .github/workflows/ ← CI (lint, typecheck, tests, build)
│
├── Dockerfile
├── README.md
└── DOCUMENTATION_RECONCILIATION.md
```

---

## Getting Started (Local Development)

The app runs **fully offline** against the Firebase Emulator Suite with a built-in Fake AI service — **no Google Cloud project, no Firebase project, and no Gemini API key are required** to try it locally.

### Prerequisites

* Node.js (LTS) + npm
* Firebase CLI (`npm install -g firebase-tools`) — for the local Auth/Firestore/Storage emulators

> Docker, the Google Cloud CLI, a Firebase/GCP project, and a Gemini API key are only needed for **deployment** (see [Deployment](#deployment)).

### Quick Start

```bash
# 1. Clone
git clone <repository-url>
cd ai-scientific-journal

# 2. Install dependencies (two apps)
cd frontend && npm install
cd ../backend && npm install
cd ..

# 3. Configure environment (defaults target the emulators + Fake AI)
cp frontend/.env.example frontend/.env
cp backend/.env.example  backend/.env

# 4. Start the Firebase emulators (Auth :9099, Firestore :8082, Storage :9199, UI :4000)
firebase emulators:start

# 5. Start the backend (http://localhost:8081)
cd backend && npm run dev

# 6. Start the frontend (http://localhost:5173) — in a second terminal
cd frontend && npm run dev
```

Then open **http://localhost:5173**, click **Sign in with Google**, and the Auth emulator signs you in with a generated local account — nothing leaves your machine.

### How the offline mode works

* The frontend `.env` sets `VITE_USE_FIREBASE_EMULATORS=true` and a `demo-` project ID — Firebase's offline mode, so no real Firebase project is contacted.
* The backend `.env` points at the running emulators and sets `USE_FAKE_AI=true` — Gemini calls are served by a built-in fake AI service (deterministic, no network). The fake AI is **forbidden in production** (startup fails fast if enabled there).
* Add a real `GEMINI_API_KEY` and set `USE_FAKE_AI=false` in `backend/.env` only when you want real model responses locally.

### Validation

```bash
cd frontend && npm run lint && npm run typecheck && npm test
cd backend  && npm run lint && npm run typecheck && npm test
npm run build   # per app; production build
```

The backend security suite (`npm run test:security`) runs the Firestore rules tests with the security flag enabled.

> Never commit `.env` files — they are local-only and git-ignored.

---

## Using the App

The product loop is **Observe → Record → Analyze → Organize → Discover → Investigate Further**:

1. **Sign in** with Google (Firebase Authentication). Everything you create is private to your account.
2. **Record an Observation** — the fundamental record. Title + description are all that's required; measurements, hypothesis, tags, evidence photos, and location (with precision you control: exact, approximate, or hidden) are optional. Use **Quick Capture** on the dashboard to save a draft in seconds.
3. **Organize (optional)** — group observations into Projects. Nothing requires a project; deleting one re-files its records rather than deleting them.
4. **Analyze** — from an observation's page, run a Gemini analysis: findings, hypotheses, uncertainties, and suggested next steps, always labeled as AI output and never overwriting your record.
5. **Ask My Journal** — question your whole history; answers cite the observations they rely on and say so plainly when the evidence is insufficient.
6. **Discuss** — multi-turn AI chat, optionally grounded in a specific observation or project.
7. **Investigate** — accept AI-suggested next steps as research tasks and track them to done.
8. **Research Map** — see where your observations happened; approximate locations render as areas, hidden locations never appear.

Settings covers your profile (display name, avatar) and journal defaults. Sign-out asks for confirmation; account data stays isolated per user at the Firestore rules and API layers.

---

## Configuration

Configuration is centralized and validated at startup (fail fast on missing required values). At a high level:

* **Frontend** — Firebase web configuration (public-by-design) and the backend API base URL. No privileged credentials, ever.
* **Backend** — Firebase Admin credentials, Gemini model configuration, and the Gemini API key. In production the API key is provided at runtime from **Google Cloud Secret Manager** — never baked into the image or committed.
* See `.env.example` files for the exact variable names (placeholder values only).

---

## Testing

Testing is layered — unit → integration → security → API → AI evaluation → E2E → production smoke — with security/isolation tests treated as the highest priority:

* Security boundaries (user isolation, authorization, validation) are automated tests, not aspirations.
* External services (Gemini, Firestore, Storage) are mocked/emulated at defined seams; default suites are fast and offline.
* AI *quality* evaluation (groundedness, hallucination checks, evaluation cases, human rubric) is defined separately in [`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md).
* No numerical coverage targets — effort concentrates on validation, authorization, AI-output validation, and data-lifecycle correctness.

Details: [`docs/TESTING.md`](docs/TESTING.md).

---

## Deployment

Production runs on **Google Cloud Run** as a containerized service:

```text
GitHub → CI (lint/typecheck/tests/build) → Docker image
        → Artifact Registry → Cloud Run → production
```

Highlights:

* Service name `ai-scientific-journal`, carrying the required label `dev-tutorial=cloud-run-ai-challenge`.
* Secrets injected at runtime from Secret Manager; never in the image.
* Dedicated, least-privilege service account (Firestore, Storage, Secret Manager only).
* Firestore Security Rules deployed and tested before public exposure.
* Revision-based rollback if a deployment misbehaves.

**Current deployment:** live on Cloud Run in `asia-south1` — service `ai-scientific-journal`, labeled `dev-tutorial=cloud-run-ai-challenge`.

Full procedure and pre-launch checklists: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Documentation

| Document | Purpose |
| -------- | ------- |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements and scope |
| [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) | Overall technical architecture |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Security architecture and controls |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | Canonical Firestore data model |
| [`docs/API.md`](docs/API.md) | Canonical API specification (`/api/v1`) |
| [`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md) | AI service abstraction, pipelines, RAG |
| [`docs/AI_EVALUATION.md`](docs/AI_EVALUATION.md) | AI quality, safety, and RAG evaluation |
| [`docs/TESTING.md`](docs/TESTING.md) | Testing strategy |
| [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) | Monitoring, logging, metrics, alerts |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Production deployment |
| [`docs/ADR.md`](docs/ADR.md) | Architecture Decision Records (ADR-001 … ADR-020) |

---

## MVP Scope & Deferred Capabilities

**In the MVP scope:**

* Firebase Authentication (Google Sign-In) and strict per-user isolation
* Observations (scientific records and freeform journal notes) with projects as optional organization
* Multi-turn Gemini conversations and automatic analyses (summary / analysis / research_suggestions)
* Research tasks via explicit user acceptance of suggestions
* Ask My Journal (grounded RAG) and related-observation retrieval
* Location fields with user-controlled precision; private evidence media
* Cloud Run deployment with Secret Manager, CI, and observability

**Explicitly deferred** (decisions and features intentionally postponed — see the linked docs):

* **Maps provider** (Google Maps Platform vs Leaflet) — decided when map features are implemented ([ADR-020](docs/ADR.md))
* **Storage client choice** (Firebase Storage SDK vs Cloud Storage SDK) — media phase ([ADR-020](docs/ADR.md))
* **Observation version history UI/API activation** — ships with the observation-editing phase ([ADR-016](docs/ADR.md))
* **Reserved analysis types** `hypothesis` and `classification` — defined in the data model, no generation workflows yet
* Optional polish items — voice journaling, AI auto-tagging, pattern detection, reports, offline mode (PRD Phase 5)

---

## Contributing

1. Read the relevant canonical document(s) before architectural changes.
2. Update affected documentation alongside code.
3. Add or update tests — security-isolation tests are part of "done" (`docs/SECURITY.md` §34).
4. Record significant architectural decisions as new ADRs in [`docs/ADR.md`](docs/ADR.md).

Avoid introducing new services or infrastructure without a genuine requirement.

---

## License

MIT License.

---

## Final Principle

Personal journals contain private and meaningful information.

> **AI should make journaling more useful — never less private, less secure, or less reliable.**
