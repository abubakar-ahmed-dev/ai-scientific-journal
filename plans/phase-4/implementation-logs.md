# Phase 4 Implementation Logs — AI Foundation & Conversational AI

**Date:** 2026-09-02  
**Status:** Completed & Verified  
**Governing Documents:** PRD.md (FR-03, FR-14, AI-02, AI-10, NFR-02); TECHNICAL_ARCHITECTURE.md (§5.5, §17–§21, §38, §44, §46, §54, §61–§63, §73, §77–§81, §92); SECURITY.md (§2, §6, §8, §9, §10, §11, §17, §24, §30, §34); DATABASE_SCHEMA.md (§11, §16, §18, §19); API.md (§1.4, §2, §3, §4.1, §4.4, §6.10–§6.12, §7.3, §8); AI_ARCHITECTURE.md (§1–§4, §6–§8, §10, §11, §14); ADR.md (ADR-003, ADR-008, ADR-009, ADR-010, ADR-014, ADR-015, ADR-018, ADR-021).

---

## 1. Summary of Changes

### Task 1: AI Service Abstraction, Adapters & Context Assembly
- **Environment & Centralized AI Configuration**:
  - Updated `backend/src/config/env.ts` with `GEMINI_API_KEY`, `AI_MODEL` (default: `"gemini-2.5-flash"`), `AI_TIMEOUT_MS` (default: `30000`), and `AI_MAX_CONTEXT_MESSAGES` (default: `20`).
- **AI Service Abstraction (`backend/src/ai/`)**:
  - `types.ts`: Defined `IAIService`, `ChatContextPayload`, `ChatEntityContext`, `ChatMessageContext`, and `ChatGenerationResult`.
  - `prompts/systemPrompt.ts`: Created authoritative system instructions establishing the AI scientific assistant persona, requiring empirical rigor, distinguishing hypotheses from facts, and strictly framing user context data as untrusted information.
  - `adapters/geminiAdapter.ts`: Implemented `IAIService` using `@google/genai` with `AbortSignal`/`Promise.race` timeout enforcement and error mapping (`AI_UNAVAILABLE` 503, `AI_INVALID_RESPONSE` 502).
  - `adapters/fakeAiService.ts`: Created deterministic in-memory fake AI service with failure injection (`setFailureMode`) for offline unit and integration tests.
  - `aiService.ts`: Central singleton factory `getAiService()` and `setAiService(mock)`.
  - `contextBuilder.ts`: Built `ChatContextBuilder` which verifies entity ownership for observations/projects, loads recent message history within sliding window, formats observation measurements and notes, and wraps context in XML delimiters (`<context_data>`).
- **Unit Tests**:
  - `backend/tests/unit/aiService.test.ts`: Verified normal response generation, 503 error mapping on upstream outage, 503 on timeout, and 502 on invalid/blocked content.
  - `backend/tests/unit/contextBuilder.test.ts`: Verified context window bounding, observation and project context formatting, and 404 NOT_FOUND on foreign/missing entities.

### Task 2: Repositories, Chat Pipeline & API Routes
- **Validation Schemas (`backend/src/schemas/`)**:
  - `conversationSchema.ts`: Created Zod schemas for `CreateConversationSchema` (with refinement requiring `contextId` when `contextType != 'general'` and prohibiting `contextId` when `general`), `UpdateConversationSchema` (`.strict()` rejecting immutable context fields), and `ListConversationsQuerySchema`.
  - `messageSchema.ts`: Created `CreateMessageSchema` (1–8000 trimmed chars) and `ListMessagesQuerySchema`.
- **Firestore Repositories (`backend/src/repository/`)**:
  - `conversationRepository.ts`: Implemented `users/{uid}/conversations/{id}` with referential validation for `projectId` and `contextId`, `messageCount` maintenance, and deletion cascade to `messages/*`.
  - `messageRepository.ts`: Implemented `users/{uid}/conversations/{id}/messages/{msgId}` with atomic `sequence` numbering, `listRecent` for context assembly, and pagination.
- **Middleware (`backend/src/middleware/`)**:
  - `rateLimiter.ts`: Configured `chatRateLimiter` applying the 20 req/min chat tier rate limit (API.md §4.1) with `429 RATE_LIMIT_EXCEEDED` response envelope and IPv6 validation.
- **API Endpoints (`backend/src/routes/conversations.ts`)**:
  - `POST /api/v1/conversations`: Create conversation (201).
  - `GET /api/v1/conversations`: List conversations with filters and cursor pagination (200).
  - `GET /api/v1/conversations/:id`: Retrieve single conversation (200 / 404).
  - `PATCH /api/v1/conversations/:id`: Update title or archive status (200).
  - `DELETE /api/v1/conversations/:id`: Cascade delete conversation and messages (204).
  - `GET /api/v1/conversations/:id/messages`: List messages in sequence order (200).
  - `POST /api/v1/conversations/:id/messages`: The stateful chat endpoint (201). Executes: Persist user message $\rightarrow$ Assemble bounded context $\rightarrow$ Invoke Gemini $\rightarrow$ Validate output $\rightarrow$ Persist assistant message $\rightarrow$ Increment counters. Preserves user message in Firestore if AI generation fails.
  - Mounted under `backend/src/routes/index.ts` with `requireAuth`.
- **Integration Tests**:
  - `backend/tests/integration/conversations.test.ts`: Verified 401 unauthenticated rejection, conversation creation, validation rules, and User B isolation (`404 NOT_FOUND`).
  - `backend/tests/integration/chatPipeline.test.ts`: Verified stateful chat turn generation, user and assistant sequence numbering, and user message persistence during AI 503 outages.

### Task 3: Frontend Conversational UI & Verification
- **API Client (`frontend/src/lib/api.ts`)**:
  - Added typed methods: `fetchConversations`, `fetchConversation`, `createConversation`, `updateConversation`, `deleteConversation`, `fetchMessages`, `sendMessage`.
- **Components & Pages (`frontend/src/`)**:
  - `components/ChatWindow.tsx`: Implemented chat UI with message bubbles (user indigo vs assistant slate), model badges, metadata (latency, tokens), auto-scroll, Enter-to-send, typing/reasoning indicator, and error retry banner.
  - `pages/ConversationsPage.tsx`: Implemented two-pane conversation manager with search, active/archived tabs, conversation deletion/archival, "+ New Chat" modal with observation/project context linkage, and responsive layout.
  - `pages/ObservationDetailPage.tsx`: Added "Discuss with AI" button in the action bar that directly opens a context-linked conversation.
  - `components/Layout.tsx` & `app/App.tsx`: Added `/conversations` navigation link and routed page.
- **Frontend Tests**:
  - `frontend/src/pages/ConversationsPage.test.tsx`: Verified rendering conversation list, message thread, and active chat interface.

---

## 2. Verification Results

### Automated Tests
- **Backend Tests (`vitest run`)**: **52 / 52 passed** across 11 test suites.
  - `tests/unit/aiService.test.ts` (4 passed)
  - `tests/unit/contextBuilder.test.ts` (3 passed)
  - `tests/unit/schemas.test.ts` (7 passed)
  - `tests/unit/env.test.ts` (3 passed)
  - `tests/integration/health.test.ts` (3 passed)
  - `tests/integration/me.test.ts` (7 passed)
  - `tests/integration/projects.test.ts` (8 passed)
  - `tests/integration/observations.test.ts` (9 passed)
  - `tests/integration/conversations.test.ts` (5 passed)
  - `tests/integration/chatPipeline.test.ts` (2 passed)
  - `tests/security/rules.test.ts` (excluded from default run per config; run via emulator)
- **Frontend Tests (`vitest run`)**: **3 / 3 passed** across 3 test suites (`LandingPage.test.tsx`, `ObservationsPage.test.tsx`, `ConversationsPage.test.tsx`).
- **Backend Typecheck (`tsc`)**: **0 errors**.
- **Backend Lint (`eslint`)**: **0 errors, 0 warnings**.
- **Frontend Typecheck (`tsc -b`)**: **0 errors**.
- **Frontend Lint (`oxlint`)**: **0 errors**.
- **Frontend Build (`vite build`)**: **Production bundle built in 1.98s**.

---

## 3. Architecture & Security Checklist Alignment

- [x] **ADR-018: No `/api/v1/ai/chat`**: Stateful chat implemented exclusively via `POST /api/v1/conversations/:id/messages`.
- [x] **ADR-003 & ADR-014: Flat Firestore Hierarchy**: Conversations live at `users/{uid}/conversations/{id}` and messages at `.../messages/{msgId}`.
- [x] **ADR-010: Untrusted Data Delimiters**: Context builder wraps observation/project data in `<context_data>` tags.
- [x] **AI Failure Durability (PRD AI-10)**: User messages are saved to Firestore prior to the Gemini model call. Outages return 503 without data loss.
- [x] **Existence-Hiding 404s (SECURITY.md §24)**: Foreign conversation access returns 404 NOT_FOUND.
- [x] **Chat Rate Limiting (API.md §4.1)**: 20 req/min chat tier limiter active.
