# Phase 9: Production Hardening & AI Evaluation — Testing Log

**Date:** 2026-09-04
**Branch:** `feature/phase-9-production-hardening`
**Scope:** Agent Block 1 gates (plan §A) — live-service gates follow Manual Blocks 1–4.

---

## 1. API.md §9 Per-Endpoint Security Matrix (A7 audit, code-read 2026-09-04)

Verification method: route registry + middleware chain read (`routes/index.ts`, `app.ts`,
`rateLimiter.ts`, `authMiddleware.ts`, `errorHandler.ts`), each route file's ownership checks,
and cross-referencing the test suite. ✅ = verified in code **and** covered by an automated test.

| Endpoint(s) | Auth (UID from token) | Ownership (existence-hiding 404) | Validation | Envelope | Rate limit | Idempotency | Notes |
| :--- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `GET /api/health` | n/a (public by design) | n/a | n/a | ✅ literal `{status:"ok"}` | global | n/a | unversioned per ADR-018; tested |
| `GET /api/v1` | ✅ | n/a | n/a | ✅ | global | n/a | service descriptor |
| `/me` GET/PATCH | ✅ | n/a (own doc by path) | ✅ (immutable-field rejection) | ✅ | global | n/a | lazy-create tested; role/status tampering tested in rules suite |
| `/projects` CRUD | ✅ | ✅ (User B → 404, tested) | ✅ | ✅ | global | n/a | delete re-files observations (ADR-021), tested |
| `/observations` CRUD + versions | ✅ | ✅ (tested) | ✅ (server-managed fields rejected; `expectedVersion` → 409) | ✅ | global | n/a | version snapshots + cursor pagination tested live in phase 3 |
| `/observations/:id/media` | ✅ | ✅ (list/get/upload/delete probes, tested) | ✅ (MIME + magic-byte + size; 413/415 mapping) | ✅ | **media tier 30/h** ✅ | ✅ upload replay/conflict tested | `storagePath` never serialized (phase 7 F2/F6) |
| `/conversations` CRUD | ✅ | ✅ (tested) | ✅ | ✅ | global | n/a | archive semantics tested |
| `/conversations/:id/messages` POST | ✅ | ✅ | ✅ (1–8000 chars) | ✅ | **chat tier 20/min** ✅ | ✅ retry-regenerate + replay tested (phase 4 F2) | user message persisted before model call (§7.3) |
| `/ai/summarize` | ✅ | ✅ source ownership (tested) | ✅ | ✅ | **AI tier 10/5min** ✅ | n/a | zero-write on malformed output tested |
| `/ai/analyze` | ✅ | ✅ | ✅ | ✅ | AI tier | n/a | `analyzed` write-back server-side only |
| `/ai/suggest-research` | ✅ | ✅ | ✅ | ✅ | AI tier | n/a | |
| `/ai/ask` | ✅ | ✅ (multi-user probes tested) | ✅ | ✅ | AI tier (tested live 429 + `Retry-After`) | ✅ conversation replay tested | grounding gate: unverified citation → 502 zero-write; insufficient-evidence deterministic |
| `/ai/search` | ✅ | ✅ (UID-scoped retrieval) | ✅ | ✅ | AI tier | n/a (retrieval-only, no persistence) | |
| `/analyses` list/get | ✅ | ✅ (tested) | ✅ (`includeSources=summary` param) | ✅ | global | n/a | append-only; dangling sources retained (ADR-015) |
| `/research-tasks` CRUD + accept | ✅ | ✅ (tested) | ✅ (index bounds, status transitions) | ✅ | global | ✅ **gap closed this phase** — replay test added | acceptance requires owned `sourceAnalysisId` |
| unknown routes | n/a | n/a | n/a | ✅ 404 envelope + requestId (tested) | global | n/a | |
| malformed JSON body | n/a | n/a | ✅ **gap closed this phase** — 400 envelope test added | ✅ | n/a | n/a | parser internals never leaked |

**Audit verdict:** every API.md §9 checklist row is satisfied and test-backed. Two gaps found
(task-acceptance idempotency, malformed-JSON mapping) — both closed with tests this phase.
`trust proxy` is set (Cloud Run LB); rate limiters are UID-keyed with IPv6-normalized IP
fallback, so limiter identity survives the proxy hop.

## 2. SECURITY.md §31 Pre-Launch Testing Matrix — coverage status

| §31 requirement | Status |
| :--- | :--- |
| Login / logout / expired / invalid token / unauthorized request | ✅ invalid + missing tested at API layer (expired shares the verify-catch → 401); login/logout E2E in browser journey; **live re-check in Agent Block 2 (F4)** |
| Authorization A→A ✓, A→B ✕ (read/modify/delete) | ✅ per-endpoint User-B 404 probes across all 8 integration suites + rules suite |
| Firestore rules: read/create/update/delete, unauth, cross-user, ownership modification, optional-projectId integrity, observationSearch subtree | ✅ `tests/security/rules.test.ts` (emulator, fail-closed) — runs in CI behind `RUN_SECURITY_RULES` / emulator exec |
| API: missing token / invalid token / malformed request / invalid ID / excessive size / unauthorized access | ✅ all covered (excessive size: 413 media test + `entity.too.large` handler; invalid ID: 404/400 per suite) |
| AI: prompt injection, long input, malformed output, hallucination/insufficient-evidence, no-context, cross-user retrieval, failure isolation | ✅ injection framing live-verified (phase 6), golden-case grounding gates added (A4), zero-write suite (phase 5), failure injection (phase 4/6). **Live Gemini re-check planned in Agent Block 2 (F4)** |

## 3. Agent Block 1 gate results (final)

See `implementation-logs.md` §3 table — all green: backend 191/191 under emulator, frontend
43/43, typechecks/lint clean, build clean, smoke-script failure path verified.

## 4. Notes for Agent Block 2 (post-deploy)

1. `scripts/smoke-test.mjs $SERVICE_URL` immediately after first deploy (plan E4), then CORS
   lock-down, then §13 browser checklist.
2. §31 rows marked "live re-check in F4" are the only matrix items awaiting real-Gemini /
   real-Auth verification.
3. Log-privacy spot-check on production logs (`gcloud run services logs read`) — confirm
   `ai operation` lines carry lengths/IDs only, never content.

## 5. CI follow-up: frontend Vitest worker OOM

GitHub Actions run `34039653867` failed only in the frontend `npm test` step. Backend passed;
frontend lint/typecheck passed; individual frontend tests were passing until a Vitest worker
process exceeded Node's heap limit (`FATAL ERROR: Ineffective mark-compacts near heap limit
Allocation failed - JavaScript heap out of memory`), producing an unhandled worker exit.

Root cause: `MarkdownText` rendered heading lines without incrementing the parser line index,
creating an infinite render loop for markdown headings. In the full suite, the affected
`MarkdownText.test.tsx` worker eventually exceeded Node's heap and surfaced as a Vitest worker
OOM rather than a normal assertion failure. Fix: advance `i` after rendering a heading. The
initial Vitest worker/heap workaround was reverted because the component loop was the actual
failure.

Validation after fix: targeted `MarkdownText.test.tsx` passed (6/6); full frontend tests passed
(19 files, 70/70); frontend lint/typecheck/build passed. Lint still reports the known warning
set but exits 0.
