# Phase 6 Implementation Logs: RAG (Ask My Journal & Related Observations)

**Phase Status:** Completed & Fully Verified  
**Date:** September 2026  
**Git Branch:** `feature/phase-6-rag`  

---

## 1. Executive Summary

Phase 6 implements Retrieval-Augmented Generation (RAG) for the Scientific AI Journal, enabling users to:
1. Ask questions across their entire historical observation journal via `POST /api/v1/ai/ask` and the new `/ask` frontend page ("Ask My Journal").
2. Retrieve semantically and lexically relevant observations with snippets and match scores via `POST /api/v1/ai/search`.
3. Discover related historical observations automatically on the observation detail page.

All features strictly enforce multi-tenant isolation, canonical source of truth in Firestore, deterministic insufficient-evidence gates, and robust prompt injection protection using delimited `<context_data>` blocks.

---

## 2. Completed Tasks & File Manifest

### Task 1: Retrieval Engine, Index Hardening & ADR-022
- **`backend/src/config/env.ts` & `tests/unit/env.test.ts`:**
  - Added configurable RAG environment options:
    - `AI_SEARCH_MAX_CANDIDATES` (default: 500)
    - `AI_SEARCH_DEFAULT_LIMIT` (default: 10)
    - `AI_RAG_MIN_SCORE` (default: 0.05)
    - `AI_RAG_MAX_CONTEXT_OBSERVATIONS` (default: 5)
    - `AI_RAG_CONTEXT_CHAR_BUDGET` (default: 12,000)
- **`backend/src/repository/observationRepository.ts`:**
  - Hardened canonical operations (`create`, `update`, `delete`) to wrap derived search index updates in best-effort `try...catch` blocks with structured warnings (`logger.warn`), fulfilling ADR-017 (canonical writes never fail because of search indexing issues).
  - Implemented `findByIds(uid, ids)` to batch-fetch up to 30 documents at a time using Firestore `in` queries, converting raw snapshots into serialized `ObservationDocument` objects.
  - Refactored `markAsAnalyzed` to reuse `findByIds`.
  - Added unit/integration tests verifying canonical observation operations survive search index failures.
- **`backend/src/ai/retrieval/retrievalService.ts` & `tests/unit/retrievalService.test.ts`:**
  - Implemented pure `tokenize(text)` with diacritic stripping (NFD normalization), punctuation removal, and stop-word filtering (with fallback to preserve short scientific queries).
  - Implemented pure `scoreLexical(queryTokens, searchableText)` with title-prefix weighting (first 60 characters weighted 2.5x) and term frequency.
  - Implemented pure `buildSnippet(text, queryTokens, maxChars)` extracting a centered snippet around the earliest matching term with ellipses.
  - Implemented `RetrievalService.retrieve(uid, query, opts)` fetching candidate search documents from `users/{uid}/observationSearch`, scoring, sorting, verifying existence in canonical Firestore `observations` via `findByIds`, and applying optional `projectId` filtering.
  - Added 11 comprehensive unit tests covering tokenization, diacritics, title weighting, scoring, snippet extraction, and canonical verification.
- **`docs/ADR.md`:**
  - Appended `ADR-022: Lexical Retrieval over Derived Index for RAG (Embeddings Deferred)` documenting the architectural decision to leverage lexical search over derived subcollection index for Phase 6 MVP.

### Task 2: `/ai/ask` + `/ai/search` Endpoints & AI Service Extension
- **`backend/src/ai/types.ts`:**
  - Added `GroundedAnswerPayload`, `GroundedAnswerOutput`, `GroundedAnswerResult`.
  - Added `generateGroundedAnswer(payload: GroundedAnswerPayload): Promise<GroundedAnswerResult>` to `IAIService`.
- **`backend/src/schemas/askSchema.ts`:**
  - Created `AskRequestSchema` (validating `question` 1-2000 chars, optional `conversationId`).
  - Created `SearchRequestSchema` (validating `query` 1-500 chars, optional `limit`, optional `projectId`).
  - Created `GroundedAnswerOutputSchema` (validating structured model JSON output: `answer`, `evidence[]`, `uncertainties[]`).
- **`backend/src/ai/prompts/askGroundedAnswerPrompt.ts`:**
  - Created `buildAskGroundedPrompt(question, candidates)` with `ASK_PROMPT_VERSION = "ask-grounded-v1"`.
  - Formatted candidate observations into delimited `<context_data>` blocks with explicit `[observationId | title | observedAt]` headers and untrusted data directives.
- **`backend/src/ai/adapters/fakeAiService.ts` & `backend/src/ai/adapters/geminiAdapter.ts`:**
  - Implemented `generateGroundedAnswer` in both adapters.
  - In `FakeAIService`: parses `observationId` from context blocks, sets customizable output via `setCustomGroundedOutput`, records invocations in `groundedHistory`, and tests failure modes.
  - In `GeminiAdapter`: invokes Gemini with strict system instruction, schema validation, 20-second timeout, and structured JSON parsing.
- **`backend/src/middleware/rateLimiter.ts` & `backend/src/routes/ai.ts`:**
  - Exported `aiRateLimiter` (10 requests / 5 min / user with IPv6-safe `ipKeyGenerator`). Applied to all `/ai/*` routes.
  - Implemented `POST /api/v1/ai/ask`:
    - Validates request body and verifies conversation ownership/status when `conversationId` is provided.
    - Handles idempotency replay with `Idempotency-Key`.
    - Retrieves candidate observations strictly within the authenticated user's scope.
    - Deterministic insufficient evidence gate: if no candidates or max score < `AI_RAG_MIN_SCORE`, returns `model: "none"` without calling LLM.
    - Validates model citations against retrieved candidates, pruning hallucinations.
    - Persists user question and assistant answer turns to conversation history when linked.
  - Implemented `POST /api/v1/ai/search`:
    - Validates query, calls `retrievalService.retrieve`, formats score and snippet, and returns `{ data: SearchResponseItem[], meta: { resultCount } }`.
- **`backend/tests/integration/ragEndpoints.test.ts`:**
  - Added comprehensive integration tests covering search relevance, score thresholds, cross-user isolation, idempotency replay, conversation linking, foreign conversation protection, archived conversation validation, retrieval failure handling, and per-user rate limiting.

### Task 3: Frontend Ask My Journal Experience & Related Observations
- **`frontend/src/lib/api.ts`:**
  - Added TypeScript interfaces: `AskResponse`, `SearchResponseItem`.
  - Added API client functions: `askMyJournal(body, idempotencyKey)` and `searchObservations(body)`.
- **`frontend/src/pages/AskMyJournalPage.tsx`:**
  - Implemented Question Composer with character counter (0/2000), input validation, and loading skeleton.
  - Rendered Grounded Answer card with clear distinction between AI synthesis and user records.
  - Rendered Supporting Evidence cards linking directly to `/observations/:id`.
  - Rendered Uncertainties & Caveats callout in amber styling.
  - Rendered Provenance badges (`model`, `promptVersion`).
  - Rendered Insufficient Evidence empty-state.
  - Rendered Error banner with retry capability preserving question input.
- **`frontend/src/pages/ObservationDetailPage.tsx`:**
  - Added non-blocking "Related Observations" section that queries `/ai/search` using the observation's title and tags.
  - Filtered out current observation and displayed match percentage and text snippet with link.
- **`frontend/src/app/App.tsx` & `frontend/src/components/Layout.tsx`:**
  - Added `/ask` route and navigation link "Ask Journal".
- **`frontend/src/pages/AskMyJournalPage.test.tsx`:**
  - Unit tests verifying header rendering, submit mutation, grounded answer and evidence rendering, empty-state behavior, and error retention.

### Task 4: AI Evaluation Suite & Verification
- **`backend/tests/ai/ragEvaluation.test.ts`:**
  - Implemented automated evaluation suite aligning with `AI_EVALUATION.md` §5 & §6:
    - 5.1 Retrieval Quality: High recall on relevant terms, precision/exclusion on irrelevant records, invariant matching across diacritics/case.
    - 5.2 Generation Quality: Grounded answer generates valid citations, handles zero evidence with safe fallback and zero fabrication.
    - 6. Security Evaluation: Encapsulates adversarial user content within `<context_data>` boundary tags and enforces untrusted data directives.

---

## 3. Verification & Quality Gates

All checks executed and passed:

1. **Backend Tests:**
   - Command: `npm --prefix backend run test`
   - Result: **20 test files passed (111/111 tests passed)**
2. **Backend Typecheck:**
   - Command: `npm --prefix backend run typecheck`
   - Result: **0 errors (`tsc` passed)**
3. **Backend Lint:**
   - Command: `npm --prefix backend run lint`
   - Result: **0 errors (`eslint src tests` passed)**
4. **Backend Build:**
   - Command: `npm --prefix backend run build`
   - Result: **Passed (`dist/server.js` compiled)**
5. **Frontend Tests:**
   - Command: `npm --prefix frontend run test`
   - Result: **5 test files passed (8/8 tests passed)**
6. **Frontend Typecheck:**
   - Command: `npm --prefix frontend run typecheck`
   - Result: **0 errors (`tsc -b` passed)**
7. **Frontend Lint:**
   - Command: `npm --prefix frontend run lint`
   - Result: **0 errors (`oxlint` passed)**
8. **Frontend Build:**
   - Command: `npm --prefix frontend run build`
   - Result: **Passed in 3.03s (`dist/` generated)**

---

## 4. Architecture Compliance Summary

- **Security (`SECURITY.md`):** Cross-user isolation verified via integration tests. The retrieval engine strictly queries within `users/{uid}/` subcollections. Client-provided user IDs are never trusted.
- **AI Architecture (`AI_ARCHITECTURE.md`):** All AI operations abstracted via `IAIService` (`GeminiAdapter` and `FakeAIService`). Citations validated against candidate IDs. Fallback safely triggers when retrieval or model fails.
- **API Contracts (`API.md` §6.15 & §6.16):** Request and response schemas strictly adhere to specified contracts with consistent error formats (`VALIDATION_ERROR`, `NOT_FOUND`, `AI_UNAVAILABLE`, `RATE_LIMIT_EXCEEDED`).
