# Developer Guide

**Last verified:** 2026-09-11  
**Product:** AI Scientific Journal

This guide explains how the app is designed, built, tested, and deployed. It is a practical engineering map; the canonical specs remain the source of truth:

- [PRD.md](./PRD.md)
- [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md)
- [SECURITY.md](./SECURITY.md)
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- [API.md](./API.md)
- [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md)
- [AI_EVALUATION.md](./AI_EVALUATION.md)
- [TESTING.md](./TESTING.md)
- [OBSERVABILITY.md](./OBSERVABILITY.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [ADR.md](./ADR.md)

## Table of Contents

1. [Architecture](#architecture)
2. [Repository Layout](#repository-layout)
3. [Frontend](#frontend)
4. [Backend](#backend)
5. [Authentication and Security](#authentication-and-security)
6. [Data Model](#data-model)
7. [AI System](#ai-system)
8. [RAG and Search](#rag-and-search)
9. [Media and Location](#media-and-location)
10. [Testing](#testing)
11. [Local Development](#local-development)
12. [Deployment](#deployment)
13. [Observability](#observability)
14. [Quick References](#quick-references)
15. [Known Gaps and Drift](#known-gaps-and-drift)

## Architecture

The application is a modular monolith deployed as one Cloud Run service. The Express backend serves both `/api/v1` business APIs and the built React SPA in production. The health endpoint remains unversioned at `/api/health`.

```text
Browser SPA
  -> Firebase Auth ID token
  -> Cloud Run / Express API
  -> Firestore, Cloud Storage, Gemini, Secret Manager
```

Core decisions:

- Firebase Authentication is the identity boundary: ADR-001.
- Cloud Firestore is the source of truth: ADR-002.
- Gemini calls are server-side only: ADR-003.
- Secrets live in Secret Manager: ADR-004.
- Cloud Run is the production runtime: ADR-005.
- All private data is UID-scoped: ADR-006, ADR-014.
- Analyses are a single type-discriminated collection: ADR-015.
- Derived RAG search data is user-scoped and non-authoritative: ADR-017.
- Business APIs are versioned under `/api/v1`: ADR-018.
- Media uses Firebase Admin Storage: ADR-023.
- Maps use Leaflet and OpenStreetMap: ADR-024.

Documentation ownership:

| Document | Owns |
| --- | --- |
| `PRD.md` | Product scope, requirements, MVP boundary |
| `TECHNICAL_ARCHITECTURE.md` | Architecture baseline and system shape |
| `SECURITY.md` | Threat model, auth, privacy, isolation, logging rules |
| `DATABASE_SCHEMA.md` | Firestore shape, relationships, lifecycle |
| `API.md` | Public HTTP contract, envelopes, errors, pagination |
| `AI_ARCHITECTURE.md` | AI service boundary, prompt/output pipeline, RAG rules |
| `AI_EVALUATION.md` | AI quality evaluation strategy and cases |
| `TESTING.md` | Test layers, fixtures, gates, environments |
| `OBSERVABILITY.md` | Logs, metrics, health, troubleshooting |
| `DEPLOYMENT.md` | Cloud Run deployment, config, rollback |
| `ADR.md` | Decision history |

Implementation anchors:

- Backend app: `backend/src/app.ts`
- API router mount: `backend/src/routes/index.ts`
- Frontend routes: `frontend/src/app/App.tsx`
- Root docs and quick start: `README.md`

## Repository Layout

```text
frontend/          React, Vite, TypeScript SPA
backend/           Express, TypeScript API
firebase/          Firestore rules and indexes
infrastructure/    Cloud Run / Cloud Build deployment assets
scripts/           Utility scripts, including production smoke testing
docs/              Canonical architecture, API, security, and operations docs
plans/             Phase plans, implementation logs, and testing logs
```

## Frontend

Stack:

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- TanStack Query
- Firebase Web SDK
- React Router
- lucide-react icons
- Leaflet / react-leaflet for map views

Important files:

- `frontend/src/app/App.tsx`: route table and `RequireAuth` guard.
- `frontend/src/app/providers.tsx`: provider wiring.
- `frontend/src/components/Layout.tsx`: app shell, grouped navigation, command palette trigger, profile pill, sign-out confirmation, mobile drawer, sidebar collapse.
- `frontend/src/lib/api.ts`: API client, auth header injection, typed resource helpers, error envelope mapping.
- `frontend/src/lib/queryClient.ts`: TanStack Query defaults.
- `frontend/src/lib/firebase/authContext.tsx`: Google sign-in, sign-out, auth state, token provider.

Authenticated routes:

| Route | Page |
| --- | --- |
| `/dashboard` | Dashboard |
| `/observations` | Observations list |
| `/observations/new` | Observation create form |
| `/observations/:id` | Observation detail |
| `/observations/:id/edit` | Observation edit form |
| `/map` | Research Map |
| `/ask` | Ask My Journal |
| `/tasks` | Research Tasks |
| `/conversations` | AI Chat |
| `/projects` | Projects |
| `/projects/:id` | Project detail |
| `/settings` | Settings |

Data fetching uses TanStack Query with defaults in `queryClient.ts`: one retry, `staleTime` of 30 seconds, and no refetch on window focus. Some dashboard data uses more aggressive freshness patterns through `frontend/src/lib/useDashboardData.ts` and helpers in `frontend/src/lib/dashboardHelpers.ts`.

The API client always targets `/api/v1`, injects the Firebase ID token when available, supports `FormData` without forcing JSON content type, and throws `ApiRequestError` for standardized error envelopes.

UI conventions:

- AI content is visually and structurally separate from user content.
- The dashboard avoids false totals; page-limited counts can carry a plus marker.
- Destructive actions use confirmation dialogs.
- Major views expose loading, empty, error, and retry states.
- The command palette opens with Ctrl/Cmd+K.
- The mobile navigation drawer has Escape handling and a focus trap.
- User-authored messages are rendered as plain text; AI text uses the app's markdown renderer.
- Form validation is custom where browser constraint validation is unreliable in jsdom tests, especially location and dynamic measurement rows.

## Backend

Stack:

- Node.js
- Express 5
- TypeScript
- Zod
- Firebase Admin SDK
- `@google/genai`
- Pino
- Helmet
- CORS
- express-rate-limit
- Multer for media uploads

Important files:

- `backend/src/app.ts`: middleware order, CSP, CORS, JSON body limit, health route, API mount, SPA serving.
- `backend/src/config/env.ts`: validated environment configuration and production fail-fast rules.
- `backend/src/middleware/authMiddleware.ts`: Firebase ID token verification.
- `backend/src/middleware/errorHandler.ts`: standardized error envelope.
- `backend/src/middleware/rateLimiter.ts`: chat, AI, search, and media upload limits.
- `backend/src/routes/*.ts`: HTTP handlers.
- `backend/src/repository/*.ts`: Firestore persistence and ownership-scoped data access.
- `backend/src/ai/*`: AI service, prompts, Gemini adapter, fake AI, retrieval.
- `backend/src/storage/storageService.ts`: storage abstraction and Firebase Storage implementation.

Middleware order in `app.ts` follows the architecture notes:

```text
requestId -> helmet -> CORS -> JSON body limit -> request logging -> global rate limit -> routes
```

The route table is mounted under `/api/v1` and then protected by `requireAuth`. `GET /api/v1/` returns service metadata before the auth middleware; all business subroutes are authenticated.

Implemented API groups:

| Group | Purpose |
| --- | --- |
| `/me` | Profile, preferences, avatar upload/removal |
| `/projects` | Optional research projects |
| `/observations` | Observation CRUD, versions, media subroutes |
| `/conversations` | Conversation metadata and stateful chat messages |
| `/ai` | Summarize, analyze, suggest research, ask, search |
| `/analyses` | Read and filter AI analyses |
| `/research-tasks` | Manual tasks and accepted AI suggestions |

Rate-limit tiers:

| Endpoint group | Default |
| --- | --- |
| Chat messages | 20 requests per minute |
| AI generation | 10 requests per 5 minutes |
| AI search | 60 requests per minute |
| Media uploads | 30 uploads per hour |

## Authentication and Security

Firebase Authentication is the identity boundary. The backend derives `req.user.uid` from the verified Firebase ID token. Client-supplied UIDs or owner fields are never trusted.

Authorization uses owner-only access:

```text
resource path under users/{uid}
AND ownerId == authenticated UID where the field exists
```

Foreign resources return `404 NOT_FOUND`, not `403`, to avoid revealing whether another user's resource exists.

Firestore rules provide defense in depth. The backend still performs authorization because server-side Admin SDK access is privileged.

Helmet CSP is configured in `backend/src/app.ts`. Current image sources include self, data URLs, blob URLs, Google avatar/static hosts, OpenStreetMap tile hosts, and `storage.googleapis.com` for signed media URLs. `crossOriginOpenerPolicy` is set to `same-origin-allow-popups` so Firebase Google sign-in popup messaging works.

Security invariants:

- Browser never receives the Gemini API key.
- Gemini never performs authorization.
- Retrieved/user content is untrusted prompt data.
- AI output is validated before storage.
- AI output never mutates user observations except the server-managed observation status flag.
- Storage paths are derived server-side and omitted from API responses.
- Private journal content, tokens, precise locations, secrets, full prompts, and full model responses are not logged in production.

## Data Model

Firestore structure:

```text
users/{uid}
  projects/{projectId}
  observations/{observationId}
    versions/{versionId}
    media/{mediaId}
  conversations/{conversationId}
    messages/{messageId}
  analyses/{analysisId}
  researchTasks/{taskId}
  observationSearch/{observationId}
```

Key semantics:

- Observations are user-flat and may have `projectId: null`.
- Projects organize data; they are not parent containers for observations.
- Observation versions are immutable edit snapshots.
- Media metadata is under the observation; binaries live in Cloud Storage.
- Analyses are append-only and may contain dangling references to deleted observations or deleted projects.
- Research tasks can be user-created or copied from an accepted AI suggestion.
- `observationSearch` is derived, rebuildable, user-scoped, and never authoritative.
- Default list pagination uses server-managed timestamps. Observation chronology views can sort by observed date.
- Required composite indexes are declared in `firebase/firestore.indexes.json`.

Deletion behavior:

| Delete | Effect |
| --- | --- |
| Project | Observations, conversations, and tasks are refiled to `projectId: null`; analyses keep historical `projectId`. |
| Observation | Versions, media metadata, media binaries, and search index entry are deleted; analyses remain. |
| Conversation | Messages are deleted; analyses sourced from it remain. |
| Media | Metadata and binary are deleted; `mediaCount` decrements. |
| Research task | Task is deleted; observations and analyses are untouched. |

## AI System

All AI work goes through the application AI service abstraction.

```text
route/service -> IAIService -> GeminiAdapter or FakeAIService -> Gemini API
```

Important files:

- `backend/src/ai/types.ts`
- `backend/src/ai/aiService.ts`
- `backend/src/ai/adapters/geminiAdapter.ts`
- `backend/src/ai/adapters/fakeAiService.ts`
- `backend/src/ai/prompts/*.ts`
- `backend/src/ai/parsers/analysisOutputSchema.ts`

Implemented AI capabilities:

| Capability | API |
| --- | --- |
| Stateful chat | `POST /api/v1/conversations/:conversationId/messages` |
| Summarization | `POST /api/v1/ai/summarize` |
| Observation analysis | `POST /api/v1/ai/analyze` |
| Research suggestions | `POST /api/v1/ai/suggest-research` |
| Ask My Journal | `POST /api/v1/ai/ask` |
| Related observation search | `POST /api/v1/ai/search` |

Generatable analysis types are `summary`, `analysis`, and `research_suggestions`. The schema also allows `hypothesis` and `classification`, but no generation workflow exists for those reserved types.

Prompt output is parsed, schema-validated, application-validated, and then persisted. Invalid structured output returns `AI_INVALID_RESPONSE` and is not stored.

`USE_FAKE_AI=true` selects the deterministic fake service for offline development and tests. Production validation rejects fake AI, sentinel Gemini keys, localhost CORS, and emulator host variables.

## RAG and Search

Ask My Journal and related-observation search use lexical retrieval over `users/{uid}/observationSearch`, per ADR-022.

Flow:

```text
question/query
  -> UID-scoped derived index scan
  -> lexical scoring and snippets
  -> canonical observation re-check
  -> context budget selection
  -> Gemini generation for /ai/ask only
```

The retrieval system is intentionally not a vector database in the MVP. Embeddings are deferred until evaluation shows lexical retrieval is insufficient.

Important settings in `backend/src/config/env.ts`:

| Env var | Default |
| --- | --- |
| `AI_SEARCH_MAX_CANDIDATES` | 500 |
| `AI_SEARCH_DEFAULT_LIMIT` | 10 |
| `AI_RAG_MIN_SCORE` | 0.1 |
| `AI_RAG_WEAK_EVIDENCE_SCORE` | 0.15 |
| `AI_RAG_MAX_CONTEXT_OBSERVATIONS` | 5 |
| `AI_RAG_CONTEXT_CHAR_BUDGET` | 12000 |

If evidence is missing or weak, `/ai/ask` returns a deterministic insufficient-evidence answer and does not invoke Gemini.

## Media and Location

Media:

- Upload route: `POST /api/v1/observations/:observationId/media`.
- Read/list/delete routes are observation-scoped.
- Allowed categories: image, audio, video.
- Default limits: image 10 MB, audio 25 MB, video 100 MB.
- Signed read URLs last up to 15 minutes.
- `storagePath` is never exposed to the frontend.

Location:

- Location is optional on observations.
- Precision values are `exact`, `approximate`, and `hidden`.
- Frontend display sanitization lives in `frontend/src/lib/locationPrivacy.ts`.
- Approximate locations are fuzzed to one decimal place before rendering.
- Hidden locations do not render map tiles or coordinates and are omitted from AI prompt context.

Map implementation uses Leaflet and OpenStreetMap:

- `frontend/src/pages/ResearchMapPage.tsx`
- `frontend/src/components/ObservationMiniMap.tsx`
- `frontend/src/lib/leafletSetup.ts`

## Testing

Default validation commands:

```bash
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run test
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm run build
```

Security rules:

```bash
npm --prefix backend run test:security
```

Root convenience scripts:

```bash
npm run test
npm run build
npm run emulators
```

Test strategy:

- Security isolation and authorization first.
- API contract and validation tests for backend endpoints.
- AI pipeline tests with fake or mocked adapters.
- RAG evaluation tests for retrieval, grounding, and insufficient-evidence behavior.
- Frontend component tests with React Testing Library and Vitest.
- A stubbed AI journey test covers the main researcher workflow.
- Production smoke testing uses `scripts/smoke-test.mjs`.

Recent phase logs recorded green suites around Phase 9 with backend and frontend tests passing, plus production smoke checks for health, SPA serving, and unauthenticated API envelope behavior.

## Local Development

Local development can run fully offline with Firebase emulators and Fake AI.

Typical setup:

```bash
cd frontend && npm install
cd ../backend && npm install
cd ..
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
npm run emulators
```

In separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Default local endpoints:

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:8081` |
| Auth emulator | `http://localhost:9099` |
| Firestore emulator | `http://localhost:8082` |
| Storage emulator | `http://localhost:9199` |
| Emulator UI | `http://localhost:4000` |

Frontend Firebase config values are public identifiers. Backend secrets stay server-side.

## Deployment

Production deployment is one Cloud Run service named `ai-scientific-journal` in `asia-south1`, with label `dev-tutorial=cloud-run-ai-challenge`.

Current documented production URL:

```text
https://ai-scientific-journal-291307045855.asia-south1.run.app
```

Deployment path:

```text
Cloud Build -> Docker image -> Artifact Registry -> Cloud Run revision
```

Important files:

- `Dockerfile`
- `infrastructure/cloud-run/cloudbuild.yaml`
- `infrastructure/cloud-run/README.md`
- `plans/phase-9/deploy-guide.md`
- `scripts/smoke-test.mjs`
- `docs/DEPLOYMENT.md`

Vite embeds `VITE_*` frontend config at build time. Cloud Run runtime env vars cannot change an already-built frontend bundle, so Cloud Build passes the public Firebase web config as Docker build args.

Backend production config is runtime env plus Secret Manager. The Gemini API key is injected from Secret Manager. Secret rotation requires a new Cloud Run revision, but not an image rebuild.

Data-layer deployment order matters:

1. Firestore rules.
2. Firestore indexes.
3. Private media bucket and IAM.
4. Cloud Run deploy.
5. Firebase Auth authorized domain.
6. Smoke tests.

Rollback uses Cloud Run revision traffic.

## Observability

Production observability uses Cloud Logging and Cloud Monitoring.

The backend emits structured logs with:

- `requestId`
- route and method
- status code
- duration
- authenticated user identifier where available
- AI operation metadata
- error classifications

AI signal logging is centralized in `backend/src/lib/aiSignals.ts` and wired into AI routes and chat turns.

Do not log:

- Secrets
- Authorization tokens
- Private journal content
- Full prompts or model responses
- Precise coordinates unless strictly necessary
- Storage paths

The health endpoint is intentionally shallow:

```text
GET /api/health -> 200 {"status":"ok"}
```

## Quick References

### Environment Variables

Frontend values are public build-time values:

| Variable | Notes |
| --- | --- |
| `VITE_API_BASE_URL` | Defaults to `/api/v1`; the API client currently uses same-origin `/api/v1`. |
| `VITE_FIREBASE_API_KEY` | Public Firebase web identifier, not a backend secret. |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain. |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID. |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID. |
| `VITE_USE_FIREBASE_EMULATORS` | Local only; must be empty/unset in production builds. |
| `VITE_FIREBASE_AUTH_EMULATOR_HOST` | Local only. |

Backend runtime values are validated in `backend/src/config/env.ts`:

| Variable | Default / production note |
| --- | --- |
| `NODE_ENV` | `development`; production enables stricter validation. |
| `PORT` | `8081` locally; Cloud Run provides its own port. |
| `CORS_ORIGIN` | Localhost default is rejected in production. |
| `FIREBASE_PROJECT_ID` | Required outside tests. |
| `GEMINI_API_KEY` | Required in production from Secret Manager. |
| `USE_FAKE_AI` | Local/test affordance; rejected in production. |
| `AI_MODEL` | `gemini-3.5-flash` in code. |
| `AI_TIMEOUT_MS` | `30000`. |
| `AI_MAX_CONTEXT_MESSAGES` | `20`. |
| `AI_SEARCH_MAX_CANDIDATES` | `500`. |
| `AI_SEARCH_DEFAULT_LIMIT` | `10`. |
| `AI_RAG_MIN_SCORE` | `0.1`. |
| `AI_RAG_WEAK_EVIDENCE_SCORE` | `0.15`. |
| `AI_RAG_MAX_CONTEXT_OBSERVATIONS` | `5`. |
| `AI_RAG_CONTEXT_CHAR_BUDGET` | `12000`. |
| `STORAGE_BUCKET` | `ai-scientific-journal-media`. |
| `LOG_LEVEL` | Optional. |
| `MEDIA_MAX_IMAGE_SIZE_BYTES` | `10485760`. |
| `MEDIA_MAX_AUDIO_SIZE_BYTES` | `26214400`. |
| `MEDIA_MAX_VIDEO_SIZE_BYTES` | `104857600`. |
| `MEDIA_SIGNED_URL_TTL_MINUTES` | `15`. |

### API Quick Reference

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Public liveness check |
| GET/PATCH | `/api/v1/me` | Profile and preferences |
| PATCH/DELETE | `/api/v1/me/avatar` | Profile avatar |
| GET/POST | `/api/v1/projects` | List/create projects |
| GET/PATCH/DELETE | `/api/v1/projects/:id` | Project detail/update/delete |
| GET/POST | `/api/v1/observations` | List/create observations |
| GET/PATCH/DELETE | `/api/v1/observations/:id` | Observation detail/update/delete |
| GET | `/api/v1/observations/:id/versions` | Observation edit history |
| GET/POST | `/api/v1/observations/:id/media` | List/upload media |
| GET/DELETE | `/api/v1/observations/:id/media/:mediaId` | Read/delete media |
| GET/POST | `/api/v1/conversations` | List/create conversations |
| GET/PATCH/DELETE | `/api/v1/conversations/:id` | Conversation detail/archive/delete |
| GET/POST | `/api/v1/conversations/:id/messages` | Message list and stateful chat |
| GET | `/api/v1/analyses` | List/filter analyses |
| GET | `/api/v1/analyses/:id` | Analysis detail, optionally source summaries |
| GET/POST | `/api/v1/research-tasks` | List/create tasks |
| GET/PATCH/DELETE | `/api/v1/research-tasks/:id` | Task detail/update/delete |
| POST | `/api/v1/ai/summarize` | Generate summary analysis |
| POST | `/api/v1/ai/analyze` | Generate observation analysis |
| POST | `/api/v1/ai/suggest-research` | Generate research suggestions |
| POST | `/api/v1/ai/ask` | Grounded journal Q&A |
| POST | `/api/v1/ai/search` | Retrieval-only related observations |

### Screenshot Checklist

Use synthetic/demo data only. Do not include secrets, real user content, raw IDs, or signed media URLs in screenshots.

Needed captures:

- Landing page.
- New-user dashboard.
- Returning-user dashboard.
- Command palette.
- Observation list.
- Observation form.
- Observation detail.
- Version snapshot modal.
- Media gallery.
- Projects list and project detail.
- Tasks board.
- AI Chat.
- Ask My Journal with evidence and insufficient evidence.
- Research Map.
- Settings.

### Production Incident Notes

Recent production lessons to preserve:

- Vite `VITE_*` values are build-time config. Cloud Run runtime env cannot repair a frontend bundle built with demo Firebase values.
- Cloud Run Secret Manager bindings are revision-pinned. Secret rotation needs a new revision, not an image rebuild.
- Signed media URLs require `https://storage.googleapis.com` in `img-src`.
- Avatar previews created with `URL.createObjectURL` require `blob:` in `img-src`.
- Runtime signed URLs require the Cloud Run service account to have the correct token-signing IAM permission.
- Production Gemini calls should explicitly set a supported `AI_MODEL`; the current code default is `gemini-3.5-flash`.

## Known Gaps and Drift

The following notes were found while reading the current docs, phase logs, and implementation:

- `frontend/README.md` is still the default Vite template, not an app-specific frontend guide.
- ~~`backend/.env.example` currently lists `AI_MODEL=gemini-3.6-flash`~~ Resolved 2026-09-12: `.env.example` now matches the `env.ts` default `gemini-3.5-flash` and the production pin.
- The canonical API documents idempotency broadly. Phase logs confirm explicit follow-up coverage for task acceptance, Ask My Journal, chat, and media, but any new write endpoint should still be checked before relying on idempotency behavior.
- Phase 9 logs note 12 frontend lint warnings around state-setting-in-effect patterns; they were considered non-blocking and deferred to a future TanStack Query migration.
- `TECHNICAL_ARCHITECTURE.md` still contains some older baseline examples in long sections; prefer the canonical ADRs, `API.md`, and `DATABASE_SCHEMA.md` where there is any conflict.
- Project detail currently surfaces linked observations and research tasks. The data model supports broader project association for conversations and analyses, but the current project detail page does not present those as separate tabs.
- Observation archiving is available through edit status, not as a dedicated archive/unarchive button on the detail page.
- Production deployment logs note resolved incidents around CSP for `storage.googleapis.com` signed media URLs, `blob:` avatar previews, runtime service-account token signing, and model/env pinning. Future header, media, or secret changes should re-check those paths.
