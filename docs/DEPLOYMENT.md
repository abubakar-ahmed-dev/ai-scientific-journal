# Deployment Guide

**Status:** Canonical for deployment (aligned with ADR-005, ADR-008, ADR-013 – ADR-020, ADR-021 and the canonical `DATABASE_SCHEMA.md`, `API.md`, `SECURITY.md`, `TECHNICAL_ARCHITECTURE.md`)
**Last updated:** 2026-09-02
**Product:** AI Scientific Journal

> **Scope:** How the application is deployed, configured, and verified in production. Endpoint behavior is defined in `API.md`; the security model in `SECURITY.md`; monitoring in `OBSERVABILITY.md`. This document commits only to infrastructure the canonical architecture already establishes (Cloud Run, Firestore, Cloud Storage, Firebase Auth, Secret Manager, Gemini API) — it introduces no new platforms or services.

---

## 1. Overview

The AI Scientific Journal is deployed as a production-oriented web application on Google Cloud:

| Responsibility | Service |
| -------------- | ------- |
| Application hosting (frontend + backend) | **Google Cloud Run** (ADR-005) |
| Database (source of truth) | Cloud Firestore |
| Media binaries (private) | Cloud Storage |
| User identity | Firebase Authentication (Google Sign-In) |
| AI | Gemini API (server-side only) |
| Secrets | Google Cloud Secret Manager (ADR-004) |
| Operational visibility | Cloud Logging + Cloud Monitoring |

The application is deployable consistently across development and production: the same container image, different configuration.

---

## 2. Deployment Boundary: One Cloud Run Service

The **backend serves the frontend** as a single Cloud Run service (modular monolith, TA §8):

* The React application is built (`vite build`) into static assets served by the Express backend.
* The Express API is mounted under `/api/v1` (business routes) plus the unversioned `GET /api/health` (ADR-018).
* This is one container, one service, one deployment unit — **no separate frontend hosting** is committed. (Splitting frontend/backend hosting later would be an architecture change requiring its own ADR, not a deployment variation.)

Cloud Run provisions HTTPS automatically on its service URL; no separate load balancer or CDN is part of this architecture.

---

## 3. Environments

```text
Development  ← local (npm dev scripts; emulators/mocks per TESTING.md §16)
Production   ← Cloud Run (public; real dependencies)
```

Staging is optional and deferred — introduce it only if a real need emerges. Production and development configuration must never mix (§7, §8).

---

## 4. Build and Runtime Requirements

* **Runtime:** Node.js LTS containerized with **Docker** (ADR-012 — already committed; Docker is *not* an optional extra here, it is the Cloud Run packaging mechanism).
* **Build:** frontend production build + backend TypeScript compilation inside the image build; the running container serves the compiled application.
* **Port:** the container **must listen on the port provided by Cloud Run** (`PORT` environment variable) — never a hardcoded port.
* **Start:** a single production start command; the application validates configuration at startup and **fails fast** on missing required values (TA §44).
* No backend secrets are present at build time; the image contains code and static assets only.
* Vite frontend configuration is build-time configuration. Public Firebase web identifiers
  (`VITE_FIREBASE_*`) must be passed into the Docker build as build args; Cloud Run runtime
  environment variables cannot change an already-built frontend bundle.

---

## 5. Container Security (ADR-012)

The production image:

* Uses a minimal trusted Node.js base image; pins important versions.
* Installs production dependencies only.
* Runs as a non-root user where practical.
* Exposes only the application port.
* **Excludes** secrets and local artifacts:

```text
.env, .env.*, service-account*.json, credentials.json,
private keys, test fixtures, node_modules dev dependencies
```

(maintained via `.dockerignore`).

---

## 6. Cloud Run Configuration

Production service configuration (ADR-019):

* **Service name:** `ai-scientific-journal`, with label `dev-tutorial=cloud-run-ai-challenge`.
* **Region:** `asia-south1` — fixed at first production deploy (2026-09-06) and kept stable.
  Firestore `(default)` database, Cloud Run, the `ai-scientific-journal-media` bucket, and
  the Artifact Registry repository are all pinned to this region.
* **Deployed service URL:** `https://ai-scientific-journal-291307045855.asia-south1.run.app` (first deploy 2026-09-06).
* CPU/memory, min/max instances, and request timeout: set at deployment and tuned from observed behavior — values are operational choices, not architecture. Request timeout must accommodate AI endpoints without inviting abuse (rate limits in `API.md` §4.1 bound the exposure).
* **Ingress:** default Cloud Run HTTPS ingress; the API requires Firebase authentication on all `/api/v1` routes; `GET /api/health` is the only unauthenticated endpoint.

Rollback uses Cloud Run revisions: route traffic back to the last known-good revision, investigate the failed one (§15 of the original checklist retained below in §13).

---

## 7. Environment Configuration

Two clearly separated classes:

| Class | Contents | Where defined |
| ----- | -------- | ------------- |
| **Frontend (public by design)** | Firebase web config (apiKey, projectId, authDomain — public identifiers, not secrets) | Build-time env, from `.env.example` placeholders |
| **Backend** | Firebase Admin credentials, Gemini model configuration, `PORT`, allowed CORS origin, rate-limit settings | Runtime env on Cloud Run |

* `.env.example` files list placeholder names only — real `.env` files are never committed.
* Configuration is centralized and validated at startup (TA §44): missing required values → fail fast, never start partially configured.
* Local development uses development Firebase/Cloud projects and local secrets; **production and development secrets must never mix**.

---

## 8. Secrets Handling (ADR-004)

* The **Gemini API key** (and any future server-side credentials) lives in **Google Cloud Secret Manager**.
* Cloud Run receives secrets at **runtime** via Secret Manager bindings — the key is never in the image, in Git, in `.env` files in production, in Firestore, in the browser bundle, or in logs (`SECURITY.md` §17).
* Secret access is IAM-controlled: only the runtime service account may read the secret (§9).
* Rotation: create a new secret version, update the binding, redeploy — no code change.
* A Maps API key would follow the same pattern *when* the deferred map provider is chosen (ADR-020); it is public-but-restricted by nature and must be documented in SECURITY.md at that time.

---

## 9. Service Account and Least Privilege

Cloud Run runs as a **dedicated service account** — not the default compute account — with only:

* Firestore access (Cloud Datastore User, scoped to the project),
* Secret Manager secret accessor (the specific secrets),
* Cloud Storage object access on the application bucket (media phase onward).

Explicitly avoided: `roles/owner`, `roles/editor`, or any broad project-wide roles for the runtime identity (`SECURITY.md` §16). IAM grants are reviewed before each production deployment.

---

## 10. Firebase / Firestore / Storage Deployment Responsibilities

Deployment of the data layer is part of the release procedure, in this order:

1. **Firestore Security Rules** — deploy `firebase/firestore.rules` **before** public exposure; the rules enforce the UID isolation model (`users/{uid}/{document=**}`, per ADR-014/ADR-017 and `SECURITY.md` §6). Cross-user access is tested (TESTING.md §6) before launch.
2. **Firestore indexes** — deploy the composite indexes of `DATABASE_SCHEMA.md` §18 (no collectionGroup indexes exist).
3. **Firebase Authentication** — Google Sign-In provider enabled; authorized domains include the Cloud Run service domain; logout and token-expiry behavior verified.
4. **Cloud Storage** — the application bucket uses **uniform bucket-level access with private defaults**: objects under `users/{uid}/observations/{id}/…` are never publicly readable; all access flows through backend-authorized short-lived read URLs (`SECURITY.md` §15). No public buckets, no signed-URL exemptions beyond the backend's reader.

---

## 11. Deployment Flow

```text
Developer
   ↓
Git commit → GitHub
   ↓
Automated checks (lint, typecheck, tests, build — per TESTING.md §15)
   ↓
Cloud Build / Docker image build
   ↓
Artifact Registry
   ↓
Cloud Run (new revision)
   ↓
Post-deploy smoke tests (§13)
```

* **CI/CD scope:** GitHub Actions is the established CI stack (PRD §8) for checks and build. **Production deployment itself may be performed manually via `gcloud` for the MVP** — a fully automated deploy pipeline is not required and must not be introduced merely for convention. If automated deployment is added later, it is a process change, not an architecture change.
* MVP deployment uses `infrastructure/cloud-run/cloudbuild.yaml` to build the Dockerfile and
  pass the public Firebase web config to Vite via Docker build args. The resulting image is
  deployed with `gcloud run deploy --image ...`.
* Example conceptual deploy (exact region/project/image filled at deployment):

```bash
gcloud run deploy ai-scientific-journal \
  --image <REGION>-docker.pkg.dev/<PROJECT>/<REPOSITORY>/app:<TAG> \
  --region <REGION> \
  --service-account <runtime-sa> \
  --set-env-vars NODE_ENV=production,FIREBASE_PROJECT_ID=<PROJECT>,STORAGE_BUCKET=<BUCKET>,CORS_ORIGIN=<ORIGIN> \
  --set-secrets GEMINI_API_KEY=<secret>:latest \
  --allow-unauthenticated
```

---

## 12. Production vs Local Configuration Summary

| Aspect | Local | Production |
| ------ | ----- | ---------- |
| Hosting | Dev servers (`npm run dev`) | Cloud Run container |
| Firebase project | Development project | Production project |
| Gemini key | Local env var (dev key) | Secret Manager at runtime |
| Secrets in code/images | Never | Never |
| CORS | localhost origin | Production origin (allow-list) |
| Data | Emulators / dev Firestore | Production Firestore (isolated from dev) |

---

## 13. Post-Deployment Smoke Verification

Every production deployment is followed by minimum checks (per `TESTING.md` §15 and PRD E2E journey):

```text
✓ GET /api/health returns 200 {"status":"ok"}
✓ Application loads; Google Sign-In works; logout works
✓ Observation can be created, listed, edited, deleted
✓ Conversation works; messages persist
✓ Analysis is generated, validated, and viewable
✓ Suggestion acceptance creates a research task
✓ Journal history (observations, conversations, analyses) loads after re-login
✓ User isolation spot-check: User A cannot access User B's records
✓ AI failure state surfaces a retryable error without losing user content
✓ Error states render; no stack traces or internals exposed
```

---

## 14. Monitoring and Cost Protection

* Production monitoring uses **Cloud Logging + Cloud Monitoring** — architecture and metrics in `OBSERVABILITY.md` (not duplicated here).
* Cost protection (ADR-008): per-user AI rate limits, message/context/output size limits, request timeouts, and bounded context assembly bound the variable cost of Gemini usage; abuse surfaces as rate-limit metrics, not surprise bills.

---

## 15. Rollback Strategy

```text
New revision deployed → problem detected
   ↓
Identify last known-good revision
   ↓
Re-route traffic (Cloud Run revision traffic split)
   ↓
Investigate the failed revision out of production
```

Revisions are retained so rollback is always available; the data layer (Firestore/Storage) is not rolled back — schema compatibility is maintained forward.

---

## 16. Production Security Checklist

Before each production exposure:

```text
[ ] No secrets in Git, image, or frontend bundle
[ ] Secret Manager bound; runtime SA is its only accessor
[ ] Runtime service account is dedicated and least-privilege (no owner/editor)
[ ] HTTPS via Cloud Run verified; only /api/health unauthenticated
[ ] Firebase Auth configured (Google provider, authorized domains)
[ ] Firestore Security Rules deployed + cross-user tests passed
[ ] Required composite indexes deployed
[ ] Storage bucket private (uniform access); no public objects; no storagePath in any API response
[ ] CORS restricted to the production origin
[ ] Rate limiting and request-size limits active
[ ] Error responses sanitized; logging privacy rules verified (OBSERVABILITY.md §4)
[ ] Smoke checklist (§13) passed
```

---

## 17. Deployment Principle

The production environment must be reproducible and understandable: what is deployed, where, how it is configured, where secrets live, how the database is protected, how to deploy, verify, and roll back. The README is the quick-start entry point; this document is the detailed reference. Infrastructure is added only when the canonical architecture requires it — never for convention.
