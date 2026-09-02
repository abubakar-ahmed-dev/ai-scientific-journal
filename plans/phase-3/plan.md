# Phase 3 — Core Domain CRUD: Implementation Plan

**Source plan:** `plans/IMPLEMENTATION_PLAN.md` §3 Phase 3  
**Governing docs:** PRD.md (FR-01, FR-02, FR-04, FR-06, FR-11, FR-12); TECHNICAL_ARCHITECTURE.md (§11–§16, §54, §77); SECURITY.md (§5, §6, §8, §24, §34); DATABASE_SCHEMA.md (§5.1, §6, §7, §8, §9, §16, §18, §19); API.md (§5, §6.2–§6.7); ADR.md (ADR-013, ADR-014, ADR-016, ADR-017)  
**Branch:** `feature/phase-3-core-crud` (off `dev` — never work on `main`)

---

## 0. Phase Goal & Overview

Phase 3 implements the **AI-independent core domain**:
1. User profile management (`GET|PATCH /api/v1/me`).
2. Optional Projects organizational layer (`/api/v1/projects`).
3. Fundamental Observations record CRUD (`/api/v1/observations`) with scientific measurements, location precision, cursor pagination (`sort=updated|observed`), optimistic locking (`expectedVersion`), and deletion cascades.
4. Internal Observation Versioning snapshotting & read-only history (`/api/v1/observations/:id/versions`).
5. Derived search index sync (`users/{uid}/observationSearch/{id}`).
6. Complete frontend SPA flows (Dashboard, Observations List/Detail/Form, Projects List/Detail, Settings/Profile).

---

## 1. Prerequisites Check & Dependencies

Before beginning implementation:
- Confirm Phase 1 foundation (Express API, React Vite SPA, Vitest, CI docker setup) and Phase 2 security foundation (Firebase Auth ID token verification middleware, `users/{uid}` path security rules, user context) are present or ready to connect.
- Working environment check:
  ```bash
  npm run dev:backend
  npm run dev:frontend
  ```

---

## 2. Backend — Data Repositories & Schemas

### 2.1 Repositories (`backend/src/repositories/`)
- `user.repository.ts`:
  - `findOrCreate(uid, tokenPayload)`: Lazy profile creation/refresh on auth request, updating `lastLoginAt`.
  - `update(uid, patchData)`: Updates `displayName`, `photoURL`, `preferences`. Rejects immutable fields (`role`, `accountStatus`, `createdAt`).
- `project.repository.ts`:
  - `create(uid, data)`: Creates project with status `active`, server timestamps.
  - `list(uid, { limit, cursor, status })`: Cursor-paginated query ordered by `updatedAt DESC`.
  - `findById(uid, projectId)`: Fetches project document, enforcing UID path isolation (returns `null` if foreign or missing).
  - `update(uid, projectId, patchData, expectedVersion?)`: Updates project fields; sets `archivedAt` if status transitions to `archived`.
  - `delete(uid, projectId)`: Hard deletes project document and triggers side effect: sets `projectId = null` for observations, conversations, and research tasks owned by `uid` referencing this project; analyses retain their `projectId` unchanged (ADR-021 — append-only, never mutated).
- `observation.repository.ts`:
  - `create(uid, data)`: Validates ownership of `projectId` (if provided). Initializes `version: 1`, `mediaCount: 0`, server-managed fields (`ownerId`, `status: "observed" | "draft"`). Writes observation to `users/{uid}/observations/{id}`. Schedules async index upsert (`ObservationSearchRepository.upsert`) — an index-write failure never fails the observation write (ADR-017, PRD NFR-02).
  - `list(uid, { limit, cursor, sort, projectId, status, tag, q })`:
    - Handles cursor pagination for stable `sort=updated` (`updatedAt DESC`) and scientific `sort=observed` (`observedAt DESC`).
    - Filters: `projectId` (including `unfiled`), `status`, `tag` (array-contains), `q` (text search prefilter).
  - `findById(uid, observationId)`: Returns observation document (returns `null` if foreign or missing for existence-hiding 404).
  - `update(uid, observationId, patchData, expectedVersion?)`:
    - Checks `expectedVersion` match (`409 CONFLICT` on mismatch).
    - Snapshots prior state to `ObservationVersionRepository.create(...)` prior to update.
    - Increments `version`.
    - Updates `users/{uid}/observations/{id}` and syncs `ObservationSearchRepository.upsert(...)`.
  - `delete(uid, observationId)`:
    - Cascades deletion to subcollections: `versions/*`, `media/*` (metadata and Cloud Storage objects), and derived `users/{uid}/observationSearch/{id}`.
    - Retains `analyses` documents referencing this observation as soft dangling references per §19.
- `observation-version.repository.ts`:
  - `create(uid, observationId, snapshotData)`: Creates immutable snapshot in `users/{uid}/observations/{observationId}/versions/{versionId}`. Path-inherited ownership (no `ownerId` field).
  - `list(uid, observationId, { limit, cursor })`: Lists version history ordered by `editedAt DESC`.
  - `findById(uid, observationId, versionId)`: Retrieves specific historical snapshot.
- `observation-search.repository.ts`:
  - `upsert(uid, observationId, searchData)`: Writes/updates derived search document `users/{uid}/observationSearch/{observationId}` (ADR-017).
  - `delete(uid, observationId)`: Removes derived search document on observation deletion.

### 2.2 Validation Schemas (`backend/src/schemas/`)
- `me.schema.ts`: Zod schema for `PATCH /api/v1/me` validating `displayName` (1-100), `photoURL` (valid HTTPS URL <= 2048), `preferences` object (`theme`, IANA `timezone`, booleans). Strict rejection of unknown/immutable fields.
- `project.schema.ts`: Zod schemas for `POST` (title 1-200, description <= 5000, field <= 100, tags <= 20) and `PATCH` (including `status: active|archived|completed`, `expectedVersion`).
- `observation.schema.ts`:
  - `MeasurementSchema`: `id`, `name` (1-50), `value` (finite number), `unit` (1-50), optional `observedAt`, `notes`.
  - `LocationSchema`: `latitude` (-90..90), `longitude` (-180..180), optional `accuracyMeters`, `label`, `precision` (`exact` | `approximate` | `hidden`).
  - `CreateObservationSchema`: `title` (1-200), `description` (1-20000), optional `projectId`, `notes`, `hypothesis`, `observedAt` (valid date, not > 5 min in future), `location`, `tags` (<= 20), `measurements` (<= 50), `status` (`draft` | `observed`). Strictly rejects client-supplied `ownerId`, `version`, `mediaCount`, `status: "analyzed"`.
  - `UpdateObservationSchema`: Partial fields + optional `expectedVersion` (number).
  - `ListObservationsQuerySchema`: `limit` (1-100), `cursor`, `sort` (`updated` | `observed`), `projectId`, `status`, `tag`, `q`.

---

## 3. Backend API Endpoints & Routes (`backend/src/routes/`)

- `me.routes.ts`:
  - `GET /api/v1/me`: Calls `userRepository.findOrCreate`, returns 200 `{ data: user }`.
  - `PATCH /api/v1/me`: Validates body, calls `userRepository.update`, returns 200 `{ data: user }`.
- `project.routes.ts`:
  - `POST /api/v1/projects`: Idempotency-Key support, validates body, creates project, returns 201 `{ data: project }`.
  - `GET /api/v1/projects`: Validates pagination query, returns 200 `{ data: [projects], meta: pagination }`.
  - `GET /api/v1/projects/:projectId`: Returns 200 `{ data: project }` or 404 `NOT_FOUND`.
  - `PATCH /api/v1/projects/:projectId`: Validates body, updates project, returns 200 `{ data: project }`.
  - `DELETE /api/v1/projects/:projectId`: Returns 204. Re-files observations/conversations/research tasks to `projectId = null`; analyses retain `projectId` (ADR-021).
- `observation.routes.ts`:
  - `POST /api/v1/observations`: Idempotency-Key support, validates body, creates observation & search index entry, returns 201 `{ data: observation }`.
  - `GET /api/v1/observations`: Validates query params, lists observations, returns 200 `{ data: [observations], meta: pagination }`.
  - `GET /api/v1/observations/:observationId`: Returns 200 `{ data: observation }` or 404 `NOT_FOUND`.
  - `PATCH /api/v1/observations/:observationId`: Validates body & `expectedVersion`, creates internal version snapshot, updates observation & search index, returns 200 `{ data: observation }` (or 409 `CONFLICT`).
  - `DELETE /api/v1/observations/:observationId`: Cascades subcollection and search index deletion, returns 204.
  - `GET /api/v1/observations/:observationId/versions`: Lists version history for observation, returns 200 `{ data: [versions], meta: pagination }`.
  - `GET /api/v1/observations/:observationId/versions/:versionId`: Returns 200 `{ data: version }` or 404 `NOT_FOUND`.

---

## 4. Frontend Application Integration (`frontend/src/`)

### 4.1 State & API Client
- Expand `frontend/src/lib/api.ts` with API methods for `me`, `projects`, `observations`, `versions`.
- React Query hooks (`useUser`, `useProjects`, `useObservations`, `useObservation`, `useObservationVersions`, `useCreateObservation`, `useUpdateObservation`, `useDeleteObservation`, `useCreateProject`, `useUpdateProject`, `useDeleteProject`).

### 4.2 UI Pages & Components
- **Layout & App Shell**: Authenticated navigation bar, user profile dropdown, project switcher / sidebar.
- **Dashboard (`/dashboard`)**: Summary cards (total observations, active projects, recent activity), quick entry button.
- **Observations List View (`/observations`)**:
  - Filter bar: Project filter dropdown, Status filter, Tag pills, Search input (`q`), Sort toggle (`sort=updated` vs `sort=observed`).
  - Cursor-paginated observation cards/table with metadata tags, measurement summary badges, location indicator.
- **Observation Create / Edit Form (`/observations/new`, `/observations/:id/edit`)**:
  - Form fields: Title, Description, Project selector, Scientific Timestamp (`observedAt`), Location fields (lat, lng, label, precision selector `exact|approximate|hidden`), Measurements dynamic array manager (name, value, unit), Tags input.
  - Optimistic locking error handling (prompts user to reload when 409 Conflict occurs).
- **Observation Detail View (`/observations/:id`)**:
  - Full view of observation content, measurements table, location badge/details, actions (Edit, Delete).
  - Version History panel: Drawer or tab displaying version timeline with previous content snapshots.
- **Projects Views (`/projects`, `/projects/:id`)**:
  - Project list view, create/edit project modal.
  - Project detail page showing filtered observations.
- **Settings / Profile (`/settings`)**: Form to view and update user profile & preferences.

---

## 5. Verification & Testing Plan

### 5.1 Backend Unit & Integration Tests
- Repository unit tests: Validate CRUD, Zod schema constraints, and timestamp behaviors against Firestore emulator.
- Endpoint API tests (`backend/tests/integration/`):
  - `me.test.ts`: Verify profile lazy creation, updating preferences, and rejection of immutable fields (`role`, `accountStatus`, `createdAt`).
  - `projects.test.ts`: Verify CRUD, `archivedAt` timestamp behavior, and project deletion: re-filing `projectId = null` on observations/conversations/research tasks while analyses retain their `projectId` (ADR-021).
  - `observations.test.ts`: Verify CRUD, default values (`version: 1`, `mediaCount: 0`), client-supplied `ownerId` rejection, `expectedVersion` 409 conflict, `sort=updated` vs `sort=observed` pagination, and full deletion cascades (`versions`, `media`, `observationSearch`).
  - `versions.test.ts`: Verify automatic snapshot creation on PATCH and read-only version history lookup.

### 5.2 Multi-User Isolation Tests (`SECURITY.md` §34)
- Run User A vs User B isolation matrix:
  - User B attempting `GET /api/v1/observations/:id` of User A returns `404 NOT_FOUND` (existence hiding).
  - User B attempting `PATCH` or `DELETE` of User A's projects, observations, or versions returns `404 NOT_FOUND`.
  - User B listing observations or projects never receives User A's data.

### 5.3 Frontend Verification
- Unit & component tests using Vitest (`frontend/src/pages/Observations.test.tsx`, `frontend/src/pages/ObservationDetail.test.tsx`).
- Run `npm run typecheck`, `npm run lint`, `npm run test` in both frontend and backend.
