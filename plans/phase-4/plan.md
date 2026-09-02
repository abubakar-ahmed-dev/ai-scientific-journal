# Phase 4 — AI Foundation & Conversational AI: Implementation Plan

**Source plan:** `plans/IMPLEMENTATION_PLAN.md` §3 Phase 4  
**Governing docs:** PRD.md (FR-03, FR-14, AI-02, AI-10, NFR-02); TECHNICAL_ARCHITECTURE.md (§5.5, §17–§21, §38, §44, §46, §54, §61–§63, §73, §77–§81, §92); SECURITY.md (§2, §6, §8, §9, §10, §11, §17, §24, §30, §34); DATABASE_SCHEMA.md (§11, §16, §18, §19); API.md (§1.4, §2, §3, §4.1, §4.4, §6.10–§6.12, §7.3, §8); AI_ARCHITECTURE.md (§1, §2, §3, §4, §6, §7, §8, §10, §11, §14); ADR.md (ADR-003, ADR-008, ADR-009, ADR-010, ADR-014, ADR-015, ADR-018, ADR-021)  
**Branch:** `feature/phase-4-ai-chat` (off `dev` — never work on `main`)

---

## 0. Phase Goal & Overview

Phase 4 establishes the **AI Service layer** and the **Conversational AI capability** of the Scientific AI Journal:
1. **Application AI Service Abstraction & Gemini Adapter**: The single, decoupled SDK boundary (`@google/genai` / `@google/generative-ai`) with centralized configuration (`AI_MODEL`, `AI_TIMEOUT_MS`), timeout/retry policies, error mapping (`503 AI_UNAVAILABLE`, `502 AI_INVALID_RESPONSE`), and a testable fake/scripted adapter.
2. **Context Assembly Engine**: Bounded, UID-authorized, minimum-necessary context builder that loads conversation history (with window limits) and contextual entity data (observations, projects, research) formatted with untrusted-data delimiters (ADR-010).
3. **Conversations & Messages Repositories**: Complete Firestore persistence for `users/{uid}/conversations/{id}` and `users/{uid}/conversations/{id}/messages/{msgId}` with atomic `sequence` numbering, denormalized `messageCount`, and deletion cascade to `messages/*`.
4. **Stateful Chat Pipeline (`POST /api/v1/conversations/:id/messages`)**: Strictly ordered execution (Persist user message → Assemble context → Gemini generation → Validate output → Persist assistant message → Update counters). User messages are preserved if generation fails, and idempotent retries regenerate the assistant turn without duplicate user turns.
5. **Chat Rate Limiting & Idempotency**: 20 req/min chat tier rate limiter and `Idempotency-Key` tracking.
6. **Frontend Conversational Experience**: Chat interface with active conversation selection, context badge, message history, live sending state, AI failure/retry handling, and conversation archiving/deletion.

---

## 1. Prerequisites & Context from Phase 1–3

- **Phase 1**: Monorepo skeleton, Express middleware chain, error handler, API envelopes (`{ data, meta }`), and Vitest harness.
- **Phase 2**: Firebase Auth ID token verification (`requireAuth`), `users/{uid}` path isolation in Firestore rules, and user document lifecycle (`/me`).
- **Phase 3**: Core domain repositories and CRUD APIs for `projects` and `observations` with optimistic locking and deletion cascades.
- **Phase 4 builds directly on**:
  - `users/{uid}/conversations` and `users/{uid}/conversations/{id}/messages` schema definitions in `DATABASE_SCHEMA.md` §11 and composite indexes in `firestore.indexes.json`.
  - Existing `projectRepository` and `observationRepository` to validate contextual references (`contextType: "observation" | "project"`).
  - Centralized environment configuration in `backend/src/config/env.ts` extending to `GEMINI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`.

---

## 2. Architecture & Design Rules

1. **AI is an Capability, Not the Source of Truth (AI_ARCHITECTURE §1, ADR-018)**:
   - There is NO `/api/v1/ai/chat` endpoint. Stateful chat is conversation messaging under `POST /api/v1/conversations/:id/messages`.
   - Core CRUD never depends on Gemini. An AI outage fails only the AI turn, never the journal record.
2. **Zero Direct SDK Calls in Business Routes (AI_ARCHITECTURE §2)**:
   - Route handlers and controllers only call the high-level `AIService` interface.
   - The `GeminiAdapter` encapsulates all model calls, system prompts, parameter configuration, and upstream error translation.
3. **Persist User Content First (AI_ARCHITECTURE §4, §10)**:
   - When a user sends a chat message, the user's message is persisted to Firestore before any model call is initiated.
   - If Gemini fails (timeout, 503, invalid output), the user message remains durable in the conversation. The client receives a clear, retryable error response.
4. **Idempotent Assistant Regeneration (API.md §6.12)**:
   - If a request with an `Idempotency-Key` failed during model generation and is retried, the backend detects the existing unanswered user message and triggers generation for that turn instead of creating a duplicate user message.
5. **Untrusted Content Framing (SECURITY.md §11, ADR-010)**:
   - User observations and conversation history are passed to Gemini inside clearly delimited sections (`<context_data>` / `<user_history>`) marked as data to analyze, preventing prompt injection attacks from overriding system safety instructions.
6. **Existence-Hiding 404s (SECURITY.md §24)**:
   - Referencing missing or foreign conversations, observations, or projects returns `404 NOT_FOUND` (never `403 FORBIDDEN`).

---

## 3. Backend Implementation Details

### 3.1 Environment Configuration (`backend/src/config/env.ts`)
Add AI configuration variables with fail-fast validation:
```typescript
GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required").default(process.env.NODE_ENV === "test" ? "mock-gemini-key" : ""),
AI_MODEL: z.string().default("gemini-2.5-flash"),
AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
AI_MAX_CONTEXT_MESSAGES: z.coerce.number().int().positive().default(20),
```

### 3.2 AI Service Layer (`backend/src/ai/`)
- **`types.ts`**:
  ```typescript
  export interface ChatContextPayload {
    systemInstruction: string;
    conversationHistory: Array<{ role: "user" | "assistant" | "system"; content: string }>;
    contextualData?: {
      type: "observation" | "project" | "research" | "general";
      title?: string;
      description?: string;
      notes?: string | null;
      hypothesis?: string | null;
      measurements?: Array<{ name: string; value: number; unit: string }>;
      tags?: string[];
    };
  }

  export interface ChatGenerationResult {
    content: string;
    model: string;
    metadata: {
      latencyMs: number;
      tokenUsage?: { promptTokens?: number; candidatesTokens?: number; totalTokens?: number };
      finishReason?: string;
    };
  }

  export interface IAIService {
    generateChatReply(context: ChatContextPayload): Promise<ChatGenerationResult>;
  }
  ```
- **`prompts/systemPrompt.ts`**:
  - Authoritative system instructions establishing the AI assistant as a rigorous, objective scientific companion for hypothesis generation, experiment design, field note reflection, and data analysis.
  - Clear framing that journal records and user inputs are untrusted data to analyze, not instructions to execute.
- **`adapters/geminiAdapter.ts`**:
  - Implements `IAIService` using `@google/genai` (or `@google/generative-ai`).
  - Enforces `AbortSignal.timeout(env.AI_TIMEOUT_MS)`.
  - Maps upstream errors:
    - Network / timeout / 5xx / Overloaded -> `AppError("AI_UNAVAILABLE", "Gemini service is temporarily unavailable. Please retry.", 503)`
    - Safety block / empty candidate -> `AppError("AI_INVALID_RESPONSE", "Model response could not be completed.", 502)`
- **`adapters/fakeAiService.ts`**:
  - Deterministic in-memory fake implementation for testing without live API keys or network dependencies.
  - Supports error injection (simulating 503 unavailable, timeout, malformed output).

### 3.3 Context Assembly Engine (`backend/src/ai/contextBuilder.ts`)
- Builds the `ChatContextPayload` for a conversation:
  1. Validates that the conversation belongs to `uid`.
  2. If `conversation.contextType !== "general"` and `conversation.contextId` is set:
     - If `observation`: loads observation via `observationRepository.findById(uid, contextId)`. If not found, throws `404 NOT_FOUND`. Extracts title, description, notes, hypothesis, measurements, tags.
     - If `project`: loads project via `projectRepository.findById(uid, contextId)`. Extracts title, description, field.
  3. Fetches the latest `N` messages (default 20) ordered by `sequence ASC` via `messageRepository.listRecent(uid, conversationId, limit)`.
  4. Wraps context data with explicit XML delimiters (`<context_data>...</context_data>`).

### 3.4 Data Repositories (`backend/src/repository/`)

#### `conversationRepository.ts`
- Path: `users/{uid}/conversations/{conversationId}`
- Methods:
  - `create(uid: string, data: CreateConversationDTO): Promise<ConversationDocument>`
    - Validates `projectId` if provided (must exist under `users/{uid}/projects/{projectId}`).
    - Validates `contextId` matching `contextType` (`observation` -> `observations/{id}`; `project` -> `projects/{id}`). If `contextType === "general"`, `contextId` must be `null`.
    - Sets `ownerId: uid`, `status: "active"`, `messageCount: 0`, server timestamps.
  - `list(uid: string, query: ListConversationsQueryDTO): Promise<{ data: ConversationDocument[]; meta: PaginationMeta }>`
    - Ordered by `updatedAt DESC`. Filters by `projectId`, `status`, `contextType`. Cursor pagination.
  - `findById(uid: string, conversationId: string): Promise<ConversationDocument | null>`
  - `update(uid: string, conversationId: string, patch: UpdateConversationDTO): Promise<ConversationDocument>`
    - Supports modifying `title` and `status` (`active` | `archived`). `contextType`, `contextId`, and `projectId` are immutable.
  - `incrementMessageCount(uid: string, conversationId: string, delta?: number): Promise<void>`
    - Atomically increments `messageCount` and sets `updatedAt: FieldValue.serverTimestamp()`.
  - `delete(uid: string, conversationId: string): Promise<void>`
    - Cascades deletion to `users/{uid}/conversations/{id}/messages/*`. Analyses referencing the conversation are retained per ADR-021.

#### `messageRepository.ts`
- Path: `users/{uid}/conversations/{conversationId}/messages/{messageId}`
- Methods:
  - `create(uid: string, conversationId: string, data: { role: "user" | "assistant" | "system"; content: string; sequence: number; model?: string; metadata?: Record<string, unknown> }): Promise<MessageDocument>`
    - Sets `ownerId: uid`, `conversationId`, `createdAt: FieldValue.serverTimestamp()`.
  - `list(uid: string, conversationId: string, limit: number, cursor?: string): Promise<{ data: MessageDocument[]; meta: PaginationMeta & { prevCursor?: string | null } }>`
    - Ordered by `sequence ASC`. Supports cursor pagination.
  - `listRecent(uid: string, conversationId: string, limit: number): Promise<MessageDocument[]>`
    - Fetches the last `limit` messages ordered by `sequence ASC` for context construction.
  - `getNextSequence(uid: string, conversationId: string): Promise<number>`
    - Queries the highest sequence message to compute next sequence safely.
  - `findLastUserMessage(uid: string, conversationId: string): Promise<MessageDocument | null>`
    - Used for idempotent retry of unanswered turns.

### 3.5 Validation Schemas (`backend/src/schemas/`)

#### `conversationSchema.ts`
- `CreateConversationSchema`:
  - `title`: string max 200 optional.
  - `projectId`: string optional / null.
  - `contextType`: enum `["general", "observation", "project", "research"]` required.
  - `contextId`: string optional / null.
  - Refinement: if `contextType === "general"`, `contextId` must be null/empty; if `contextType !== "general"`, `contextId` must be non-empty string.
- `UpdateConversationSchema`:
  - `title`: string max 200 optional.
  - `status`: enum `["active", "archived"]` optional.
  - `.strict()` (rejects immutable `contextType`, `contextId`, `projectId`).
- `ListConversationsQuerySchema`:
  - `limit`: number 1-100 default 20.
  - `cursor`: string optional.
  - `status`: enum `["active", "archived"]` optional.
  - `projectId`: string optional.
  - `contextType`: enum `["general", "observation", "project", "research"]` optional.

#### `messageSchema.ts`
- `CreateMessageSchema`:
  - `content`: string trim, min 1, max 8000 characters.
  - `.strict()`.
- `ListMessagesQuerySchema`:
  - `limit`: number 1-200 default 50.
  - `cursor`: string optional.

### 3.6 API Routes & Middleware (`backend/src/routes/`)

#### `backend/src/middleware/rateLimiter.ts`
- Specialized Chat Tier Rate Limiter: 20 requests/min per user (API.md §4.1) keyed by `req.user.uid`. Returns `429 RATE_LIMIT_EXCEEDED` with `Retry-After` header.

#### `backend/src/routes/conversations.ts`
- `POST /api/v1/conversations`: Create new conversation. Validates contextual integrity. Returns 201 `{ data: conversation }`.
- `GET /api/v1/conversations`: List user's conversations with filters and pagination. Returns 200 `{ data: [conversations], meta }`.
- `GET /api/v1/conversations/:conversationId`: Fetch single conversation. Returns 200 or 404.
- `PATCH /api/v1/conversations/:conversationId`: Update title or archive status. Returns 200 `{ data: conversation }`.
- `DELETE /api/v1/conversations/:conversationId`: Delete conversation and its messages. Returns 204.
- `GET /api/v1/conversations/:conversationId/messages`: List messages ordered by `sequence ASC`. Returns 200 `{ data: [messages], meta }`.
- `POST /api/v1/conversations/:conversationId/messages` (The stateful chat endpoint):
  - Protected by Chat Tier rate limiter.
  - Checks if conversation is `active`. If `archived`, throws `400 VALIDATION_ERROR` ("Cannot send messages to an archived conversation").
  - Handles `Idempotency-Key`:
    - Checks if last message was already an assistant message generated for this turn -> returns cached response.
    - If last message is an unanswered user turn from a failed previous attempt -> skips user message insertion and triggers assistant generation.
  - **Step 1**: Persist user message with sequence `N`. Increments `messageCount`.
  - **Step 2**: Assemble bounded context from history + entity context.
  - **Step 3**: Call `aiService.generateChatReply(context)`.
  - **Step 4**: Validate response content (non-empty string <= 20,000 chars).
  - **Step 5**: Persist assistant message with sequence `N + 1`, `model`, `metadata: { latencyMs, tokenUsage }`. Increments `messageCount`.
  - **Step 6**: Returns 201 `{ data: { userMessage, assistantMessage } }`.
  - **Failure Semantics**: If Step 3 or Step 4 throws, error bubbles to error middleware returning `503 AI_UNAVAILABLE` or `502 AI_INVALID_RESPONSE`. The user message created in Step 1 remains safely stored in Firestore.

---

## 4. Frontend Implementation Details

### 4.1 API Client (`frontend/src/lib/api.ts`)
Add typed functions:
- `fetchConversations(params)`
- `fetchConversation(id)`
- `createConversation(data)`
- `updateConversation(id, data)`
- `deleteConversation(id)`
- `fetchMessages(conversationId, params)`
- `sendMessage(conversationId, content, idempotencyKey?)`

### 4.2 Conversational UI Components & Pages (`frontend/src/`)
- **`pages/ConversationsPage.tsx` (`/conversations`)**:
  - Two-pane layout: Conversation sidebar/list on the left, active chat area on the right.
  - Filter by project, context type, or status (`active` vs `archived`).
  - "+ New Chat" button opening creation modal (allows linking to an observation or project).
- **`components/ChatWindow.tsx`**:
  - Message bubble list displaying User (right, indigo) and Assistant (left, slate/white) turns with timestamps and model badges.
  - Auto-scrolling to bottom on new messages.
  - Textarea input with Enter-to-send (Shift+Enter for newline), character count indicator, and Send button.
  - Loading state with typing/thinking indicator.
  - Error state displaying retry button that preserves the user's unsent or failed prompt.
- **Integration with Observation Detail**:
  - "Discuss with AI" button on `ObservationDetailPage.tsx` that initiates a conversation pre-linked with `contextType: "observation"`, `contextId: observation.id`.

### 4.3 Navigation Update
- Add "AI Chat" / "Conversations" link to `Layout.tsx` navbar.
- Route `/conversations` and `/conversations/:id` in `App.tsx`.

---

## 5. Security & Isolation Matrix (SECURITY.md §34)

| Test Case | Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **Unauthenticated Request** | `GET /api/v1/conversations` without Bearer token | `401 UNAUTHENTICATED` |
| **Foreign Conversation Read** | User B attempts `GET /api/v1/conversations/:id` of User A | `404 NOT_FOUND` |
| **Foreign Conversation Message** | User B attempts `POST /api/v1/conversations/:id/messages` of User A | `404 NOT_FOUND` |
| **Foreign Context Link** | User A creates conversation with `contextType: "observation"` referencing User B's observation | `400 VALIDATION_ERROR` or `404 NOT_FOUND` |
| **Immutable Context Fields** | User attempts `PATCH /api/v1/conversations/:id` with `contextType` or `contextId` | `400 VALIDATION_ERROR` (rejected by schema) |
| **Archived Conversation Chat** | User attempts `POST .../messages` to an archived conversation | `400 VALIDATION_ERROR` |
| **AI Failure Persistence** | Simulated Gemini 503 during `POST .../messages` | Returns `503 AI_UNAVAILABLE`; User message persists in Firestore |
| **Idempotent Retry** | Client retries failed chat message with same `Idempotency-Key` | Generates assistant reply without duplicate user message |
| **Cascade Deletion** | Delete conversation | Deletes all message documents in subcollection |

---

## 6. Testing & Verification Plan

### 6.1 Backend Tests
- **Unit Tests (`backend/tests/unit/`)**:
  - `conversationSchema.test.ts`: Test conversation creation, context type refinements, message content size bounds (1-8000 chars), and strict rejection of immutable fields.
  - `chatContextBuilder.test.ts`: Test context window truncation, formatting of observation measurements/notes, and untrusted data XML delimiter wrapping.
  - `geminiAdapter.test.ts`: Test timeout enforcement, error mapping from SDK exceptions to `503 AI_UNAVAILABLE` / `502 AI_INVALID_RESPONSE`.
- **Integration Tests (`backend/tests/integration/`)**:
  - `conversations.test.ts`: Test conversation CRUD, filtering, pagination, and multi-user isolation matrix.
  - `chatPipeline.test.ts`: Test `POST /conversations/:id/messages` using `FakeAIService`, verifying user message persistence, assistant message persistence, sequence ordering, counter increments, error degradation (503), and idempotent retries.

### 6.2 Frontend Tests
- **Component Tests (`frontend/src/pages/ConversationsPage.test.tsx`)**:
  - Test rendering conversation list, message thread, sending a new message, and displaying the retry state on network/AI failure.

### 6.3 Monorepo Verification
- `npm --prefix backend run typecheck`
- `npm --prefix backend run lint`
- `npm --prefix backend run test`
- `npm --prefix frontend run typecheck`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run test`
- `npm --prefix frontend run build`

---

## 7. Execution Tasks Breakdown

To minimize error and ensure clean incremental delivery, Phase 4 will be implemented in 3 structured tasks:

- **Task 1: AI Service Abstraction, Adapters & Context Assembly**:
  - Configure environment for `GEMINI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`.
  - Implement `IAIService`, `GeminiAdapter`, `FakeAIService`, and system prompts.
  - Implement `chatContextBuilder` with observation & project context formatting.
  - Unit tests for schemas, adapter error handling, and context assembly.
- **Task 2: Conversations & Messages Repositories, Chat Pipeline & API Routes**:
  - Implement `conversationRepository` and `messageRepository` with sequence numbering and deletion cascades.
  - Implement Zod schemas and Chat Tier rate limiter middleware.
  - Implement `/api/v1/conversations` and `/api/v1/conversations/:id/messages` route handlers.
  - Integration tests verifying multi-user isolation, user message persistence on AI failure, and idempotent retries.
- **Task 3: Frontend Conversational UI, Observation Integration & Verification**:
  - Expand `frontend/src/lib/api.ts` with conversation and message API client methods.
  - Build `ConversationsPage` (sidebar list + active chat thread), `ChatWindow` component with retry states.
  - Connect "Discuss with AI" action from `ObservationDetailPage`.
  - Frontend component tests, full monorepo typecheck, lint, test, build verification, and `plans/phase-4/implementation-logs.md`.
