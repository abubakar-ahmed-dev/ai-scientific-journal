# Phase 2 — Security & Data Foundation: Setup Guide

**Source plan:** `plans/IMPLEMENTATION_PLAN.md` §3 Phase 2
**Governing docs:** SECURITY.md §2–§8, §29, §32; DATABASE_SCHEMA.md §3–§7, §16–§21; API.md §2, §3, §6.2, §8; ADR-006, ADR-014; TESTING.md §5–§6, §12, §15
**Branch:** `feature/phase-2-security-data` (off `dev` — never work on `main`)
**Reviewed:** 2026-09-02 — rules read/write split corrected (`request.resource` is undefined on reads), emulator port moved off 8080 (Oracle listener occupies it on this machine), analyses made client-read-only per API.md §8, Phase 1 `api.ts` auth seam reused instead of a new client, CI emulator wiring added.

---

## 0. Overview & Objectives

Phase 2 establishes the **security spine** and **canonical Firestore data architecture** for the AI Scientific Journal. Every subsequent feature (Core Domain CRUD, Conversational AI, Analyses, RAG) inherits authentication, ownership, validation, and isolation by construction.

### Deliverables
1. **Firebase Authentication Integration**
   - **Frontend**: Google Sign-In via the Firebase Auth SDK, persisted auth state, a minimal sign-in gate on the landing page, and the Firebase ID token flowing into the existing Phase 1 API client through its `setAuthTokenProvider()` seam.
   - **Backend**: `requireAuth` middleware verifying Firebase ID tokens via `firebase-admin`, deriving the UID from the token only, and populating `req.user`. Missing/invalid/expired tokens → `401 UNAUTHENTICATED` envelope.
   - **User profile endpoints**: `GET /api/v1/me` (lazy user-document creation + `lastLoginAt` refresh, API.md §2.1/§6.2) and `PATCH /api/v1/me` (Zod-validated partial update; `role`, `accountStatus`, `createdAt` rejected with `400 VALIDATION_ERROR`).

2. **Firestore Security Rules & Index Artifacts**
   - Root `firebase.json` (Firebase CLI convention) — this **supersedes and replaces** the Phase 1 placeholder `firebase/firebase.json`, which is deleted.
   - `firebase/firestore.rules`: UID-subtree isolation for all canonical collections with per-collection field validation (SECURITY.md §6), **read operations split from write operations** (see §2.3 — `request.resource` exists only on writes), `projectId` `get()` integrity on every project-referencing collection per ADR-014, and client-write prohibition on server-owned collections (`versions`, `analyses`) per API.md §8.
   - `firebase/firestore.indexes.json`: the five composite indexes of DATABASE_SCHEMA.md §18.
   - **Firestore emulator on port 8082** — port 8080 is occupied on this machine by an Oracle listener (TNSLSNR.EXE); the backend already moved to 8081 in Phase 1 for the same reason.

3. **Backend Repository & Authorization Pattern**
   - Lazy-initialized Firebase Admin (`firebaseAdmin.ts`) that connects to the emulators when `FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST` are set and requires `FIREBASE_PROJECT_ID` (added to the Zod env schema — fail fast, TA §44).
   - `userRepository.ts` per DATABASE_SCHEMA.md §5.1: lazy `findOrCreateUser` (sets `ownerId` per the §4 denormalization invariant, default preferences, server timestamps), `updateUserProfile`.
   - Zod schemas for `PATCH /me` matching API.md §6.2 exactly (unknown/immutable fields rejected).
   - `Express.Request.user` type augmentation (extend the existing `backend/src/types/express.d.ts`, which already carries `requestId`).

4. **Automated Security & Isolation Test Harness**
   - **Firestore Rules suite** (`backend/tests/security/rules.test.ts`, `@firebase/rules-unit-testing` + Firestore emulator) — **positive and negative paths** (TESTING.md §6: read/create/update/delete × owner/non-owner/unauthenticated). The negative-only variant would not catch a broken-read rule.
   - **API authorization suite** (`backend/tests/security/isolation.test.ts`, Vitest + Supertest + Auth Emulator tokens) — 401 paths, token-derived identity, immutable-field rejection. The cross-resource existence-hiding `404` matrix is **scaffolded now (multi-user fixtures) and activated in Phase 3**, when the first id-scoped routes (`/observations/:id`) exist — Phase 2 ships only `/me`, which takes no resource ID.

---

## 1. Directory & Branch Setup

```bash
cd /c/Users/Admin/Desktop/FAST/projects/ai-scientific-journal
git checkout dev
git checkout -b feature/phase-2-security-data

# Ensure target directories exist
mkdir -p backend/src/repository backend/src/schemas backend/tests/security backend/tests/fixtures
mkdir -p frontend/src/lib/firebase

# Remove the superseded Phase 1 placeholder (root firebase.json replaces it)
git rm firebase/firebase.json
```

---

## 2. Firebase Configuration & Security Rules

### 2.1 `firebase.json` (repo root — new; delete `firebase/firebase.json`)

```json
{
  "firestore": {
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8082 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  }
}
```

> **Port 8082, not the 8080 default:** an Oracle listener (`TNSLSNR.EXE`) permanently occupies 8080 on this development machine. Keep backend (8081), Firestore emulator (8082) distinct. Requires JDK 11+ locally for the emulator (`firebase emulators:start --only firestore,auth`). CI runners ship Java preinstalled.

### 2.2 `firebase/firestore.indexes.json`

The five composites of DATABASE_SCHEMA.md §18 (no collectionGroup indexes — ADR-014):

```json
{
  "indexes": [
    {
      "collectionGroup": "observations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "observedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "observations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "observedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "observations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tags", "arrayConfig": "CONTAINS" },
        { "fieldPath": "observedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "analyses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "type", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "researchTasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### 2.3 `firebase/firestore.rules`

**Critical correctness notes (why this differs from a naive combined read/write form):**

* `request.resource` is defined **only for write operations** — referencing it in a `read` condition throws and **denies legitimate owner reads**. Reads are therefore split from writes in every block.
* On **delete**, `request.resource` is likewise undefined — `projectId` integrity is checked on `create, update` only.
* `request.resource.data.get('projectId', null)` is used because evaluating a **missing** field directly also errors; `.get()` with a default is the safe accessor.
* Analyses and versions are **client-read-only** (`allow write: if false`): API.md §8 prohibits client-writable versions/analyses, ADR-009/015 require creation only through validated server pipelines. The backend's Admin SDK bypasses rules — these blocks defend the direct-client-SDK surface.
* Rules are default-deny in Firestore; no blanket deny block is needed (it would have no veto effect anyway — rules are OR-ed across matches).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isOwner(uid) {
      return request.auth != null && request.auth.uid == uid;
    }

    // Valid on create AND update: request.resource.data is the full
    // post-write document state in both cases.
    function ownerSet() {
      return request.resource.data.ownerId == request.auth.uid;
    }

    // Optional projectId must be null/unset or reference a project under
    // the same uid (ADR-014 item 6). get() avoids missing-field errors.
    function validProjectRef(uid) {
      return request.resource.data.get('projectId', null) == null
        || exists(/databases/$(database)/documents/users/$(uid)/projects/$(request.resource.data.get('projectId')));
    }

    // ---- User document ----
    match /users/{uid} {
      allow read: if isOwner(uid);
      allow create: if isOwner(uid)
        && ownerSet()
        && request.resource.data.role == "user"
        && request.resource.data.accountStatus == "active";
      allow update: if isOwner(uid)
        && ownerSet()
        && request.resource.data.role == resource.data.role
        && request.resource.data.accountStatus == resource.data.accountStatus
        && request.resource.data.createdAt == resource.data.createdAt;
      allow delete: if isOwner(uid);

      // ---- Projects ----
      match /projects/{projectId} {
        allow read, delete: if isOwner(uid);
        allow create, update: if isOwner(uid) && ownerSet();
      }

      // ---- Observations (fundamental record; user-flat per ADR-014) ----
      match /observations/{observationId} {
        allow read, delete: if isOwner(uid);
        allow create, update: if isOwner(uid) && ownerSet() && validProjectRef(uid);

        // Versions: immutable, backend-created (ADR-016; API.md §8)
        match /versions/{versionId} {
          allow read: if isOwner(uid);
          allow write: if false;
        }

        match /media/{mediaId} {
          allow read, delete: if isOwner(uid);
          allow create, update: if isOwner(uid) && ownerSet();
        }
      }

      // ---- Conversations (optional projectId → validProjectRef) ----
      match /conversations/{conversationId} {
        allow read, delete: if isOwner(uid);
        allow create, update: if isOwner(uid) && ownerSet() && validProjectRef(uid);

        match /messages/{messageId} {
          allow read, delete: if isOwner(uid);
          allow create, update: if isOwner(uid) && ownerSet();
        }
      }

      // ---- Analyses: client-READ-only (API.md §8; ADR-009/015).
      // Created exclusively by the backend AI pipeline via Admin SDK. ----
      match /analyses/{analysisId} {
        allow read: if isOwner(uid);
        allow write: if false;
      }

      // ---- Research tasks (optional projectId → validProjectRef) ----
      match /researchTasks/{taskId} {
        allow read, delete: if isOwner(uid);
        allow create, update: if isOwner(uid) && ownerSet() && validProjectRef(uid);
      }

      // ---- Derived search index (ADR-017): path-isolated like all
      // user data; the backend maintains it on observation writes. ----
      match /observationSearch/{observationId} {
        allow read, delete: if isOwner(uid);
        allow create, update: if isOwner(uid) && ownerSet();
      }
    }
  }
}
```

> **Context-ID note:** `conversations.contextId` ownership (observation/project/analysis) is validated by the **backend** on create (rules `get()` chains across entity types add no security here — everything already sits in the caller's own subtree — and would complicate rules). Backend validation is the enforcing layer for this field (SECURITY.md §6/§8 defense-in-depth split).

---

## 3. Backend Implementation

### 3.0 Config & type updates (do these first — existing files)

* `backend/src/config/env.ts`: add **required** `FIREBASE_PROJECT_ID: z.string().min(1)` (fail fast, TA §44). Update `backend/.env.example` to uncomment it and add `FIRESTORE_EMULATOR_HOST=localhost:8082` / `FIREBASE_AUTH_EMULATOR_HOST=localhost:9099` (commented, dev-only).
* `backend/vitest.config.ts` (new): define `test.env.FIREBASE_PROJECT_ID = "demo-test"` so unit tests that import `env.ts` (fail-fast module init) remain hermetic.
* `backend/src/types/express.d.ts`: extend the existing declaration with `user?: { uid: string; email?: string }`.
* `backend/package.json`: add `"test:security": "vitest run tests/security"`.
* Mount `requireAuth` on the `/api/v1` router (routes/index.ts) — business endpoints authenticated; `/api/health` stays public (API.md §6.1).

### 3.1 Firebase Admin init (`backend/src/lib/firebaseAdmin.ts`)

* **Lazy singleton** — initialize on first use, never at module import (keeps non-Firebase tests and the Phase 1 health route free of Admin SDK side effects).
* With `FIREBASE_AUTH_EMULATOR_HOST` set, `verifyIdToken` works against the Auth Emulator with only `projectId` — **no service-account JSON locally** (SECURITY.md §17: no credentials on dev machines/repo). In production (Cloud Run), Application Default Credentials resolve to the runtime service account automatically.

### 3.2 Auth middleware (`backend/src/middleware/authMiddleware.ts`)

* Extract `Bearer <token>`; verify via `auth().verifyIdToken(token)`; set `req.user = { uid, email }`.
* Missing/invalid/expired/malformed → `401 UNAUTHENTICATED` envelope with `requestId`.
* UID comes **only** from the verified token; client-supplied `uid`/`ownerId` in body/query/header is ignored (API.md §2.1, SECURITY.md §8).

### 3.3 User repository (`backend/src/repository/userRepository.ts`)

* `findOrCreateUser(uid, tokenClaims)`: creates `users/{uid}` on first request with `ownerId: uid` (DATABASE_SCHEMA §4 denormalization invariant — the §5.1 example omits it because the doc ID *is* the uid; we set it anyway for rule-level consistency), `role: "user"`, `accountStatus: "active"`, default preferences `{ theme: "system", timezone: "UTC", locationEnabled: true, aiSuggestionsEnabled: true }`, displayName/email/photoURL from verified claims. Refreshes `lastLoginAt` (server timestamps) on every call.
* `updateUserProfile(uid, patch)`: applies validated patch; `updatedAt` server timestamp.

### 3.4 User schemas (`backend/src/schemas/userSchema.ts`)

Zod for `PATCH /api/v1/me` (API.md §6.2): `displayName` 1–100; `photoURL` valid HTTPS ≤ 2048; `preferences` object (`theme` enum, IANA timezone string, two booleans). `.strict()` so unknown fields — and explicitly `role`, `accountStatus`, `createdAt`, `ownerId` — are rejected with `400 VALIDATION_ERROR`.

### 3.5 Me routes (`backend/src/routes/me.ts`)

* `GET /api/v1/me` → `findOrCreateUser` → `200 { data: { user } }`.
* `PATCH /api/v1/me` → Zod validate → `updateUserProfile` → `200 { data: { user } }`.
* Wire into `apiV1Router`.

---

## 4. Frontend Integration

### 4.1 Firebase client config (`frontend/src/lib/firebase/config.ts`)

`initializeApp` + `getAuth` from **all four** `VITE_FIREBASE_*` vars (API_KEY, AUTH_DOMAIN, PROJECT_ID, APP_ID — see `frontend/.env.example`). In dev with `VITE_USE_FIREBASE_EMULATORS=true`, `connectAuthEmulator(auth, "http://localhost:9099")`.

### 4.2 Auth state provider (`frontend/src/lib/firebase/authContext.tsx`)

`AuthProvider` + `useAuth()` exposing `currentUser`, `loading`, `signInWithGoogle()`, `signOut()`. Persistence via the SDK default (`browserLocalPersistence`) — survives sessions (PRD FR-01).

### 4.3 API client token attachment — **reuse the Phase 1 seam**

Phase 1's `frontend/src/lib/api.ts` ships `setAuthTokenProvider()` precisely for this. Do **not** create a second client; wire it once at app init:

```typescript
setAuthTokenProvider(() => auth.currentUser?.getIdToken() ?? null);
```

### 4.4 Minimal auth gate (UI)

* `AuthProvider` wraps the app in `providers.tsx`.
* Landing page: Google sign-in button when signed out; "signed in as … + sign out" when signed in (full pages arrive in Phase 3 — this is the FR-01 end-to-end proof, nothing more).
* Lightweight `loading` state while auth state resolves (no flash of signed-out UI).

---

## 5. Security & Isolation Testing

### 5.1 Firestore Rules suite (`backend/tests/security/rules.test.ts`)

`@firebase/rules-unit-testing` + test ID tokens, against the Firestore emulator (port 8082). **Both positive and negative paths** — a negative-only suite cannot catch a broken-read rule (TESTING.md §6 matrix):

* **Positive (owner CAN)**: read/create/update own docs in projects, observations, conversations, messages, researchTasks, media, observationSearch; **delete own observation**; read own user doc and own `versions`/`analyses`.
* **Negative (owner CANNOT)**: write `versions` or `analyses` at all; create a user doc with `role: "admin"` or `accountStatus: "suspended"`; change `role`/`accountStatus`/`createdAt` on update; change `ownerId` on update.
* **Cross-user (User A → User B)**: read/write/delete denied across all collections; `projectId` referencing User B's project denied.
* **Unauthenticated**: everything denied.
* **`projectId` integrity**: create/update with owned `projectId` allowed; missing/`null` `projectId` (unfiled) allowed; foreign or nonexistent `projectId` denied; **delete with a now-foreign `projectId` still allowed** (guards the `request.resource`-on-delete pitfall).

### 5.2 API authorization suite (`backend/tests/security/isolation.test.ts`)

Vitest + Supertest. **Token mechanics:** mint real tokens for User A / User B via the Auth Emulator REST API — no mocks of the verification path, no live network (TESTING.md §13). Phase 2 scope:

* No `Authorization` header → `401 UNAUTHENTICATED`; invalid/expired/garbage token → `401`.
* Valid token → `200`; user doc auto-created with defaults; `lastLoginAt` refreshed on repeat.
* Client-supplied `uid`/`ownerId` in body/query is ignored — identity derives from the token only.
* `PATCH /me` rejects `role`, `accountStatus`, unknown fields → `400 VALIDATION_ERROR` (immutables named, per API.md §6.2).
* **Deferred to Phase 3 (fixtures land now):** the existence-hiding `404` cross-resource matrix — no id-scoped route exists yet (`/me` takes none). The multi-user fixture set (TESTING.md §12) is built here so Phase 3 activates it, not re-creates it.

### 5.3 CI wiring (TESTING.md §15: security suites are PR-gated and emulator-backed)

* Backend CI job: run tests inside `firebase emulators:exec --only firestore,auth "npm test"` (or a dedicated `test:security` step) so rules + isolation suites execute on every PR. `firebase-tools` as a dev dependency (or npx) — Java is preinstalled on `ubuntu-latest` runners.
* Local: `firebase emulators:start --only firestore,auth` (JDK 11+ required), then `npm run test:security` against `localhost:8082`.

---

## 6. Definition of Done (Phase 2 Verification)

1. `npm --prefix backend run test:security` passes the full rules matrix (positive + negative, §5.1) and the API isolation suite (§5.2) against the emulators; CI runs them on PR (§5.3).
2. Sign-in works end-to-end in the browser against the Auth Emulator: Google sign-in, page reload persistence, sign-out (PRD FR-01); the Firebase ID token reaches the backend via the Phase 1 `setAuthTokenProvider` seam.
3. `GET /api/v1/me` → `200` with the user document envelope (lazy creation, default preferences, refreshed `lastLoginAt`); `PATCH /api/v1/me` updates allowed fields and rejects `role`/`accountStatus`/unknown fields with `400 VALIDATION_ERROR`.
4. Firestore rules: cross-user and unauthenticated access denied across all canonical collections; `versions`/`analyses` deny all direct client writes; every positive owner path verified (§5.1) — in the emulator.
5. All five composite indexes of DATABASE_SCHEMA.md §18 present in `firebase/firestore.indexes.json`; emulators boot cleanly from root `firebase.json` (ports 9099 / 8082 / 4000).
6. CI stays green: lint, typecheck, unit tests, build, plus the new emulator-backed security suites.
7. No secrets committed: no service-account JSON, no real `.env`; `.env.example` files updated with placeholder names only.
