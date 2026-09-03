# Phase 7: Media, Location & Research Map — Implementation Log

**Date:** 2026-09-03  
**Status:** Completed  
**Branch:** `feature/phase-7-media-location-map`  
**Governing Documents:** `PRD.md` (FR-11, FR-12, FR-13), `TECHNICAL_ARCHITECTURE.md`, `SECURITY.md` (§14, §15), `DATABASE_SCHEMA.md` (§10), `API.md` (§6.8), `ADR.md` (ADR-016, ADR-020, ADR-023, ADR-024)

---

## 1. Architectural Decisions Recorded

1. **ADR-023: Firebase Admin Storage Client for Observation Media** (Appended to `docs/ADR.md`):
   - Adopted `firebase-admin/storage` using `getStorage(getFirebaseAdminApp()).bucket(env.STORAGE_BUCKET)`.
   - Derives binary storage paths as `users/{uid}/observations/{observationId}/{mediaId}` (strictly omitting the `media/` segment per ADR-016).
   - Enforces zero external cloud exposure of `storagePath` — only short-lived signed URLs (TTL ≤ 15 min) are exposed to clients.
   - Integrates with `FIREBASE_STORAGE_EMULATOR_HOST` for deterministic, credential-free local development and integration testing.
2. **ADR-024: Leaflet and OpenStreetMap for Research Map** (Appended to `docs/ADR.md`):
   - Adopted `leaflet` and `react-leaflet` with standard OpenStreetMap tile layers.
   - Zero API keys, zero external tracking, zero vendor lock-in, and zero cost.
   - Strictly enforces location privacy: observations with `precision: "hidden"` are completely excluded from map rendering.

---

## 2. Implementation Summary by Task

### Task 1: Environment & Storage Foundation
- **`backend/src/config/env.ts`**:
  - Added `STORAGE_BUCKET` (default: `"ai-scientific-journal-media"`).
  - Added type-specific size limits:
    - `MEDIA_MAX_IMAGE_SIZE_BYTES` (10 MB = 10,485,760 bytes).
    - `MEDIA_MAX_AUDIO_SIZE_BYTES` (25 MB = 26,214,400 bytes).
    - `MEDIA_MAX_VIDEO_SIZE_BYTES` (100 MB = 104,857,600 bytes).
  - Added `MEDIA_SIGNED_URL_TTL_MINUTES` (default: 15).
  - Documented in `backend/.env.example`.
- **`backend/src/lib/firebaseAdmin.ts`**:
  - Exported `getFirebaseStorage()` initializing bucket from `env.STORAGE_BUCKET`.
- **`backend/src/storage/storageService.ts`**:
  - Created `IStorageService` interface declaring `upload`, `getSignedReadUrl`, `delete`, and `deletePrefix`.
  - Implemented `FirebaseStorageService` with emulator signed-URL fallback.
  - Implemented `MockStorageService` for unit and integration testing.
  - Created `getStorageService()` and `setStorageService()` factory.
- **`backend/src/repository/mediaRepository.ts`**:
  - Implemented `MediaRepository` managing `users/{uid}/observations/{obsId}/media/{mediaId}` in Firestore.
  - Automatically derives internal `storagePath` without `media/` segment.
  - Uses Firestore atomic batch operations to increment `mediaCount` on creation and decrement on deletion.
- **`backend/src/repository/observationRepository.ts`**:
  - Updated `delete()` to call `getStorageService().deletePrefix("users/{uid}/observations/{observationId}/")`, cascading deletion of all binary assets when an observation is deleted.

### Task 2: Media Endpoints & Upload Pipeline
- **`backend/src/schemas/mediaSchema.ts`**:
  - Declared allowed MIME types (JPEG, PNG, WebP, HEIC, MP3, WAV, MP4).
  - Helper `detectMediaType()` classifying incoming files into `"image"`, `"audio"`, or `"video"`.
  - `UploadMediaMetadataSchema` validating optional captions (max 500 characters).
  - `serializeMediaResponse()` ensuring `storagePath` is never leaked in API responses.
- **`backend/src/middleware/mediaUpload.ts`**:
  - Configured `multer` memory storage with 100MB ceiling and MIME type validation filter.
- **`backend/src/routes/media.ts`**:
  - Created sub-router with `mergeParams: true`.
  - `POST /api/v1/observations/:obsId/media`: checks parent observation ownership, enforces dynamic size limits (10MB/25MB/100MB), uploads binary to storage, stores Firestore document, rolls back storage binary on Firestore errors, and returns 201 with signed URL.
  - `GET /api/v1/observations/:obsId/media`: lists observation media with fresh signed URLs.
  - `GET /api/v1/observations/:obsId/media/:mediaId`: gets single media item with fresh signed URL.
  - `DELETE /api/v1/observations/:obsId/media/:mediaId`: removes storage object, deletes Firestore document, and decrements `mediaCount`.
- **`backend/src/routes/observations.ts`**:
  - Mounted `mediaRouter` under `/:observationId/media`.

### Task 3: Location Geolocation & Privacy Rules
- **Backend Privacy Enforcement**:
  - In `backend/src/ai/retrieval/retrievalService.ts`: when preparing verified candidates, if `location.precision === "hidden"`, coordinates are strictly omitted (`safeLocation.coordinates` undefined); if `"approximate"`, coordinates are fuzzed.
  - In `backend/src/ai/prompts/askGroundedAnswerPrompt.ts`: constructed context block headers omit coordinates for `hidden` precision (label only).
- **Frontend GPS Capture & Privacy Guidance**:
  - In `frontend/src/pages/ObservationFormPage.tsx`:
    - Added "Get Current Location" button utilizing browser `navigator.geolocation.getCurrentPosition`.
    - Added loading spinner and graceful error handling.
    - Added precision explanation guide for `exact`, `approximate`, and `hidden`.

### Task 4: Research Map Page & Media Gallery UI
- **`frontend/src/lib/api.ts`**:
  - Updated `api()` client to handle `FormData` without forcing `Content-Type: application/json`.
  - Added `uploadObservationMedia`, `fetchObservationMedia`, `fetchMediaDetail`, `deleteObservationMedia`.
- **`frontend/src/lib/leafletSetup.ts`**:
  - Configured Leaflet default marker icon URLs and imported `leaflet/dist/leaflet.css` to fix Vite asset bundling.
- **`frontend/src/components/MediaGallery.tsx`**:
  - Displays evidence cards with type badges (Image, Audio, Video).
  - Interactive image lightbox modal with full-size view and caption.
  - Native HTML5 `<audio>` and `<video>` player integration.
  - Upload dropzone with drag-and-drop, file type/size validation, and progress indicator.
  - Deletion confirmation dialog.
- **`frontend/src/components/ObservationMiniMap.tsx`**:
  - Embedded Leaflet mini map for `ObservationDetailPage`.
  - Privacy guard: if `precision === "hidden"`, displays privacy card with zero map tiles or coordinates.
  - If `precision === "approximate"`, displays 2km purple uncertainty circle.
- **`frontend/src/pages/ObservationDetailPage.tsx`**:
  - Integrated `ObservationMiniMap` and `MediaGallery`.
- **`frontend/src/pages/ResearchMapPage.tsx`**:
  - Full interactive map at `/map` (PRD FR-13).
  - Project, Tag, and Date range filtering.
  - Strict privacy filter: excludes `hidden` locations from map pins.
  - Interactive markers with informative popups, metadata, and detail navigation links.
- **`frontend/src/components/Layout.tsx` & `frontend/src/app/App.tsx`**:
  - Added `/map` route and navigation bar link.

---

## 3. Verification & Quality Gates

### Automated Test Suites
1. **Backend Tests**:
   - `tests/unit/storageService.test.ts` (4/4 passed)
   - `tests/unit/mediaRepository.test.ts` (6/6 passed)
   - `tests/integration/mediaEndpoints.test.ts` (12/12 passed)
   - **Total Backend Suites**: 24 files, **141 tests passed** (0 failures).
2. **Frontend Tests**:
   - `src/components/MediaGallery.test.tsx` (4/4 passed)
   - `src/pages/ResearchMapPage.test.tsx` (3/3 passed)
   - **Total Frontend Suites**: 7 files, **15 tests passed** (0 failures).

### Quality Gate Results
- **Backend Typecheck (`tsc`)**: Passed (0 errors)
- **Backend Lint (`eslint`)**: Passed (0 errors)
- **Frontend Typecheck (`tsc -b`)**: Passed (0 errors)
- **Frontend Lint (`oxlint`)**: Passed (0 errors)
- **Backend Build (`tsc -p tsconfig.build.json`)**: Passed (0 errors)
- **Frontend Build (`vite build`)**: Passed (0 errors, production bundle generated)
