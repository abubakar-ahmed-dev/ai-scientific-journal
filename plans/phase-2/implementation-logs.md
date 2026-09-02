# Phase 2 — Security & Data Foundation: Implementation Log

**Date:** 2026-09-02  
**Branch:** `feature/phase-2-security-data`  
**Governing Specs:** `SECURITY.md`, `DATABASE_SCHEMA.md`, `API.md`, `ADR.md` (ADR-006, ADR-014, ADR-018, ADR-021), `plans/phase-2/plan.md`

---

## 1. Executive Summary

Phase 2 establishes the **security spine** and **canonical data architecture** for the AI Scientific Journal:
- End-to-end Firebase Authentication (Google Sign-In) and verified token identity propagation (`req.user.uid`).
- Strict Firestore path-based security rules enforcing `users/{uid}` subtree isolation, read/write separation, `projectId` integrity, and direct client-write prohibitions on `versions` and `analyses`.
- User document lazy lifecycle and profile API (`GET|PATCH /api/v1/me`) with Zod schema validation and immutable field protections.
- Comprehensive security test suites (rules tests and API isolation tests) alongside green build and lint checks across frontend and backend.

---

## 2. Detailed Deliverables & Changes Made

### 2.1 Firebase Configuration & Security Rules

| File Path | Description of Changes |
| --- | --- |
| `firebase.json` (root) | **[NEW]** Configured root Firebase CLI manifest superseding the placeholder. Configured emulator ports (`auth`: 9099, `firestore`: 8082, `ui`: 4000, `singleProjectMode: true`). |
| `firebase/firebase.json` | **[DELETED]** Removed Phase 1 placeholder file in favor of root `firebase.json`. |
| `firebase/firestore.indexes.json` | **[NEW]** Configured the 5 canonical composite indexes per `DATABASE_SCHEMA.md` §18 for `observations`, `analyses`, and `researchTasks`. |
| `firebase/firestore.rules` | **[UPDATED]** Implemented production security rules: path isolation for `users/{uid}`, split `read` vs `write` conditions to prevent `request.resource` evaluation errors on reads, `validProjectRef(uid)` integrity check via `exists()`, and `allow write: if false;` on client-side `versions` and `analyses` access. |

### 2.2 Backend Implementation

| File Path | Description of Changes |
| --- | --- |
| `backend/src/config/env.ts` | **[UPDATED]** Added required `FIREBASE_PROJECT_ID` environment variable to Zod schema to enforce fail-fast startup (TA §44). |
| `backend/vitest.config.mts` | **[NEW]** Configured hermetic Vitest environment with `FIREBASE_PROJECT_ID = "demo-test"`. |
| `backend/.env.example` | **[UPDATED]** Documented `FIREBASE_PROJECT_ID` and dev emulator host variables. |
| `backend/src/types/express.d.ts` | **[UPDATED]** Extended `Express.Request` interface with `user?: { uid: string; email?: string }`. |
| `backend/src/lib/firebaseAdmin.ts` | **[NEW]** Created lazy singleton helper for Firebase Admin SDK initializing Auth (`getFirebaseAuth()`) and Firestore (`getFirebaseFirestore()`). |
| `backend/src/middleware/authMiddleware.ts` | **[NEW]** Implemented `requireAuth` middleware to verify Bearer ID tokens, extract authenticated UID, and reject missing/invalid tokens with standard `401 UNAUTHENTICATED` error envelope. |
| `backend/src/repository/userRepository.ts` | **[NEW]** Implemented `userRepository` with `findOrCreateUser` (lazy creation, default preferences, `lastLoginAt` updates) and `updateUserProfile`. |
| `backend/src/schemas/userSchema.ts` | **[NEW]** Created Zod validation schema for `PATCH /api/v1/me` enforcing string length bounds, URL format, preference enums, and `.strict()` rejection of unknown/immutable fields (`role`, `accountStatus`, `createdAt`, `ownerId`). |
| `backend/src/routes/me.ts` | **[NEW]** Implemented `GET /api/v1/me` and `PATCH /api/v1/me` endpoints. |
| `backend/src/routes/index.ts` | **[UPDATED]** Applied `requireAuth` middleware to `/api/v1` routes and mounted `/me` router. |
| `backend/src/app.ts` | **[UPDATED]** Exported `app` instance for supertest integration. |
| `backend/package.json` | **[UPDATED]** Added `firebase-admin`, `@firebase/rules-unit-testing`, and `"test:security"` script. |

### 2.3 Frontend Integration

| File Path | Description of Changes |
| --- | --- |
| `frontend/src/lib/firebase/config.ts` | **[NEW]** Configured Firebase Web SDK app initialization and Auth emulator connection when `VITE_USE_FIREBASE_EMULATORS=true`. |
| `frontend/src/lib/firebase/authContext.tsx` | **[NEW]** Implemented `AuthProvider` and `useAuth()` hook managing sign-in with Google, sign-out, auth state persistence, and wiring `setAuthTokenProvider`. |
| `frontend/src/lib/api.ts` | **[UPDATED]** Added `fetchMe` and `updateMe` API helper functions connected to the ID token provider seam. |
| `frontend/src/app/providers.tsx` | **[UPDATED]** Wrapped SPA in `AuthProvider`. |
| `frontend/src/pages/LandingPage.tsx` | **[UPDATED]** Added auth state indicator and Google Sign-In / Sign-Out interactive controls. |
| `frontend/src/pages/LandingPage.test.tsx` | **[UPDATED]** Updated unit test to support `useAuth` hook. |

### 2.4 Test Suite & Verification Artifacts

| File Path | Description of Changes |
| --- | --- |
| `backend/tests/fixtures/userFixtures.ts` | **[NEW]** Created test fixtures for multi-user isolation testing (User A vs User B). |
| `backend/tests/security/rules.test.ts` | **[NEW]** Implemented unit tests for Firestore Security Rules testing positive, negative, cross-user, and `projectId` integrity scenarios. |
| `backend/tests/security/isolation.test.ts` | **[NEW]** Implemented API authorization tests verifying 401 unauthenticated responses, token-derived identity, and 400 validation error handling. |

---

## 3. Testing and Verification Results

### 3.1 Backend Tests & Checks
1. **Vitest Unit & Integration Tests**:
   - Executed: `npm --prefix backend run test`
   - Result: **Passed (4/4 test files, 18/18 tests passed)**.
2. **TypeScript Typecheck**:
   - Executed: `npm --prefix backend run typecheck`
   - Result: **Passed with 0 errors**.
3. **Linter (ESLint)**:
   - Executed: `npm --prefix backend run lint`
   - Result: **Passed with 0 errors**.
4. **Backend Build**:
   - Executed: `npm --prefix backend run build`
   - Result: **Clean build output in `dist/`**.

### 3.2 Frontend Tests & Checks
1. **Vitest Component Tests**:
   - Executed: `npm --prefix frontend run test`
   - Result: **Passed (1/1 test file passed)**.
2. **TypeScript Typecheck**:
   - Executed: `npm --prefix frontend run typecheck`
   - Result: **Passed with 0 errors**.
3. **Linter (Oxlint)**:
   - Executed: `npm --prefix frontend run lint`
   - Result: **Passed with 0 errors**.
4. **Frontend Build**:
   - Executed: `npm --prefix frontend run build`
   - Result: **Clean Vite bundle produced in `dist/`**.

---

## 4. Key Decisions & Notes for Testing Phase 3
- `req.user.uid` is the sole source of user identity across all business endpoints under `/api/v1`.
- Any attempt to pass a client-supplied `ownerId` or `uid` in body/query will be ignored or rejected.
- Direct client writes to `users/{uid}/observations/{id}/versions/*` and `users/{uid}/analyses/*` are blocked at the database level by Firestore security rules (`allow write: if false;`); all writes to these collections must go through the backend Admin SDK.
