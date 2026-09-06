# Testing

**Status:** Canonical for test strategy (aligned with ADR-009, ADR-010, ADR-013 – ADR-018, ADR-021 and the canonical `DATABASE_SCHEMA.md`, `API.md`, `SECURITY.md`, `AI_ARCHITECTURE.md`)
**Last updated:** 2026-09-02
**Product:** AI Scientific Journal

> **Scope:** This document defines the application's overall testing strategy — layers, targets, fixtures, mocking, environments, and MVP priorities. Detailed AI-quality methodology (evaluation cases, scoring, rubrics, RAG retrieval/generation metrics) lives in `AI_EVALUATION.md`; this document only defines where AI-related *software* testing hooks in. Data shapes from `DATABASE_SCHEMA.md`; endpoints from `API.md`; security matrix from `SECURITY.md` §30–31.

---

## 1. Testing Scope and Principles

1. **Security boundaries are tested first.** User isolation, server-side authorization, and validation are the highest-value tests in this product (PRD NFR-01; `SECURITY.md` §32) — a feature is not done until its isolation tests exist (SECURITY.md §34).
2. **Test behavior, not implementation.** Assertions target observable behavior — what is persisted, what is returned, which status code — never internal call graphs.
3. **Authoritative data integrity is invariant.** Every layer asserts that AI/dependency failures never corrupt or delete user content (PRD NFR-02).
4. **External services are untrusted test boundaries.** Gemini, Firestore, Storage, and (future) Maps are mocked/emulated at defined seams so tests are deterministic and offline.
5. **Fast feedback by default.** Unit and mocked integration suites run constantly; live-model and full-E2E runs are explicit, cost-aware events (ADR-008 cost discipline applies to testing too).
6. **Canonical terminology everywhere.** Fixtures and tests use the canonical model: Observations, projects (optional), conversations/messages, analyses (`type` incl. `research_suggestions`), research tasks, derived `observationSearch`.

### Layer overview (TA §60)

```text
Unit → Integration → Security → API → AI evaluation → E2E → Production smoke
```

Test framework baseline: **Vitest** (TA §93). Additional tooling (E2E driver, rules-test harness, emulator choice) is decided at implementation — this document fixes no vendor commitments (§19).

---

## 2. Unit Testing

Pure logic with no I/O. Targets:

* **Validation** — every rule in `API.md` §6: field lengths/enums, coordinate ranges, `measurements` bounds, `observedAt` sanity, unknown-field rejection, server-managed fields (`ownerId`, `status: "analyzed"`, `mediaCount`, `version`) rejected from clients.
* **Prompt builders & context assembly** — bounded context windows, minimum-necessary selection, untrusted-content framing/delimiters (`AI_ARCHITECTURE.md` §6–7).
* **Output validation** — schema checks against every malformation class in `AI_EVALUATION.md` §7 (missing fields, invalid enums, wrong types, excessive content, unexpected fields, invalid nested structures).
* **Pagination cursors** — encode/decode, sort-binding, invalid/stale rejection (`API.md` §5).
* **Error mapping** — provider/failure classes → registry codes (`API.md` §3).
* **Permission/policy functions** — owner checks, optional-`projectId` integrity logic (backend side of ADR-014).
* **Data transforms** — entity ↔ DTO mapping; `storagePath` never present in any serialized response.

---

## 3. Integration Testing

Real dependencies behind controlled seams (emulators/in-memory stubs, §12):

* Firebase Authentication token verification (valid, expired, malformed, wrong-audience tokens).
* Firestore operations through the repository layer: CRUD for observations, projects, conversations/messages, analyses, research tasks; transactional counter updates (`messageCount`, `mediaCount`); cascade behaviors per `DATABASE_SCHEMA.md` §19 (observation delete → versions/media/index; project delete → re-file user records to `null` but **retain analyses' `projectId`** per ADR-021; conversation delete → messages).
* **RETAIN semantics:** deleting a source observation leaves its analyses intact with dangling references (`DATABASE_SCHEMA.md` §12).
* Derived-index lifecycle: `observationSearch` written/updated asynchronously after the observation write (a failed index write never fails the observation — PRD NFR-02), deleted with it; stale/missing entries repaired by retry (ADR-017).
* Storage integration: upload → backend-derived path → metadata document; delete removes object + metadata (media phase onward).

---

## 4. API / Endpoint Testing

Every endpoint in `API.md` tested against its specification table: method, path, auth requirement, validation rules, response envelope (`{data, meta}` / error envelope), status codes, side effects, idempotency, rate limits.

Standing assertions for **every** protected endpoint:

* No token → `401 UNAUTHENTICATED`; expired/invalid token → `401`.
* Foreign resource → `404 NOT_FOUND` with the *same* body as a missing resource (existence-hiding; never `403` leakage, `API.md` §2.2).
* Client-supplied UID/identity fields are ignored or rejected.
* Invalid payloads → `400 VALIDATION_ERROR` naming fields, never echoing internals.
* Unknown routes → safe 404; oversized bodies → `413`.

Endpoint-specific cases (high value):

* **Observations:** create with/without `projectId`; `projectId=unfiled` filter; `sort=updated` vs `sort=observed` cursor separation; `expectedVersion` mismatch → `409`; delete cascades + analyses retained.
* **Versions:** read-only; `404` until the versioning phase ships (ADR-016 deferral is *observable API behavior*).
* **Media:** upload ownership via parent observation; `storagePath` absent from responses; read URL short-lived (media phase onward).
* **Conversations/messages:** `contextType`/`contextId` validation; immutable context fields; `PATCH` limited to title/status.
* **Analyses:** read/filter only; no client `POST` route exists (assert 404/405).
* **Research tasks:** acceptance flow — foreign/missing `sourceAnalysisId` → `404`; out-of-range `suggestionIndex` → `400`; idempotency prevents double-acceptance.
* **AI endpoints:** rate-limit headers and `Retry-After`; failure codes `502`/`503` per `AI_ARCHITECTURE.md` §10.

---

## 5. Authentication and Authorization Testing

The security matrix from `SECURITY.md` §31, executed as automated tests (mocked tokens + emulator-backed Firestore):

```text
User A → User A resource            ✓ allowed
User A → User B resource            ✕ 404, no data
User A → modify User B              ✕
User A → delete User B              ✕
Unauthenticated → private API       ✕ 401
Client changes ownerId              ✕ rejected (immutable)
Client changes role/accountStatus   ✕ rejected (server-managed)
UID manipulation in body/query      ✕ ignored — identity from verified token only
Guessed media ID under foreign obs  ✕ 404 (observation-scoped routes)
Accept suggestion from foreign analysis ✕ 404 (sourceAnalysisId ownership)
Cross-user retrieval via /ai/ask|search ✕ impossible — UID-scoped before any model call
```

Plus backend-vs-rules independence: the backend enforces ownership even though Firestore rules also would (defense in depth, `SECURITY.md` §36 of TA / §6–8 of SECURITY).

---

## 6. Firestore and Cloud Storage Testing

* **Security-rules unit tests** — the rules file gets its own suite (mechanism — e.g., the Firebase Emulator Suite's rules harness — chosen at implementation): read/create/update/delete × owner/non-owner/unauthenticated; `ownerId` immutability on update; optional-`projectId` `get()` validation (valid owned reference vs foreign/missing); the derived `observationSearch` subtree under the same path rule; server-only fields not writable by clients.
* **Query/index conformance** — every listing query used by the API runs against the composite indexes in `DATABASE_SCHEMA.md` §18 (emulator or staging verifies no missing-index failures); **no collectionGroup queries anywhere** (assert by code search + query review, ADR-014).
* **Cascade integrity** — the §19 deletion matrix exercised against real (emulated) Firestore, including storage-object deletion for media.
* **Storage privacy** — objects under `users/{uid}/observations/{id}/…` are private; no public ACLs; access only via backend-authorized read URLs.

---

## 7. Frontend / Component Testing

Component-level tests for state correctness and security-relevant rendering:

* **State coverage** — every major view renders loading, empty, success, error, and retry states explicitly (TA §54).
* **Auth-state handling** — signed-out redirect/gating; token refresh failure → re-auth prompt; multi-tab sign-out consistency.
* **User vs AI content distinction** — analyses render as AI-generated artifacts (provenance visible), never conflated with observation fields (PRD FR-14).
* **Dangling-reference rendering** — an analysis whose source observation was deleted shows a graceful "source deleted" state (RETAIN contract, `API.md` §7.2).
* **AI-failure UX** — Gemini failure surfaces a retryable AI-specific error while user content remains in the editor/chat (`AI_ARCHITECTURE.md` §10).
* **Forms** — client validation mirrors (never replaces) server rules; server `VALIDATION_ERROR` field feedback renders.
* **Location precision** — `hidden` locations never render coordinates.

---

## 8. End-to-End Testing

Primary journey (TA §66), automated against emulated/backend dependencies with a stubbed Gemini adapter where live AI is unnecessary:

```text
Open app → Sign in → (optionally create project) → create observation
→ attach evidence/location → save → send chat message → receive reply
→ run analysis → review findings → accept a suggestion as research task
→ sign out → sign in again → verify full persistence
```

Additional E2E scenarios: unfiled observation flow (no project — ADR-014); observation edit → version snapshot (when versioning ships); delete observation → analyses still listed with dangling-source states; two-browser isolation spot-check (User A cannot see User B's records in UI).

E2E covers the *wiring*, not AI quality — AI responses in E2E come from the stubbed adapter except where a live smoke test is explicitly run (§9, §16).

---

## 9. AI Integration Testing (high level)

Software-level integration of the AI pipeline, with **quality evaluation deliberately out of scope here** (→ `AI_EVALUATION.md`):

* **Seam correctness** — application depends only on the AI Service interface; the Gemini Adapter is the sole SDK touchpoint (mock the service in all non-AI tests; mock the adapter in AI-pipeline tests).
* **Pipeline ordering** — user message persisted *before* generation; assistant message persisted after validation; counters/timestamps updated.
* **Validate-before-persist** — malformed/mocked outputs produce **zero writes** and `502` (`AI_EVALUATION.md` §7's suite feeds these cases; the testing assertion is the zero-write + error-code contract).
* **Retrieval → context → generation wiring** — UID-scoped retrieval results re-checked against canonical data; deleted observations never reach a prompt (ADR-017).
* **Failure mapping** — adapter errors/timeouts/rate limits map to the §10 behavior matrix (`AI_ARCHITECTURE.md`).

---

## 10. RAG Testing (high level)

Two distinct software-test concerns, both derived-data rules from ADR-017:

1. **Retrieval plumbing** — index written/updated asynchronously after the observation write (observation success never depends on index success); deleted with the observation; queries resolve only within the caller's `users/{uid}/observationSearch` subtree; results re-verified against canonical observations before use. Correctness *of relevance/ranking* is an evaluation problem, not a test problem.
2. **Isolation assertions** — with multi-user fixtures, retrieval for User A never returns User B records, regardless of prompt content (assertion on retrieval output, outside any model).

**Evaluation methodology** — retrieval recall/precision, groundedness rates, insufficient-evidence behavior, and all scoring — is defined in `AI_EVALUATION.md` §5 and §9 and is not duplicated here.

---

## 11. Failure and Edge-Case Testing

Failure-injection at defined seams (adapter, repository, network), asserting per `AI_ARCHITECTURE.md` §10 and `SECURITY.md` §24:

* Gemini timeout / unavailable / rate-limited → `503` or `429` mapping; **user message and observations remain persisted**; retry safe.
* Malformed model output → nothing persisted (`502`).
* Retrieval failure → no generation from a half-failed context; safe error or empty result.
* Firestore operation failure → honest error to the client (never fake success); unsaved input preserved client-side.
* Storage upload failure mid-flow → no orphaned metadata; best-effort object cleanup.
* Network failure / double-click on writes → idempotency keys prevent duplicates (`API.md` §4.2).
* Edge inputs: empty/maximum-length fields, unicode, adversarial strings, boundary pagination (`limit` bounds, stale cursor), absurd `observedAt`.

---

## 12. Test Data and Fixture Strategy

* **Synthetic fixtures only** — no real user journal content, ever (same rule as `AI_EVALUATION.md` §4.3; `SECURITY.md` §26).
* **Multi-user fixture set** — at least two seeded users (User A / User B) with disjoint observations, projects, conversations, analyses, tasks — the backbone of every isolation test.
* **Canonical-shaped factories** — fixture builders produce schema-valid documents (observation with/without project, with/without location/measurements; conversation with messages; analysis of each generatable type — `summary`, `analysis`, `research_suggestions` only).
* **Derived-index fixtures** — `observationSearch` entries built the same way production builds them (from observations, never hand-authored drift).
* **Evaluation datasets** (`AI_EVALUATION.md` §4) live with the evaluation code and are the *same* synthetic data used by AI-pipeline tests where overlap helps.
* Fixtures never contain secrets or real personal data; they are reviewed like production code.

---

## 13. Mocking and Stubbing External Services

| Dependency | Seam | Default in tests |
| ---------- | ---- | ---------------- |
| Gemini | **AI Service interface** (app-level) / **Gemini Adapter** (pipeline-level) | Fake service / scripted adapter responses (valid, malformed, timeout, rate-limit variants) |
| Firestore | Repository layer | Emulator or in-memory emulator-compatible instance for integration/rules tests; mocked repositories for unit tests |
| Cloud Storage | Storage service abstraction | Emulator or in-memory stub asserting backend-derived paths |
| Firebase Auth (verification) | Auth middleware | Emulator tokens or test-signed tokens; no live network |
| Maps | (deferred, ADR-020) | No tests until a provider exists; then stubbed at a location-service seam |

Live-model tests exist only as explicitly triggered regression runs (§15) — never as default CI gates (cost + determinism, ADR-008).

---

## 14. Regression Testing

* **Software regressions** — unit/integration/security/API suites run on every change (§16); a change that breaks any isolation or integrity assertion cannot merge.
* **AI regressions** — the fixed evaluation set reruns on prompt, model, retrieval, schema, or AI-Service changes with comparable stored results (`AI_EVALUATION.md` §11); safety/isolation failures block release.
* **Rules regressions** — any rules-file change reruns the full rules test suite (§6) before deploy.
* Bug fixes gain a regression test reproducing the bug first (standard practice, lightweight).

---

## 15. CI / Test Execution Expectations

CI runs on GitHub Actions (established stack, PRD §8), following TA §67's order:

```text
Install → Lint → Typecheck → Unit tests → Integration tests → Security tests → Build
                                          (emulated/mocked; offline; minutes)
```

* **Every push/PR:** lint, typecheck, unit; **every PR:** integration + security suites (emulator-backed) and build.
* **Pre-deploy:** E2E smoke against a production-like container (Docker build verification, §17).
* **Explicitly triggered:** live-model AI regression runs (§13) before AI-significant releases (`AI_EVALUATION.md` §11).
* **Post-deploy:** production smoke checklist (`DEPLOYMENT.md` §14) — health, auth, observation create, chat, analysis, isolation spot-check.
* CI secrets are CI-scoped (test service accounts / emulator configs only) — never production secrets.

---

## 16. Test Environments

* **Local** — unit + mocked integration; emulators for Firestore/rules/Storage; stubbed AI adapter. Fully offline-capable.
* **CI** — same emulators/stubs in containers; deterministic, no external services.
* **Production** — smoke tests only, against real dependencies, exercising read-mostly paths and clearly-labeled test-user content (per `DEPLOYMENT.md` §3 development/production split; staging optional and deferred).

---

## 17. Coverage Philosophy

* **No numerical coverage targets.** Coverage reports are diagnostic, not goals — none is established by the canonical documents, and none is invented here.
* Coverage effort concentrates where correctness is critical: **validation logic, authorization/ownership paths, AI output validation, cascade/lifecycle behavior, and error mapping**.
* Untested paths in low-risk code (trivial UI styling, constants) are acceptable; untested security boundaries are not (§1).

---

## 18. MVP Testing Priorities

Minimum credible suite for the hackathon/MVP, in priority order:

1. **Isolation & authorization matrix** (§5) — automated, complete.
2. **Firestore rules suite** (§6) — owner/non-owner/unauthenticated × collections.
3. **Validation & API contract tests** (§2, §4) — all endpoints, envelopes, error codes.
4. **AI pipeline integrity** (§9) — validate-before-persist zero-write assertions; user-message-persists-on-failure; failure mapping (§11).
5. **Cascade/RETAIN integrity** (§3) — deletion matrix incl. retained dangling analyses.
6. **E2E happy path** (§8) with stubbed AI, including sign-out/sign-in persistence.
7. **Frontend state & AI-error UX** (§7) — loading/empty/error/retry; dangling-source rendering.

Everything else (broader E2E matrices, full evaluation-set runs) builds on this foundation.

---

## 19. Testing Non-Goals / Deferred Areas

* **No numerical coverage thresholds** or quality gates beyond pass/fail suites (§17).
* **No specific E2E driver, rules-test harness vendor, or external test platform** committed here — tooling chosen at implementation (§1).
* **No load/stress/performance benchmark suites** — performance concerns are architectural (TA §74) and observed via production metrics (`OBSERVABILITY.md`), not MVP test gates.
* **No chaos-engineering or fault-injection platforms** — failure testing is seam-level injection (§11).
* **No penetration-testing engagement** or formal security audit as an MVP deliverable — the automated security matrix + security review (PRD workflow §12 step 6) stand in; a future audit would be its own decision.
* **No reserved-type AI tests** — `hypothesis` and `classification` have no generation to test (`AI_EVALUATION.md` §2); only their schema/read-filter validity is covered.
* **No visual-regression, accessibility-audit tooling, or native-mobile test matrices** in the MVP (a11y is a build-quality concern per TA §55; the product is a responsive web app).
* **No AI quality evaluation in this document** — methodology, scoring, and thresholds live in `AI_EVALUATION.md`.

---

## 20. Consistency Notes

* Entity/endpoint/error-code/fixture terminology follows `DATABASE_SCHEMA.md`, `API.md`, and `SECURITY.md`; the AI seam follows `AI_ARCHITECTURE.md` §2; AI *quality* methodology is referenced to, not duplicated from, `AI_EVALUATION.md`; version-history conditionality follows ADR-016; user-flat isolation follows ADR-014; derived-index rules follow ADR-017.
