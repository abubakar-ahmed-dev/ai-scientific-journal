# Phase 7 — Media, Location & Research Map: Implementation Plan

**Source plan:** `plans/IMPLEMENTATION_PLAN.md` §3 Phase 7  
**Governing docs:** `PRD.md` (FR-11, FR-12, FR-13, NFR-02); `TECHNICAL_ARCHITECTURE.md` (§5.3, §5.4, §9, §47, §54, §66, §845, §2659); `SECURITY.md` (§8, §14, §15, §16); `DATABASE_SCHEMA.md` (§7, §10, §19); `API.md` (§1.4, §6.8, §6.9, §8); `ADR.md` (ADR-014, ADR-016, ADR-018, ADR-020, ADR-021, ADR-022); `TESTING.md` (§4, §6, §7).  
**Branch:** `feature/phase-7-media-location-map` (off `dev` — never work directly on `main`)

---

## 0. Phase Goal & Overview

Phase 7 delivers the experiential differentiators of empirical observation recording in the Scientific AI Journal:

1. **Private Observation-Scoped Evidence Media (`users/{uid}/observations/{observationId}/media/{mediaId}`)**:
   - Upload, read, and delete endpoints (`POST|GET|DELETE /api/v1/observations/:observationId/media[/:mediaId]`).
   - Strict MIME type, magic-byte, and size limits (image ≤ 10 MB, audio ≤ 25 MB, video ≤ 100 MB).
   - Backend-derived private Cloud Storage object paths (`users/{uid}/observations/{observationId}/{mediaId}` — strictly **no** `media/` segment in storage path per ADR-016).
   - Storage path is internal-only: **never exposed in any API response or client payload**.
   - Binary read access exclusively flows through authenticated endpoints returning short-lived authorized URLs (≤ 15 minutes TTL).
   - Atomic denormalized `observation.mediaCount` maintenance and orphan storage object cleanup.
   - Decides and documents **ADR-023: Firebase Admin Storage Client for Observation Media** (resolving storage client deferral from ADR-020).

2. **Location Precision & Geolocation Privacy**:
   - Location capture using browser standard Geolocation API (`navigator.geolocation`) with manual coordinate and pin adjustment.
   - Strict enforcement of the `LocationDTO` precision enum: `exact | approximate | hidden`.
   - **Privacy rule**: `hidden` coordinates are never rendered on public/map displays and are stripped from AI context windows.
   - `approximate` coordinates render with an uncertainty circle or fuzzed precision.

3. **Interactive Research Map (`/map` and PRD FR-13)**:
   - Visual geographic dashboard of user observations.
   - Interactive observation pins with click-to-inspect popups, tags, dates, and direct links to `/observations/:id`.
   - Category, project, date range, and tag filters.
   - Decides and documents **ADR-024: Leaflet and OpenStreetMap for Research Map** (resolving maps provider deferral from ADR-020, enabling 100% free, zero-key, privacy-first map rendering).

4. **Observation Detail Media Gallery & Mini Map**:
   - Media gallery component on `ObservationDetailPage` displaying thumbnails, audio playback, video players, and captions.
   - Non-blocking location card displaying precision badges and location label.

---

## 1. Prerequisites & Existing Context (Verified against working tree)

The codebase already contains foundational scaffolding for Phase 7:

- **Firestore Observation Schema (`DATABASE_SCHEMA.md` §7, `backend/src/schemas/observationSchema.ts`)**:
  - `LocationSchema` already exists with:
    - `latitude: number` (-90 to 90)
    - `longitude: number` (-180 to 180)
    - `accuracyMeters: number | null`
    - `label: string | null`
    - `precision: "exact" | "approximate" | "hidden"`
  - `ObservationDocument` in `backend/src/repository/observationRepository.ts` already stores `location: LocationDTO | null` and `mediaCount: number`.
- **Firestore Security Rules (`firebase/firestore.rules` L57–L60)**:
  - Subcollection `users/{uid}/observations/{observationId}/media/{mediaId}` is already restricted to owner-only read and delete:
    ```firestore
    match /media/{mediaId} {
      allow read, delete: if isOwner(uid);
      allow create, update: if isOwner(uid) && ownerSet();
    }
    ```
- **Frontend Observation Form (`frontend/src/pages/ObservationFormPage.tsx` L323–L388)**:
  - Form state already has `hasLocation`, `latitude`, `longitude`, `locationLabel`, and `precision` input fields.
- **Firebase Admin App (`backend/src/lib/firebaseAdmin.ts`)**:
  - `getFirebaseAdminApp()` is initialized and exported; adding `getFirebaseStorage()` integrates directly with `firebase-admin/storage`.
- **Cascade Deletion Model (`DATABASE_SCHEMA.md` §19, `backend/src/repository/observationRepository.ts` L352–L358)**:
  - `observationRepository.delete` already deletes `versions` and `media` Firestore subcollections; Phase 7 attaches storage object deletion to this cascade.

---

## 2. Architecture & Design Rules

1. **Backend Derives All Storage Paths; Clients Never Transmit Storage Paths (ADR-016, SECURITY §15)**:
   - Storage path format: `users/{uid}/observations/{observationId}/{mediaId}`.
   - **Path disambiguation rule**: Firestore metadata lives at `users/{uid}/observations/{observationId}/media/{mediaId}` (with `media/`), while Cloud Storage binary path has **no** `media/` segment.
   - `storagePath` is backend-internal and **must never be present in any API response**.
2. **Observation-Scoped Access Only (API.md §6.8, §8)**:
   - There is NO global `/media/:mediaId` route. All access is scoped to `/api/v1/observations/:observationId/media/:mediaId`.
   - Access to foreign observations or non-existent media returns `404 NOT_FOUND` (existence-hiding per `SECURITY.md` §6).
3. **Short-Lived Authorized Read URLs Only (SECURITY §15, API §6.9)**:
   - Raw Cloud Storage objects are never made public.
   - Reading binary files is done via `GET …/media/:mediaId` returning `data.url` signed for ≤ 15 minutes TTL (or streaming via backend in local/emulator mode).
4. **Untrusted Binary File Validation (SECURITY §15)**:
   - Content-type inspection and MIME validation must reject executable files, scripts, or mismatching extensions.
   - Size limits enforced before storing: Images ≤ 10 MB, Audio ≤ 25 MB, Video ≤ 100 MB.
5. **Location Privacy Enforcement (SECURITY §14, PRD FR-12)**:
   - If `location.precision === "hidden"`, coordinates must **never** be rendered on the research map or sent to Gemini prompts.
   - If `approximate`, coordinates must be displayed with an uncertainty circle or rounded/fuzzed.
   - Location is strictly optional; observation creation must never require location permission.
6. **Zero External Billing / Free Tier Principle (PRD §8, ADR-020)**:
   - The map implementation uses **Leaflet + OpenStreetMap** (`react-leaflet`), avoiding paid Google Maps Platform API keys and credit card requirements.
   - Local development and tests use **Firebase Storage Emulator** / local storage adapter.

---

## 3. Architecture Decision Records (ADRs) to Document

### ADR-023: Firebase Admin Storage Client for Observation Media
- **Status:** Accepted
- **Context:** ADR-020 deferred the storage client decision between Firebase Storage SDK and `@google-cloud/storage`.
- **Decision:** Use `firebase-admin/storage` via `getStorage(getFirebaseAdminApp()).bucket(env.STORAGE_BUCKET)`.
- **Rationale:** Seamlessly binds with existing `firebase-admin` credentials, supports `FIREBASE_STORAGE_EMULATOR_HOST` automatically for local offline execution, and provides standard signed URL generation.

### ADR-024: Leaflet and OpenStreetMap for Research Map
- **Status:** Accepted
- **Context:** ADR-020 deferred the map provider between Google Maps Platform and Leaflet/OSM.
- **Decision:** Use Leaflet (`leaflet`, `react-leaflet`) with OpenStreetMap standard tiles for the interactive Research Map.
- **Rationale:** Completely free and open-source, requires **zero API keys**, incurs zero infrastructure cost, respects user privacy by not transmitting tracking telemetry to third-party ad networks, and works out-of-the-box in local development.

---

## 4. Implementation Tasks Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 7 IMPLEMENTATION FLOW                            │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Task 1: Storage Infra & Repo  │ IStorageService, MediaRepository, ADRs      │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Task 2: Media Endpoints       │ POST/GET/DELETE Media, Multer, Validations  │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Task 3: Location & Privacy    │ Geolocation capture, precision-fuzzing/hide │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Task 4: Research Map & UI     │ Leaflet Map (/map), MediaGallery, Popups    │
└───────────────────────────────┴─────────────────────────────────────────────┘
```

---

### Task 1: Media Storage Infrastructure, Repository & ADRs

#### 1.1 Environment Configuration
- **File:** `backend/src/config/env.ts` & `backend/tests/unit/env.test.ts`
- Add validated environment variables with safe defaults:
  ```typescript
  STORAGE_BUCKET: z.string().default("ai-scientific-journal-media"),
  MEDIA_MAX_IMAGE_SIZE_BYTES: z.coerce.number().int().default(10 * 1024 * 1024), // 10MB
  MEDIA_MAX_AUDIO_SIZE_BYTES: z.coerce.number().int().default(25 * 1024 * 1024), // 25MB
  MEDIA_MAX_VIDEO_SIZE_BYTES: z.coerce.number().int().default(100 * 1024 * 1024), // 100MB
  MEDIA_SIGNED_URL_TTL_MINUTES: z.coerce.number().int().default(15),
  ```

#### 1.2 Storage Service Abstraction
- **File:** `backend/src/storage/storageService.ts`
- Interface `IStorageService`:
  ```typescript
  export interface IStorageService {
    upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<void>;
    getSignedReadUrl(storagePath: string, ttlMinutes: number): Promise<string>;
    delete(storagePath: string): Promise<void>;
    deletePrefix(prefix: string): Promise<void>;
  }
  ```
- Implement `FirebaseStorageService` using `firebase-admin/storage`.
  - When running against the emulator or local environment without signing keys, generate a local authorized gateway URL or mock signed URL.
- Implement `MockStorageService` in memory for deterministic unit and integration tests.
- Provide singleton accessor `getStorageService()` and injector `setStorageService()` for testing.

#### 1.3 Media Repository
- **File:** `backend/src/repository/mediaRepository.ts`
- Subcollection: `users/{uid}/observations/{observationId}/media/{mediaId}`
- Interface `MediaDocument`:
  ```typescript
  export interface MediaDocument {
    id: string;
    ownerId: string;
    observationId: string;
    type: "image" | "audio" | "video";
    storagePath: string; // internal only
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    caption: string | null;
    createdAt: string | Timestamp;
  }
  ```
- Methods:
  - `create(uid, observationId, data)`: Generates `mediaId`, derives storage path (`users/${uid}/observations/${observationId}/${mediaId}`), writes metadata, atomically increments `observation.mediaCount`.
  - `findById(uid, observationId, mediaId)`: Retrieves metadata document.
  - `listByObservationId(uid, observationId)`: Lists all media for an observation ordered by `createdAt ASC`.
  - `delete(uid, observationId, mediaId)`: Deletes Firestore metadata document and atomically decrements `observation.mediaCount`.
  - `countByObservationId(uid, observationId)`: Counts current media attachments.

#### 1.4 Hardening Observation Deletion Cascade
- **File:** `backend/src/repository/observationRepository.ts`
- Update `delete(uid, observationId)`:
  - Before or during Firestore deletion, call `storageService.deletePrefix(`users/${uid}/observations/${observationId}/`)` to guarantee zero orphan storage objects remain.

#### 1.5 Architecture Documentation
- **File:** `docs/ADR.md`
  - Append `ADR-023: Firebase Admin Storage Client for Observation Media`.
  - Append `ADR-024: Leaflet and OpenStreetMap for Research Map`.

#### 1.6 Verification
- Unit test suite: `backend/tests/unit/mediaRepository.test.ts`
- Storage service test suite: `backend/tests/unit/storageService.test.ts`

---

### Task 2: Media Endpoints & Upload Pipeline

#### 2.1 Media Validation Schemas
- **File:** `backend/src/schemas/mediaSchema.ts`
- Allowed MIME types mapping:
  - Image: `image/jpeg`, `image/png`, `image/webp`, `image/heic`
  - Audio: `audio/mpeg`, `audio/mp4`, `audio/wav`
  - Video: `video/mp4`
- Type determination helper: `detectMediaType(mimeType: string): "image" | "audio" | "video"`.
- Zod schema for upload metadata:
  ```typescript
  export const UploadMediaMetadataSchema = z.object({
    caption: z.string().trim().max(500, "Caption cannot exceed 500 characters").optional(),
  });
  ```
- Response serializer: `serializeMediaResponse(doc: MediaDocument, signedUrl?: string)`:
  - Strictly omits `storagePath`.
  - Includes `id`, `ownerId`, `observationId`, `type`, `fileName`, `mimeType`, `sizeBytes`, `caption`, `createdAt`, and optional `url`.

#### 2.2 Upload Middleware
- **File:** `backend/src/middleware/mediaUpload.ts`
- Multer configuration in memory:
  - Memory storage (`multer.memoryStorage()`).
  - Limits: file size max 100 MB (individual limits checked dynamically per type).
  - File filter: validates MIME type against allowed list; rejects unsupported types with `415 UNSUPPORTED_MEDIA_TYPE`.

#### 2.3 Express Route Handlers
- **File:** `backend/src/routes/media.ts`
- Mount observation media sub-router: `/api/v1/observations/:observationId/media`
  - `POST /`:
    - Validates caller owns parent observation (`404` if not found or foreign).
    - Validates file presence (`400 VALIDATION_ERROR` if missing).
    - Checks size limits per detected media type (`413 PAYLOAD_TOO_LARGE`).
    - Idempotency check: if `Idempotency-Key` provided, deduplicates if already processed.
    - Uploads binary to storage: `storageService.upload(storagePath, req.file.buffer, req.file.mimetype)`.
    - On storage failure: returns `500 INTERNAL_ERROR` (no metadata created).
    - Writes metadata to Firestore via `mediaRepository.create`.
    - If metadata creation fails: best-effort rollback deletes uploaded storage object.
    - Returns `201 CREATED` with serialized media metadata.
  - `GET /`:
    - Validates observation ownership.
    - Lists all media for the observation.
    - Generates signed URLs for each media item and returns `{ data: mediaWithUrls[] }`.
  - `GET /:mediaId`:
    - Validates observation and media ownership (`404` if foreign or missing).
    - Generates short-lived signed URL via `storageService.getSignedReadUrl(media.storagePath, TTL)`.
    - Returns `200 OK` with `{ data: { ...media, url } }`.
  - `DELETE /:mediaId`:
    - Validates observation and media ownership.
    - Deletes storage binary object via `storageService.delete(media.storagePath)`.
    - Deletes Firestore document and decrements `mediaCount` via `mediaRepository.delete`.
    - Returns `204 NO_CONTENT`.

#### 2.4 Mount Router
- **File:** `backend/src/app.ts`
- Register `observationsRouter.use("/:observationId/media", mediaRouter)`.

#### 2.5 Integration Tests
- **File:** `backend/tests/integration/mediaEndpoints.test.ts`
  - Upload JPEG image → `201`, `mediaCount` becomes 1, `storagePath` omitted.
  - Upload audio file (MP3) → `201`.
  - Upload video file (MP4) → `201`.
  - Upload oversized image (> 10MB) → `413 PAYLOAD_TOO_LARGE`.
  - Upload unsupported MIME (e.g. `application/x-msdownload`, `.exe`, `.pdf`) → `415 UNSUPPORTED_MEDIA_TYPE`.
  - Get media detail → `200` with `data.url`.
  - Delete media → `204`, storage object deleted, `mediaCount` decremented.
  - Cross-user probe: User B cannot read or upload media to User A's observation (`404`).

---

### Task 3: Location Geolocation & Privacy Rules

#### 3.1 AI Context Location Privacy Enforcement
- **Files:**
  - `backend/src/ai/retrieval/retrievalService.ts`
  - `backend/src/ai/prompts/askGroundedAnswerPrompt.ts`
  - `backend/src/ai/prompts/observationAnalysisPrompt.ts`
- Privacy Rules:
  - If `observation.location.precision === "hidden"`:
    - **Never** place latitude, longitude, or specific location coordinates into prompt `<context_data>`.
    - Only display label if provided, or omit location entirely.
  - If `observation.location.precision === "approximate"`:
    - Round coordinates to 1 decimal place (~11 km) or display label only, preventing pinpoint tracking.
  - If `exact`:
    - Full coordinates permitted in context.

#### 3.2 Frontend Geolocation Capture
- **File:** `frontend/src/pages/ObservationFormPage.tsx`
- Add "Get Current Location" button using `navigator.geolocation.getCurrentPosition`:
  - Loading state while querying GPS hardware.
  - Handles permission denied gracefully: displays informational toast/alert without blocking manual entry.
  - Populates `latitude`, `longitude`, and `accuracyMeters`.
- Add Location Precision helper tooltips:
  - **Exact**: Pinpoints exact coordinates for detailed field maps.
  - **Approximate**: General area / fuzzed precision for sensitive sites or wildlife protection.
  - **Hidden**: Geographic data kept private; never plotted on public or general maps.

---

### Task 4: Research Map Page & Media Gallery UI

#### 4.1 Frontend Dependencies & Leaflet Setup
- **Dependencies:** Install `leaflet` and `react-leaflet`, plus `@types/leaflet`.
- Configure Leaflet default marker icons (fixing Vite asset bundling path quirk for marker images).
- Import `leaflet/dist/leaflet.css`.

#### 4.2 Frontend API Client Extensions
- **File:** `frontend/src/lib/api.ts`
- Add interfaces:
  ```typescript
  export interface ObservationMedia {
    id: string;
    ownerId: string;
    observationId: string;
    type: "image" | "audio" | "video";
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    caption: string | null;
    createdAt: string;
    url?: string;
  }
  ```
- Add API functions:
  - `uploadObservationMedia(observationId: string, file: File, caption?: string): Promise<ObservationMedia>`
  - `fetchObservationMedia(observationId: string): Promise<ObservationMedia[]>`
  - `fetchMediaDetail(observationId: string, mediaId: string): Promise<ObservationMedia>`
  - `deleteObservationMedia(observationId: string, mediaId: string): Promise<void>`

#### 4.3 Media Gallery Component
- **File:** `frontend/src/components/MediaGallery.tsx`
- Features:
  - Grid of attached evidence cards (thumbnails for images, playable HTML5 audio element for audio files, HTML5 video player for MP4).
  - Lightbox / modal zoom for full-resolution image inspection.
  - Caption display and file metadata (size formatted in KB/MB, date).
  - Delete button with confirmation modal.
  - Upload dropzone:
    - Accepts drag-and-drop or file selector.
    - Validates client-side file size and MIME before initiating upload.
    - Displays upload progress indicator.

#### 4.4 Observation Detail Page Integration
- **File:** `frontend/src/pages/ObservationDetailPage.tsx`
- Integrate `MediaGallery` beneath observations notes.
- Integrate Location card:
  - If `location.precision === "hidden"`: Displays "Location hidden for privacy" badge; no coordinates or map rendered.
  - If `location.precision === "exact"` or `"approximate"`:
    - Displays label, latitude/longitude, and precision badge.
    - Displays embedded mini Leaflet map centered on coordinates with marker (or circle for approximate).

#### 4.5 Interactive Research Map Page (`/map`)
- **File:** `frontend/src/pages/ResearchMapPage.tsx`
- Features (PRD FR-13):
  - Full-screen / broad interactive map using Leaflet and OpenStreetMap tiles.
  - Queries all user observations (`fetchObservations({ limit: 100 })`).
  - Filters:
    - Project filter dropdown.
    - Tag filter.
    - Date range filter.
  - Pin plotting rules:
    - Observations without location or with `precision: "hidden"` are excluded from map rendering.
    - `exact` observations render as pinpoint markers.
    - `approximate` observations render with a circle marker or distinct color.
  - Marker Popups:
    - On pin click, popup displays:
      - Observation title and observed date.
      - First 100 characters of description.
      - Thumbnail image (if media exists).
      - Direct link: "View Observation Details →".
  - Empty state when no observations have displayable locations.
  - Graceful tile-load failure fallback.

#### 4.6 Navigation & Routes
- **File:** `frontend/src/components/Layout.tsx`:
  - Add `{ to: "/map", label: "Research Map" }` to navigation header.
- **File:** `frontend/src/app/App.tsx`:
  - Add `/map` route rendering `<Layout><ResearchMapPage /></Layout>`.

#### 4.7 Frontend Component Tests
- **File:** `frontend/src/components/MediaGallery.test.tsx`:
  - Renders image, audio, and video media items.
  - Triggers upload and calls API.
  - Confirms and triggers media deletion.
- **File:** `frontend/src/pages/ResearchMapPage.test.tsx`:
  - Renders map container and filters.
  - Verifies observations with `hidden` precision are not rendered as markers.
  - Verifies marker popup links to observation detail.

---

## 5. Verification Plan

### 5.1 Automated Quality Gates

| Check | Target | Command | Success Criteria |
| :--- | :--- | :--- | :--- |
| **Backend Unit & Integration Tests** | Backend test suite | `npm --prefix backend run test` | All tests pass, including new `mediaEndpoints.test.ts` and `storageService.test.ts`. |
| **Backend Typecheck** | Backend TypeScript | `npm --prefix backend run typecheck` | 0 errors (`tsc`). |
| **Backend Lint** | Backend ESLint | `npm --prefix backend run lint` | 0 errors (`eslint src tests`). |
| **Backend Build** | Backend production | `npm --prefix backend run build` | Clean `dist/server.js` build. |
| **Frontend Component Tests** | Frontend Vitest | `npm --prefix frontend run test` | All tests pass, including `MediaGallery.test.tsx` and `ResearchMapPage.test.tsx`. |
| **Frontend Typecheck** | Frontend TypeScript | `npm --prefix frontend run typecheck` | 0 errors (`tsc -b`). |
| **Frontend Lint** | Frontend Oxlint | `npm --prefix frontend run lint` | 0 errors (`oxlint`). |
| **Frontend Build** | Frontend Vite | `npm --prefix frontend run build` | Clean bundle generation (`dist/`). |

### 5.2 Security & Isolation Test Matrix (`SECURITY.md` §14, §15)

1. **Cross-User Media Isolation Probe**:
   - User A uploads media file `media_123` to observation `obs_A`.
   - User B attempts `GET /api/v1/observations/obs_A/media/media_123` → returns `404 NOT_FOUND`.
   - User B attempts `DELETE /api/v1/observations/obs_A/media/media_123` → returns `404 NOT_FOUND`.
   - User B attempts `POST /api/v1/observations/obs_A/media` → returns `404 NOT_FOUND`.
2. **Storage Path Concealment**:
   - Assert `storagePath` is absent from all JSON responses (`POST`, `GET`, `LIST`).
3. **MIME & Executable Protection**:
   - Uploading `.exe`, `.sh`, `.php`, or fake `.jpg` containing shell scripts rejected with `415 UNSUPPORTED_MEDIA_TYPE`.
4. **File Size Enforcement**:
   - Uploading 11 MB image rejected with `413 PAYLOAD_TOO_LARGE`.
5. **Location Privacy Enforcement**:
   - Observation with `precision: "hidden"` must NOT render marker on `/map`.
   - Observation with `precision: "hidden"` must NOT include coordinates in AI prompt context.

---

## 6. Risk Matrix & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Storage Emulator vs Cloud Storage Discrepancy** | High | Abstract all storage interactions through `IStorageService`. In emulator mode, use local signed URL handler; in production, use standard GCS v4 signed URLs. |
| **Orphan Binary Storage Objects on Firestore Write Failure** | Medium | Upload-then-record pipeline includes a `try...catch` rollback: if metadata creation fails in Firestore, the newly created storage object is immediately deleted. |
| **Leaflet CSS / Marker Icon Bundling in Vite** | Low | Explicitly import `leaflet/dist/leaflet.css` and configure default Leaflet icon paths using Vite-compatible asset imports. |
| **Geolocation Permission Denied by User** | Low | Non-blocking design (PRD NFR-02): location is strictly optional. Denied permission shows an informational toast and enables manual coordinate/label entry without crashing or blocking observation save. |
| **Unbounded Media Deletion Cascade** | Low | Deleting an observation uses `storageService.deletePrefix` to prune all files under `users/{uid}/observations/{observationId}/` in Cloud Storage. |
