# Phase 5 — Structured AI Analyses & Research Tasks: Implementation Plan

**Source plan:** `plans/IMPLEMENTATION_PLAN.md` §3 Phase 5  
**Governing docs:** PRD.md (FR-05, FR-14, FR-15, AI-05, AI-07, AI-10, NFR-02); TECHNICAL_ARCHITECTURE.md (§5.5, §17–§21, §44, §46, §54, §61–§63, §73, §77–§81, §92); SECURITY.md (§2, §6, §8, §9, §10, §11, §13, §17, §24, §30, §34); DATABASE_SCHEMA.md (§12, §13, §16, §18, §19); API.md (§1.4, §2, §3, §4.1, §4.4, §6.13–§6.15, §7.1–§7.3, §8); AI_ARCHITECTURE.md (§1–§3, §6–§11, §14); ADR.md (ADR-003, ADR-009, ADR-010, ADR-014, ADR-015, ADR-018, ADR-021); AI_EVALUATION.md (§2, §7, §13); TESTING.md (§4, §8, §9).  
**Branch:** `feature/phase-5-structured-analyses` (off `dev` — never work on `main`)

---

## 0. Phase Goal & Overview

Phase 5 delivers the core scientific intelligence and research workflow differentiators of the AI Scientific Journal:
1. **Structured AI Generation Pipelines (`POST /api/v1/ai/summarize`, `/analyze`, `/suggest-research`)**:
   - Authorized context extraction from owned observations or conversations.
   - Versioned, prompt-layer-separated prompts (`summaryPrompt.ts`, `analysisPrompt.ts`, `researchSuggestionsPrompt.ts`) with untrusted-data delimiters (ADR-010).
   - Structured JSON output generation via Gemini adapter with schema enforcement.
   - Strict validation pipeline (Parse $\rightarrow$ Schema Validation $\rightarrow$ Application/Safety Validation $\rightarrow$ Persist per ADR-009). Malformed outputs are never stored (zero-write guarantee).
2. **Append-Only Analyses Persistence (`users/{uid}/analyses/{id}`)**:
   - Single collection for all AI-generated structured outputs (ADR-015).
   - Complete provenance metadata: `model`, `promptVersion`, `createdAt`, `observationIds`, `conversationId`, `projectId`.
   - Observation `status: "analyzed"` server-side write-back (the only permitted AI $\rightarrow$ observation mutation).
   - Read endpoints (`GET /api/v1/analyses` and `GET /api/v1/analyses/:id?includeSources=summary`) supporting graceful rendering of dangling historical references (ADR-021).
3. **Research Tasks Domain (`users/{uid}/researchTasks/{id}`)**:
   - User-created tasks and the AI suggestion $\rightarrow$ research task acceptance flow (`source: "gemini"`, `sourceAnalysisId`, `suggestionIndex`).
   - Ownership validation of referenced analyses and index bounds checking.
   - Enforced status lifecycle (`suggested → planned → in_progress → completed`, `dismissed`).
4. **Frontend Scientific Analysis & Task Management**:
   - Structured analysis viewer cleanly categorizing Observed Facts vs AI Interpretations vs Hypotheses (with confidence badges & supporting observation links) vs Uncertainties (PRD FR-14).
   - Interactive suggestion acceptance into research tasks.
   - Research tasks dashboard/board with status filter tabs and management controls.

---

## 1. Prerequisites & Existing Context (Phases 1–4)

- **Phase 1**: Monorepo structure, Express error handling, and API envelope contracts (`{ data, meta }`, `{ error: { code, message, requestId } }`).
- **Phase 2**: Firebase ID token authentication (`requireAuth`) and `users/{uid}` path-isolated security rules.
- **Phase 3**: Core domain repositories for `projects` and `observations` with optimistic locking and deletion cascades.
- **Phase 4**: AI Service abstraction (`IAIService`, `GeminiAdapter`, `FakeAIService`), sliding-window context builder, and conversation/message repositories.
- **Phase 5 extends**:
  - `DATABASE_SCHEMA.md` §12 (`analyses`) and §13 (`researchTasks`).
  - Composite indexes in `firestore.indexes.json` for `analyses` (`ownerId`, `createdAt DESC`, `type`, `projectId`) and `researchTasks` (`ownerId`, `updatedAt DESC`, `status`, `projectId`).
  - `IAIService` to support structured JSON schema generation.

---

## 2. Architecture & Design Rules

1. **Analyses are Append-Only and Never Mutate User Content (ADR-015, PRD FR-14)**:
   - There are no edit or overwrite operations for analyses. Regeneration creates a new analysis document.
   - Analyses never modify user observations, measurements, or projects. The sole exception is the server-side update setting `observation.status = "analyzed"`.
2. **Validate Before Persisting (ADR-009, AI_ARCHITECTURE §8)**:
   - Gemini output is never trusted raw. It must pass:
     1. JSON Parse
     2. Zod Structural Schema Validation
     3. Application Business Validation (e.g. valid supporting observation IDs, non-empty findings)
   - If validation fails, nothing is persisted to Firestore, and the API returns `502 AI_INVALID_RESPONSE`.
3. **AI Never Silently Creates Accepted Tasks (PRD FR-15, SECURITY §13)**:
   - AI outputs include `suggestedNextSteps[]`. A research task document with `source: "gemini"` is only created when the user explicitly calls `POST /api/v1/research-tasks` with `{ source: "gemini", sourceAnalysisId, suggestionIndex }`.
4. **Dangling Source Retention (ADR-021, API.md §7.2)**:
   - When an observation or project is deleted, historical analyses that referenced it are **retained** with dangling references. `GET /api/v1/analyses/:id?includeSources=summary` expands sources into `{ observationId, found: boolean, title?, status? }` so clients can render a "source deleted" badge without breaking.
5. **Untrusted Prompt Framing (ADR-010, SECURITY §11)**:
   - Observation descriptions, measurements, and conversation transcripts are placed inside `<context_data>` tags in prompt layers, explicitly framed as data to analyze rather than system instructions.
6. **Existence-Hiding 404s (SECURITY §24)**:
   - Referencing missing or foreign observations, conversations, or analyses returns `404 NOT_FOUND`.

---

## 3. Detailed Technical Design

### 3.1 AI Service Extension & Versioned Prompts (`backend/src/ai/`)

#### 3.1.1 Structured Generation Output Schema (`backend/src/ai/parsers/analysisOutputSchema.ts`)
```typescript
import { z } from "zod";

export const HypothesisOutputSchema = z.object({
  statement: z.string().trim().min(1, "Hypothesis statement required"),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  supportingObservationIds: z.array(z.string()).default([]),
});

export const StructuredAnalysisOutputSchema = z.object({
  summary: z.string().trim().min(1, "Summary is required"),
  keyFindings: z.array(z.string().trim().min(1)).default([]),
  hypotheses: z.array(HypothesisOutputSchema).default([]),
  uncertainties: z.array(z.string().trim().min(1)).default([]),
  suggestedQuestions: z.array(z.string().trim().min(1)).default([]),
  openQuestions: z.array(z.string().trim().min(1)).default([]),
  suggestedNextSteps: z.array(z.string().trim().min(1)).default([]),
});

export type StructuredAnalysisOutput = z.infer<typeof StructuredAnalysisOutputSchema>;
```

#### 3.1.2 Versioned Prompt Modules (`backend/src/ai/prompts/`)
- **`observationAnalysisPrompt.ts`** (`PROMPT_VERSION = "observation-analysis-v1"`):
  - Instructs model to analyze empirical measurements and observations, identify correlations/anomalies, formulate testable hypotheses with confidence ratings, explicitly document data limitations/uncertainties, and suggest concrete next experimental steps.
- **`conversationSummaryPrompt.ts`** (`PROMPT_VERSION = "conversation-summary-v1"`):
  - Summarizes multi-turn brainstorming exchanges, extracting main conclusions, open questions, and suggested action items.
- **`researchSuggestionsPrompt.ts`** (`PROMPT_VERSION = "research-suggestions-v1"`):
  - Focuses on designing future empirical investigations, defining clear experimental variables, measurements to log, and structured research questions.

#### 3.1.3 AI Service Interface & Adapter Extension (`backend/src/ai/`)
Add to `IAIService`:
```typescript
export interface AnalysisPromptPayload {
  systemInstruction: string;
  promptVersion: string;
  contextText: string;
  taskInstruction: string;
}

export interface StructuredAnalysisResult {
  output: StructuredAnalysisOutput;
  model: string;
  promptVersion: string;
  metadata: {
    latencyMs: number;
    tokenUsage?: { promptTokens?: number; candidatesTokens?: number; totalTokens?: number };
  };
}

// In IAIService:
generateStructuredAnalysis(payload: AnalysisPromptPayload): Promise<StructuredAnalysisResult>;
```
- **`GeminiAdapter`**: Calls Gemini API requesting structured JSON output (`responseMimeType: "application/json"`), parses output, validates against `StructuredAnalysisOutputSchema`, and maps errors.
- **`FakeAIService`**: Returns valid mock `StructuredAnalysisOutput` or triggers failure modes (`unavailable`, `invalid_response`, `timeout`).

---

### 3.2 Data Repositories & Schemas (`backend/src/`)

#### 3.2.1 Analyses Schema & Repository (`backend/src/repository/analysisRepository.ts`)
- Path: `users/{uid}/analyses/{analysisId}`
- Fields:
  - `ownerId`: string (immutable)
  - `projectId`: string | null
  - `observationIds`: string[]
  - `conversationId`: string | null
  - `type`: `"summary" | "analysis" | "hypothesis" | "classification" | "research_suggestions"`
  - `summary`: string
  - `keyFindings`: string[]
  - `hypotheses`: Array<{ statement: string; confidence: "low" | "medium" | "high"; supportingObservationIds: string[] }>
  - `uncertainties`: string[]
  - `suggestedQuestions`: string[]
  - `openQuestions`: string[]
  - `suggestedNextSteps`: string[]
  - `model`: string
  - `promptVersion`: string
  - `createdAt`: Timestamp
- Methods:
  - `create(uid: string, data: CreateAnalysisRecordDTO): Promise<AnalysisDocument>`
  - `list(uid: string, query: ListAnalysesQueryDTO): Promise<{ data: AnalysisDocument[]; meta: PaginationMeta }>`
    - Filters: `observationId` (array-contains), `conversationId`, `type`, `projectId`. Ordered by `createdAt DESC`.
  - `findById(uid: string, analysisId: string): Promise<AnalysisDocument | null>`
  - `findByIdWithSourceSummary(uid: string, analysisId: string): Promise<AnalysisWithSourcesDocument | null>`
    - Resolves each `observationIds[]` item against `observationRepository.findById` to return `{ observationId, found: boolean, title?, status? }`.

#### 3.2.2 Research Tasks Schema & Repository (`backend/src/repository/researchTaskRepository.ts`)
- Path: `users/{uid}/researchTasks/{taskId}`
- Fields:
  - `ownerId`: string (immutable)
  - `projectId`: string | null
  - `title`: string
  - `description`: string
  - `source`: `"user" | "gemini"`
  - `sourceAnalysisId`: string | null
  - `status`: `"suggested" | "planned" | "in_progress" | "completed" | "dismissed"`
  - `relatedObservationIds`: string[]
  - `createdAt`: Timestamp
  - `updatedAt`: Timestamp
- Methods:
  - `createFromUser(uid: string, data: CreateUserTaskDTO): Promise<ResearchTaskDocument>`
  - `createFromSuggestion(uid: string, data: AcceptSuggestionDTO): Promise<ResearchTaskDocument>`
    - Validates ownership of `sourceAnalysisId` via `analysisRepository.findById(uid, id)`.
    - Checks that `suggestionIndex` is within `analysis.suggestedNextSteps` range.
    - Copies suggestion into task with `status: "suggested"`, `source: "gemini"`, `sourceAnalysisId`.
  - `list(uid: string, query: ListTasksQueryDTO): Promise<{ data: ResearchTaskDocument[]; meta: PaginationMeta }>`
    - Filters: `status`, `projectId`. Ordered by `updatedAt DESC`.
  - `findById(uid: string, taskId: string): Promise<ResearchTaskDocument | null>`
  - `update(uid: string, taskId: string, patch: UpdateTaskDTO): Promise<ResearchTaskDocument>`
    - Validates state transitions (`suggested → planned → in_progress → completed`; `dismissed` permitted from any state).
  - `delete(uid: string, taskId: string): Promise<void>`

---

### 3.3 API Endpoints & Routes (`backend/src/routes/`)

#### 3.3.1 AI Generation Router (`backend/src/routes/ai.ts` under `/api/v1/ai`)
- `POST /api/v1/ai/summarize`:
  - Body: `{ conversationId?: string, observationIds?: string[], projectId?: string }` (exactly one source).
  - Validates source ownership. Assembles context. Generates summary. Persists to `analyses` (`type: "summary"`). Returns 201 `{ data: analysis }`.
- `POST /api/v1/ai/analyze`:
  - Body: `{ observationIds: string[], projectId?: string }` (1–10 IDs).
  - Validates ownership. Assembles observation data + measurements. Generates structured analysis. Persists to `analyses` (`type: "analysis"`). Updates observations `status: "analyzed"`. Returns 201 `{ data: analysis }`.
- `POST /api/v1/ai/suggest-research`:
  - Body: `{ observationIds?: string[], analysisId?: string, projectId?: string }` (at least one source).
  - Validates ownership. Generates research suggestions. Persists to `analyses` (`type: "research_suggestions"`). Returns 201 `{ data: analysis }`.

#### 3.3.2 Analyses Read Router (`backend/src/routes/analyses.ts` under `/api/v1/analyses`)
- `GET /api/v1/analyses`: List user's analyses with filters (`type`, `observationId`, `conversationId`, `projectId`) and cursor pagination.
- `GET /api/v1/analyses/:analysisId`: Get single analysis. Supports `?includeSources=summary` for expanded source verification.

#### 3.3.3 Research Tasks Router (`backend/src/routes/researchTasks.ts` under `/api/v1/research-tasks`)
- `POST /api/v1/research-tasks`: Creates task (User-authored or AI-suggestion acceptance).
- `GET /api/v1/research-tasks`: Lists tasks with filters and pagination.
- `GET /api/v1/research-tasks/:taskId`: Retrieves single task.
- `PATCH /api/v1/research-tasks/:taskId`: Updates task status or text.
- `DELETE /api/v1/research-tasks/:taskId`: Deletes task.

---

### 3.4 Frontend Implementation (`frontend/src/`)

#### 3.4.1 API Client Expansion (`frontend/src/lib/api.ts`)
- Types: `Analysis`, `Hypothesis`, `ResearchTask`, `CreateTaskInput`, `AcceptSuggestionInput`, `UpdateTaskInput`.
- Methods:
  - `generateSummary(body)`
  - `generateAnalysis(body)`
  - `generateResearchSuggestions(body)`
  - `fetchAnalyses(params)`
  - `fetchAnalysis(id, includeSources?)`
  - `fetchResearchTasks(params)`
  - `fetchResearchTask(id)`
  - `createResearchTask(body)`
  - `acceptResearchSuggestion(body)`
  - `updateResearchTask(id, patch)`
  - `deleteResearchTask(id)`

#### 3.4.2 UI Components & Pages
- **`components/AnalysisViewer.tsx`**:
  - Renders analysis structured document:
    - Summary & Key Findings section.
    - Hypotheses section with confidence pill (`low`, `medium`, `high`) and clickable supporting observation chips.
    - Uncertainties section (highlighted in amber/neutral callout).
    - Suggested Next Steps with "+ Accept as Research Task" action button.
    - AI Provenance footer (model name, prompt version, generation timestamp).
- **`pages/ResearchTasksPage.tsx` (`/tasks`)**:
  - Status tabs: `All`, `Suggested`, `Planned`, `In Progress`, `Completed`, `Dismissed`.
  - Task cards displaying source badge (AI Gemini vs User), title, description, and status transition action dropdown.
  - "+ New Task" modal for manual user task creation.
- **Integration with Observation & Conversation Pages**:
  - `ObservationDetailPage.tsx`: Add "Generate Scientific Analysis" and "Suggest Next Steps" buttons in the action toolbar; displays generated analyses in an expandable drawer or dedicated section.
  - `ConversationsPage.tsx`: Add "Summarize Discussion" button in the chat header.

---

## 4. Security & Isolation Matrix (SECURITY.md §34)

| Test Case | Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **Unauthenticated Request** | `POST /api/v1/ai/analyze` without Bearer token | `401 UNAUTHENTICATED` |
| **Foreign Observation Analysis** | User B attempts to analyze User A's observation | `404 NOT_FOUND` |
| **Foreign Conversation Summary** | User B attempts to summarize User A's conversation | `404 NOT_FOUND` |
| **Foreign Suggestion Acceptance** | User B attempts to accept suggestion from User A's analysis | `404 NOT_FOUND` |
| **Out-of-Bounds Suggestion Index** | User A accepts `suggestionIndex: 99` on analysis with 2 steps | `400 VALIDATION_ERROR` |
| **Malformed Model Output** | Gemini returns invalid JSON or schema violating payload | `502 AI_INVALID_RESPONSE`; 0 writes to Firestore |
| **Invalid Task Status Transition** | Transitioning task directly from `suggested` to `completed` | `400 VALIDATION_ERROR` |
| **Cascade Project Deletion** | Project deleted; analyses referencing it | Analyses retain dangling `projectId`; `includeSources` marks missing |

---

## 5. Step-by-Step Implementation Breakdown

- **Task 1: Structured AI Generation Pipelines, Prompts & Zero-Write Validation**:
  - Create `StructuredAnalysisOutputSchema` in `backend/src/ai/parsers/analysisOutputSchema.ts`.
  - Create versioned prompts: `observationAnalysisPrompt.ts`, `conversationSummaryPrompt.ts`, `researchSuggestionsPrompt.ts`.
  - Extend `IAIService`, `GeminiAdapter`, and `FakeAIService` with `generateStructuredAnalysis`.
  - Implement `analysisSchema.ts` and `analysisRepository.ts`.
  - Implement `/api/v1/ai/summarize`, `/api/v1/ai/analyze`, `/api/v1/ai/suggest-research`, and `/api/v1/analyses` routes.
  - Add observation `status: "analyzed"` server-side write-back.
  - Unit tests for parser validation, prompt construction, zero-write malformed output rejection, and integration tests for AI generation routes.
- **Task 2: Research Tasks Domain & Suggestion Acceptance Workflow**:
  - Implement `researchTaskSchema.ts` and `researchTaskRepository.ts`.
  - Implement `/api/v1/research-tasks` router (`POST`, `GET`, `GET /:id`, `PATCH /:id`, `DELETE /:id`).
  - Implement status transition validation rules.
  - Integration tests verifying suggestion acceptance, foreign analysis rejection, idempotency, and status transitions.
- **Task 3: Frontend Analyses Viewer, Task Management & Verification**:
  - Expand `frontend/src/lib/api.ts` with typed methods for Analyses and Tasks.
  - Build `AnalysisViewer.tsx` component.
  - Build `ResearchTasksPage.tsx` with status tabs and task cards.
  - Connect analysis actions from `ObservationDetailPage` and `ConversationsPage`.
  - Update `Layout.tsx` and `App.tsx` with `/tasks` route.
  - Frontend component tests, full monorepo typecheck, lint, test, build verification, and `plans/phase-5/implementation-logs.md`.
