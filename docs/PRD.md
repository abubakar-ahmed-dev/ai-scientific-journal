# Product Requirements Document — AI Scientific Journal

## 1. Product Overview

**Product:** AI Scientific Journal

**Platform:** Responsive Web Application

**Purpose:**
A secure, authenticated, AI-powered scientific journal that allows users to record observations, converse with Gemini, automatically analyze and organize research, and discover patterns and insights across their personal observations.

> **Terminology note:** the canonical data model is defined in `DATABASE_SCHEMA.md` (Observation = fundamental record; single `analyses` collection; optional projects; derived search index) and the canonical API in `API.md`. This PRD uses those terms throughout.

The application extends the competition's **Personal Gemini Journal** baseline with a scientific research workflow, location-aware observations, and a production-oriented AI pipeline. The **Observation** is the fundamental user-created record: it may represent a scientific observation, field note, measurement record, hypothesis-related note, or an ordinary personal journal entry (ADR-013). Projects are an optional organizational layer (ADR-014).

### Core Product Loop

**Observe → Record → Analyze → Organize → Discover → Investigate Further**

---

# 2. Requirement Priority

| Category         | Meaning                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| 🔴 **Core**      | Mandatory for competition compliance, security, usability, and judging |
| 🟠 **Semi-Core** | Main product differentiators; implement after Core is stable           |
| 🟢 **Optional**  | Additional polish/features if time permits                             |

> **Security, Usability, Stability, and Data Isolation are never optional.**

---

# 3. Functional Requirements

## 🔴 CORE — Competition Requirements

### FR-01 — User Authentication

* Firebase Authentication must be used.
* Support Google Sign-In.
* Unauthenticated users must not access private journal data.
* Users must be able to sign out.
* Authentication state must persist across sessions.

### FR-02 — Personal Dashboard

Authenticated users must have a private dashboard providing access to:

* Observations (the fundamental record — including ordinary journal notes)
* Conversations
* AI-generated analyses
* Research tasks
* Research map

### FR-03 — Multi-Turn Gemini Interaction

* Users must be able to have multi-turn conversations with Gemini.
* Conversation context must be maintained.
* Gemini should support brainstorming, reflection, summarization, analysis, and journal assistance.

### FR-04 — Observations (Journal Records)

Users must be able to:

* Create observations (scientific records and ordinary journal notes are the same resource)
* Edit observations (edit history via observation versions where enabled)
* View previous observations
* Delete/archive observations
* View conversation history
* Optionally organize observations into projects

### FR-05 — Automatic Summarization & AI Analyses

* Gemini must generate summaries of conversations/observations.
* All persisted AI-generated structured outputs are **analyses** (single collection, `type`-discriminated — including `summary`, `analysis`, `hypothesis`, `classification`, `research_suggestions`); there are no separate summaries/insights entities.
* Analyses must be persisted only after output validation, and users must be able to view them alongside their source content (gracefully handling sources deleted later).

### FR-06 — Firestore Persistence

* Observations, projects, conversations, analyses, and research tasks must persist in Cloud Firestore; Firestore remains the source of truth (RAG/search data is derived).
* Data must remain available across sessions.

### FR-07 — Strict User Data Isolation

* Each user's data must be isolated by authenticated Firebase UID.
* Users must never read, modify, or delete another user's data.
* Firestore Security Rules must enforce isolation.
* Backend authorization must independently verify user identity and permissions.

### FR-08 — Secure Secret Management

* Gemini/API secrets must never be hardcoded or exposed to the client.
* Secrets must be managed using Google Cloud Secret Manager.
* Credentials/secrets must never be committed to GitHub.

### FR-09 — Cloud Run Deployment

* The production application must run on Google Cloud Run.
* Production deployment must be tested.
* Required label:
  `dev-tutorial=cloud-run-ai-challenge`

### FR-10 — Security-First AI Development

Google AI Studio Custom Instructions must establish production security directives covering:

* Threat modeling
* Secure coding
* Authentication/authorization
* Firestore isolation
* Secret management
* Input validation
* Error handling
* Security reviews
* Secure third-party integrations

---

# 4. 🟠 SEMI-CORE — Product Differentiation

## FR-11 — Scientific Observation Mode

Users can create structured scientific observations containing:

* Title
* Description
* Date/time
* Location
* Tags/categories
* Images/evidence
* Measurements/metadata
* Hypothesis
* Notes

Observations remain editable by the user.

---

## FR-12 — Location-Aware Observations

Using device/location capabilities (map **provider selection is deferred** to implementation — ADR-020):

* Attach a location to an observation.
* Use current device location.
* Manually adjust/pin a location.
* Display the observation location on a map.
* Store location metadata with the observation, honoring the user-selected precision (`exact | approximate | hidden`).

---

## FR-13 — Research Map

Display the user's observations geographically (rendering provider deferred per ADR-020; the underlying data is the user's own observation locations).

Users can:

* View observation pins.
* Click pins to inspect observations.
* Navigate between observations and their locations.
* Filter by category, time, and tags.

---

## FR-14 — AI Observation Analysis

Gemini analyzes observations and produces:

* Structured summary
* Important observations
* Possible explanations
* Potential hypotheses
* Suggested questions
* Relevant considerations

AI must distinguish between:

* Observed facts
* User-provided information
* AI-generated hypotheses
* Uncertainty/speculation

---

## FR-15 — Suggested Next Investigation

Gemini can suggest:

* Additional measurements
* Additional photographs
* Follow-up observations
* Questions to investigate
* Experiments/comparisons

Suggestions appear as analysis outputs (`type: research_suggestions`); **Gemini never creates research tasks autonomously** — a task exists only after the user explicitly accepts a suggestion.

---

## FR-16 — Ask My Journal

Users can ask questions about their own historical research.

Examples:

* "Have I observed this before?"
* "What did I observe last month?"
* "What observations are related to this location?"
* "Summarize my research."
* "What patterns appear in my observations?"

Answers must be grounded in the user's actual stored data: retrieval is scoped to the authenticated user's observations (Firestore remains the source of truth; the search index is derived and rebuildable). The answer identifies supporting observations and expresses uncertainty when evidence is insufficient.

---

## FR-17 — Related Observations

Identify potentially related observations using derived retrieval over the user's own observations:

* Semantic similarity
* Location
* Time
* Tags
* Subject
* User content
* AI analysis

Users can navigate between related observations.

---

# 5. 🟠 AI Engineering Requirements

Gemini must not be treated as a simple black-box API call.

## AI-01 — Structured AI Outputs

Gemini should return structured/schema-validated outputs where appropriate rather than unrestricted text.

Example output categories:

* Summary
* Evidence
* Hypotheses
* Confidence/uncertainty
* Suggested actions
* Related observations

## AI-02 — Context Management

* Send only relevant context to Gemini.
* Avoid sending the user's entire journal unnecessarily.
* Maintain appropriate conversation context.
* Control token usage and latency.

## AI-03 — Retrieval-Augmented Generation

For questions involving historical journal data:

**User Query → Retrieval → Relevant Observations → Gemini → Grounded Answer**

The system should retrieve relevant user-owned observations before generating an answer.

## AI-04 — Retrieval Reranking

Where appropriate:

1. Retrieve candidate observations.
2. Rank candidates by relevance.
3. Send the highest-quality context to Gemini.

This improves answer relevance while reducing unnecessary context.

## AI-05 — Grounding

AI responses about user research must be grounded in retrieved observations.

The system should:

* Identify supporting observations.
* Avoid inventing historical information.
* Clearly indicate when evidence is insufficient.

For external/current scientific information, trusted external sources may be incorporated where appropriate.

## AI-06 — Output Validation

AI responses must be validated before being used by the application.

The system should detect:

* Invalid structured output
* Missing required fields
* Unexpected values
* Unsafe or unusable responses

## AI-07 — Hallucination & Uncertainty Control

Gemini must:

* Distinguish facts from hypotheses.
* Avoid presenting speculation as established scientific fact.
* Express uncertainty when evidence is insufficient.
* Never fabricate observations or evidence.

## AI-08 — AI Evaluation

Maintain representative evaluation cases covering:

* Retrieval relevance
* Answer relevance
* Groundedness
* Factual consistency
* Structured-output validity
* Appropriate uncertainty
* Safety behavior

AI changes/prompts should be evaluated against these cases before production deployment where practical.

## AI-09 — AI Observability

Track appropriate AI metrics such as:

* Request latency
* Token usage
* Model/API errors
* Structured-output failures
* Retrieval results
* Evaluation metrics

Sensitive journal content and secrets must not be unnecessarily logged.

## AI-10 — AI Failure Handling

If Gemini fails:

* Do not lose the user's observation or message content.
* Preserve user-generated content.
* Provide a meaningful error.
* Allow analysis to be retried.

---

# 6. 🟢 OPTIONAL — Advanced Features

Implement only after Core and Semi-Core functionality is stable.

### FR-18 — Voice Journaling

Convert spoken observations into structured observation records.

### FR-19 — AI Auto-Tagging

Automatically suggest tags/categories.

### FR-20 — Observation Completeness

Identify missing information that could improve an observation.

### FR-21 — Research Timeline

Chronological visualization of observations.

### FR-22 — AI Pattern Detection

Identify potential patterns across historical observations.

### FR-23 — AI Research Report

Generate structured reports from selected observations.

### FR-24 — Offline Mode

Allow observations to be captured offline and synchronized later.

### FR-25 — Privacy Controls

Allow users to control location/observation visibility and precision.

---

# 7. Non-Functional Requirements

## 🔴 NFR-01 — Security

The application must:

* Use Firebase Authentication.
* Verify authentication on protected backend requests.
* Enforce authorization server-side.
* Enforce Firestore user isolation.
* Protect all secrets using Secret Manager.
* Never expose Gemini secrets to the browser.
* Validate and sanitize user input.
* Protect API endpoints from abuse.
* Avoid sensitive information in logs.
* Use HTTPS in production.
* Apply least-privilege permissions to cloud services.

**Priority: Critical**

---

## 🔴 NFR-02 — Stability & Reliability

The application must gracefully handle:

* Gemini failures
* Firestore failures
* Authentication failures
* Network failures
* Invalid user input
* File upload failures
* Maps/API failures (map functionality must not block observation capture)

The UI must provide:

* Loading states
* Empty states
* Error states
* Retry mechanisms
* Clear user feedback

User-generated data must not be lost because of an AI/API failure.

**Priority: Critical**

---

## 🔴 NFR-03 — Usability

The application must:

* Provide an intuitive workflow.
* Make authentication simple.
* Make creating an observation quick.
* Clearly distinguish user-generated and AI-generated content.
* Provide useful feedback after actions.
* Require minimal unnecessary input.
* Work well on desktop and mobile screen sizes.
* Provide accessible and understandable UI controls.

The product is a **responsive web application**, not a native mobile application.

**Priority: Critical**

---

## 🔴 NFR-04 — Performance

* Fast initial page load.
* Responsive UI interactions.
* Avoid unnecessary Gemini requests.
* Avoid unnecessary Firestore reads/writes.
* Paginate/incrementally load large histories.
* Optimize uploaded media.
* Limit AI context size.
* Use caching where it provides a genuine performance benefit.

---

## 🔴 NFR-05 — Scalability

Architecture must support growth in:

* Users
* Observations
* Conversations
* Gemini requests
* Stored media
* Firestore documents

without fundamental architectural redesign.

Cloud Run should provide horizontal application scaling.

Managed Google Cloud services should be preferred over unnecessary self-managed infrastructure.

---

## 🔴 NFR-06 — Data Integrity

* Prevent accidental overwriting.
* Prevent silent data loss.
* Associate AI analyses with their source content (analyses are append-only and retained even if a source observation is later deleted; consumers handle missing sources gracefully).
* Use reliable timestamps (server-managed `createdAt`/`updatedAt` for pagination and change tracking; client-supplied `observedAt` validated for scientific chronology).
* Preserve user-generated content independently from AI output (AI never mutates observations).
* Maintain relationships between observations, conversations, analyses, and research tasks.

---

## 🔴 NFR-07 — Maintainability

The codebase should have:

* TypeScript throughout frontend/backend.
* Modular components/services.
* Clear frontend/backend separation.
* Centralized configuration.
* No hardcoded secrets.
* Consistent error handling.
* Clear naming and project structure.
* Automated linting/type checking/testing.
* Documentation.

---

## 🔴 NFR-08 — Observability

Production issues should be diagnosable through:

* Cloud Run logs
* Cloud Monitoring
* Application error logging
* Gemini/API error tracking
* Authentication errors
* Firestore errors

Logs must not expose secrets or unnecessary private journal content.

---

## 🔴 NFR-09 — Deployment & Reproducibility

The repository must include:

* Source code
* README
* Deployment instructions
* Firestore Security Rules
* Configuration examples
* Secret configuration instructions
* Docker configuration
* Testing instructions

The application should be reproducibly buildable and deployable.

---

# 8. Technology Stack

## Application

| Layer                        | Technology                                  |
| ---------------------------- | ------------------------------------------- |
| Development environment      | **Antigravity**                             |
| AI configuration/prototyping | **Google AI Studio**                        |
| Frontend                     | **React + TypeScript + Vite**               |
| UI                           | **Tailwind CSS + shadcn/ui**                |
| Backend                      | **Node.js + TypeScript + Express**          |
| AI                           | **Gemini API / Gemini models**              |
| Authentication               | **Firebase Authentication**                 |
| Database                     | **Cloud Firestore**                         |
| Media                        | **Cloud Storage (Firebase Storage / Cloud Storage — client decided at implementation, ADR-020)** |
| Maps                         | **Deferred (Google Maps Platform vs Leaflet — decided at map-feature implementation, ADR-020)** |
| Secrets                      | **Google Cloud Secret Manager**             |
| Containerization             | **Docker**                                  |
| Deployment                   | **Google Cloud Run**                        |
| Source control               | **Git + GitHub**                            |
| CI/CD                        | **GitHub Actions**                          |
| Monitoring                   | **Cloud Logging + Cloud Monitoring**        |

### Infrastructure principle

Use managed Google Cloud services wherever practical.

**Do not introduce Kubernetes, microservices, Redis, Kafka, Nginx, or similar infrastructure unless a real requirement emerges.**

The goal is **production-quality architecture, not unnecessary architectural complexity.**

---

# 9. High-Level Architecture

```text
                         ┌──────────────────┐
                         │      User        │
                         │ Desktop / Mobile │
                         └────────┬─────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ React + TypeScript Web  │
                    │ Tailwind + shadcn/ui    │
                    └────────────┬────────────┘
                                 │ HTTPS
                                 ▼
                    ┌─────────────────────────┐
                    │       Cloud Run         │
                    │                         │
                    │ Node.js + Express       │
                    │ Authentication          │
                    │ Observation Services    │
                    │ Project Services        │
                    │ AI Services              │
                    └──────┬─────┬─────┬──────┘
                           │     │     │
              ┌────────────┘     │     └─────────────┐
              ▼                  ▼                   ▼
       ┌─────────────┐    ┌─────────────┐    ┌──────────────┐
       │  Firestore  │    │   Gemini    │    │Cloud Storage │
       │             │    │             │    │              │
       │ Journals    │    │ Chat        │    │ Images       │
       │ Observ.     │    │ Analysis    │    │ Audio        │
       │ Summaries   │    │ RAG         │    │ Evidence     │
       │ Insights    │    │ Generation  │    │              │
       └─────────────┘    └─────────────┘    └──────────────┘
                                  ▲
                                  │
                         ┌─────────────────┐
                         │ Secret Manager  │
                         └─────────────────┘

                         Maps provider (deferred, ADR-020)
                                  │
                                  ▼
                           Research Map
```

---

# 10. Data Isolation Architecture

User data should be organized around Firebase UID:

```text
users/
  {uid}/
    projects/{projectId}            ← optional organizational layer

    observations/{observationId}    ← fundamental user-created record
      ├── versions/{versionId}
      └── media/{mediaId}

    conversations/{conversationId}
      └── messages/{messageId}

    analyses/{analysisId}           ← ALL AI-generated structured outputs

    researchTasks/{taskId}

    observationSearch/{observationId} ← derived index (not a source of truth)
```

Access must be controlled by authenticated UID.

```text
Firebase Authentication
        ↓
Authenticated UID
        ↓
Backend Authorization
        ↓
Firestore Security Rules
        ↓
Only user's authorized data
```

Frontend filtering must **never** be considered sufficient security. Every user-owned document carries a backend-set, immutable `ownerId`; observation versions inherit ownership from their parent observation path.

---

# 11. AI Processing Architecture

The AI layer should follow a pipeline rather than directly returning raw Gemini responses.

```text
User Input
    ↓
Input Validation / Safety
    ↓
Intent Detection
    ↓
Context Retrieval
    ↓
Reranking
    ↓
Context Construction
    ↓
Gemini
    ↓
Structured Output Validation
    ↓
Grounding / Evidence Check
    ↓
Post-processing
    ↓
User Response
    ↓
Persist Result + Metrics
```

For journal questions:

```text
User Question
      ↓
Retrieve user's relevant observations
      ↓
Rerank candidates
      ↓
Select relevant context
      ↓
Gemini
      ↓
Evidence-grounded answer
```

The AI layer must never retrieve data belonging to another user.

---

# 12. Development & Deployment Workflow

## Development Flow

```text
1. Product Requirements
        ↓
2. Architecture / Data Design
        ↓
3. Google AI Studio
   Security Custom Instructions
        ↓
4. Antigravity
   Implementation
        ↓
5. Automated Tests
   Lint + Typecheck + Tests
        ↓
6. Security Review
        ↓
7. Git Commit
        ↓
8. GitHub
        ↓
9. Docker Build
        ↓
10. Cloud Run Deployment
        ↓
11. Production Testing
        ↓
12. Iterate
```

### Google AI Studio's role

Google AI Studio establishes the **AI/security development constitution** through Custom Instructions and can be used for Gemini experimentation/prototyping.

### Antigravity's role

Antigravity is the primary development environment for:

* Implementation
* Refactoring
* Debugging
* Testing
* Security review
* Iteration

Relevant AI Studio security/development instructions should be ported into the Antigravity project as appropriate.

---

# 13. Production Deployment Architecture

```text
Developer
   ↓
GitHub
   ↓
GitHub Actions
   ├── Lint
   ├── Typecheck
   ├── Tests
   └── Build
          ↓
      Docker Image
          ↓
   Artifact Registry
          ↓
      Cloud Run
          ↓
     Production
```

Docker provides a reproducible production environment.

Cloud Run provides managed deployment and horizontal scaling.

---

# 14. Competition Compliance Checklist

## 🔴 Mandatory

* [ ] Google AI Studio configured with security Custom Instructions
* [ ] Threat modeling directives
* [ ] Secure coding directives
* [ ] Firestore isolation directives
* [ ] Secret management directives
* [ ] Firebase Authentication
* [ ] Google Sign-In
* [ ] Multi-turn Gemini interaction
* [ ] Firestore persistence
* [ ] Automatic analyses (summaries as `type: "summary"` — single `analyses` collection)
* [ ] Strict per-user data isolation
* [ ] Secure Gemini/API key management
* [ ] Cloud Run deployment
* [ ] `dev-tutorial=cloud-run-ai-challenge` label
* [ ] GitHub repository
* [ ] README with deployment instructions
* [ ] Firestore Security Rules included
* [ ] Production testing completed

## 🟠 Differentiation

* [ ] Scientific observation workflow
* [ ] Location-aware observations
* [ ] Research map (provider deferred, ADR-020)
* [ ] AI observation analysis
* [ ] Suggested next investigation (user-accepted research tasks)
* [ ] Ask My Journal (grounded Q&A)
* [ ] Related observations
* [ ] AI pipeline with retrieval/reranking/grounding
* [ ] Structured AI outputs
* [ ] AI evaluation methodology

## 🔴 Quality / Judging Criteria

### Security

* [ ] No exposed secrets
* [ ] No cross-user data leakage
* [ ] Authentication enforced
* [ ] Authorization enforced
* [ ] Firestore rules tested
* [ ] Input validation
* [ ] Secure cloud permissions

### Usability

* [ ] Intuitive user workflow
* [ ] Responsive web UI
* [ ] Clear loading states
* [ ] Clear error states
* [ ] Clear AI/user-content distinction
* [ ] Simple authentication
* [ ] Smooth observation workflow

### Stability

* [ ] Gemini failures handled
* [ ] Firestore failures handled
* [ ] Authentication failures handled
* [ ] Network failures handled
* [ ] No data loss during AI failures
* [ ] Production deployment tested

### Authenticity

* [ ] Original scientific observation workflow
* [ ] Meaningful AI capabilities beyond basic chat
* [ ] Location-aware research
* [ ] Journal intelligence/RAG
* [ ] Custom AI pipeline
* [ ] Original UI/UX

---

# 15. Recommended Implementation Phases

## Phase 1 — Competition Foundation 🔴

* Project setup
* Google AI Studio security instructions
* React + TypeScript
* Node + Express
* Firebase Authentication
* Firestore
* Gemini multi-turn chat
* User isolation
* Secret Manager
* Docker
* Cloud Run
* Production testing

## Phase 2 — Scientific Journal 🟠

* Structured observations
* Observation editor (with version history)
* Tags/categories
* Evidence/media (observation-scoped, private storage)
* Timestamp
* Map integration (provider selected at this phase, ADR-020)
* Current location
* Research map

## Phase 3 — AI Intelligence 🟠

* Structured Gemini outputs
* Observation analysis
* Context management
* Journal retrieval/RAG
* Retrieval reranking
* Grounded answers
* Suggested next investigation
* Related observations
* Ask My Journal

## Phase 4 — AI Quality & Production Hardening 🔴

* AI evaluation dataset
* Retrieval evaluation
* Groundedness/relevance evaluation
* Output validation
* Error handling
* Security testing
* Performance testing
* Observability
* Cloud Run production testing

## Phase 5 — Optional Polish 🟢

* Voice journaling
* AI auto-tagging
* Observation completeness
* Research timeline
* Pattern detection
* AI research reports
* Offline functionality
* Advanced privacy controls

---

# 16. MVP Boundary

If development time becomes limited:

### Never compromise on:

**Security → Authentication → Data Isolation → Stability → Core Gemini functionality → Cloud Run deployment**

Then prioritize:

**Scientific Observations → Location/Map → AI Analysis → Journal RAG → Suggested Investigation**

Only after these are stable should optional features be added.

### Product principle

> **Core = competition compliance.**
> **Semi-Core = product differentiation.**
> **AI Engineering = production intelligence.**
> **Optional = polish.**

The objective is not to build the largest system. It is to build a **secure, stable, usable, genuinely original AI product whose architecture and AI pipeline demonstrate production-level engineering.**
