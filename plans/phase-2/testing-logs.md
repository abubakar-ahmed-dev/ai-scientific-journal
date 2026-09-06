# Phase 2 — Security & Data Foundation: Independent Testing Log

**Date:** 2026-09-02
**Tester:** Claude (independent verification — per CLAUDE.md "Do Not Trust Previous Claims"; implementation-log claims were re-executed, not trusted)
**Branch:** `security-data-foundation` @ `debe710`
**Scope tested:** all Phase 2 deliverables per `plans/phase-2/plan.md` §0–§6

---

## 1. Verdict

**Conditionally complete — one blocking gap, two minor gaps, three cosmetic notes.**

The Phase 2 *implementation* is faithful to the plan and of good quality: every
runtime-verifiable check I executed independently passes, and 12/12 static
plan-conformance checks pass. However:

* 🔴 **BLOCKER: the Firestore rules suite has never actually executed.** It
  silently no-ops without the emulator and reports ✓ (details §3.1). Phase 2's
  DoD item 1 and item 4 are **not yet satisfied**; the rules themselves remain
  *unverified at runtime*.
* 🟠 `isolation.test.ts` mocks the repository/Firestore layer, so it verifies
  middleware + validation wiring but not real Firestore persistence (acceptable
  for Phase 2 scope; must not be treated as repository coverage).
* 🟠 `firebase-tools`/JDK missing locally → `emulators:exec` path untested
  (plan §5.3).

---

## 2. Independent validation runs (re-executed by tester)

| # | Check | Command | Result |
| - | ----- | ------- | ------ |
| 1 | Backend unit+security tests | `npx vitest run` (backend) | **18/18 passed** (4 files) |
| 2 | Backend lint | `npm run lint` | **0 errors** |
| 3 | Backend typecheck | `npm run typecheck` + `tsc -p tsconfig.build.json --noEmit` | **0 errors** (after stale-artifact purge; see §5.3) |
| 4 | Backend build | `npm run build` | **clean**, `dist/server.js` produced |
| 5 | Frontend lint | `npm run lint` | **1 warning**, 0 errors (fast-refresh, §5.5) |
| 6 | Frontend typecheck | `npm run typecheck` | **0 errors** |
| 7 | Frontend tests | `npm test` | **1/1 passed** |
| 8 | Frontend build | `npm run build` | **clean** Vite bundle |
| 9 | Live server boot + auth smoke | `tsx src/server.ts` + curl | health `200`; `/api/v1/me` no header → `401 UNAUTHENTICATED` envelope with `requestId`; garbage Bearer → `401` (real `verifyIdToken` path exercised — token rejected by the actual Firebase Admin verification, not a mock) |
| 10 | Static plan conformance | scripted checks against source | **12/12 PASS** (§4) |

## 3. Findings

### 3.1 🔴 BLOCKER — Rules suite silently skips without the emulator

`rules.test.ts` checks a TCP socket to `localhost:8082`; when nothing is
listening it logs `Skipping rules test: Firestore emulator is not running…`
and **returns success**. All 7 rules tests then display ✓ with 1–7 ms runtimes.

Evidence (tester's run, no emulator):

```text
Skipping rules test: Firestore emulator is not running at localhost:8082
 ✓ tests/security/rules.test.ts > … (7 tests, all ~1ms)
Test Files  2 passed (2)   Tests  13 passed (13)
```

Consequences:

* The implementation log's "18/18 passed" is **true but misleading** — the
  security-critical half never executed.
* The **rules themselves are unverified at runtime**. Static review of
  `firebase/firestore.rules` confirms the correct structure (read/delete split
  from create/update, `ownerSet()`, `validProjectRef` via `.get('projectId',
  null)`, `allow write: if false` on `versions`/`analyses`, balanced braces,
  `rules_version '2'`) — but static review is not verification (ADR-010's own
  lesson: assertions must come from execution).
* CI is currently exposed to the same failure mode unless the emulator is a
  hard prerequisite there.

**Required remediation (any one, A+B preferred):**
A. Convert skips into failures: `throw new Error("Firestore emulator required — start with `firebase emulators:start --only firestore`")` when `testEnv` is null. A security suite must fail closed.
B. Wire CI to `firebase emulators:exec --only firestore "npm run test:security"` so the suite cannot pass without it (plan §5.3; `ubuntu-latest` runners have Java preinstalled).
C. Local: install JDK 11+ (`winget install EclipseAdoptium.Temurin.21.JDK`); `npx firebase-tools emulators:exec --only firestore …` currently fails with `Could not spawn java -version` (verified).

### 3.2 🟠 isolation.test.ts mocks below the middleware

`vi.mock("../../src/lib/firebaseAdmin")` replaces `verifyIdToken` (fine — that
is the plan's hermetic seam) **and also replaces the Firestore repository
backend** with an in-memory stub. Verified behavior: 401 paths, token→uid
derivation, `PATCH` validation 400s — all genuinely exercised. Not covered:
real document creation, server timestamps, `lastLoginAt` refresh, preferences
merge. `userRepository` logic is therefore executed only against a stub that
returns canned data. Acceptable for Phase 2; must gain emulator-backed
repository tests (e.g., via the same 8082 emulator with rules disabled) in
Phase 3, or `findOrCreateUser`/`updateUserProfile` remain effectively untested
code.

Also noted: the mockFirestore hardcodes `exists: true` always, so the
lazy-*create* branch of `findOrCreateUser` is unreachable in tests (both GET
and PATCH tests hit the "already exists" path). The create-path code has zero
test execution.

### 3.3 🟢 Verified-correct highlights (independently confirmed)

* Auth middleware: Bearer parsing, empty-token rejection, real Admin SDK
  `verifyIdToken` call, UID set from decoded token only; correct 401 envelopes
  with `requestId` (live-verified, #9 above).
* `requireAuth` mounted **before** `meRouter` on `/api/v1` (order verified in
  `routes/index.ts`); `/api/health` remains public and unversioned.
* `userSchema`: `.strict()` on both objects; `displayName` 1–100;
  `photoURL` HTTPS-only ≤ 2048 (via `.url().startsWith("https://")` —
  belt-and-braces); preferences enum/booleans; immutable fields rejected by
  omission + strict mode (tested: `role` → 400, unknown field → 400).
* `userRepository`: `ownerId` denormalized (§4 invariant), `role: "user"` /
  `accountStatus: "active"` defaults, `serverTimestamp()` throughout,
  preferences merged not replaced on update.
* Rules source: all six structural checks pass (§3.1) — but see the blocker.
* `firebase.json`: ports 9099/8082/4000 per plan (8080 Oracle-avoidance
  honored); root placeholder `firebase/firebase.json` deleted as planned.
* Indexes: exactly the 5 composites of DATABASE_SCHEMA §18, no collectionGroup.
* Frontend: `setAuthTokenProvider` seam reused from Phase 1 (no duplicate
  client); `onAuthStateChanged` persistence; emulator connect guarded for HMR.

## 4. Static plan-conformance matrix (12/12 PASS)

| Check | Result |
| ----- | ------ |
| `FIREBASE_PROJECT_ID` required in env schema (fail-fast, TA §44) | PASS |
| `meRouter` GET + PATCH present | PASS |
| Zod `.strict()` on update schemas | PASS |
| `displayName` 1–100 per API.md §6.2 | PASS |
| `photoURL` HTTPS ≤ 2048 | PASS |
| `requireAuth` mounted before business routes | PASS |
| 5 composite indexes per DB §18 | PASS |
| Firestore emulator on 8082 (not 8080) | PASS |
| Auth emulator on 9099 | PASS |
| Frontend `connectAuthEmulator` (dev flag) | PASS |
| Token via Phase 1 `setAuthTokenProvider` seam | PASS |
| `onAuthStateChanged` persistence | PASS |

## 5. Minor findings (non-blocking)

5.1 **`vitest.config.mts` vs plan's `vitest.config.ts`** — file is `.mts`; works
correctly (Vite resolves it; verified by tests passing with `NODE_ENV=test`
env). Cosmetic deviation from plan text only.

5.2 **Frontend config defaults** — `config.ts` falls back to `"demo-key"` /
`demo-*` placeholders when `VITE_FIREBASE_*` are unset. Safe (public-by-design
identifiers, DEPLOYMENT.md §7) and convenient for emulator dev, but a missing
`VITE_FIREBASE_API_KEY` in a real deployment would surface as a runtime auth
error rather than a startup failure. Acceptable; consider a production-mode
warning later.

5.3 **Stale build artifact masked a typecheck failure** — during testing,
`tsc -p tsconfig.build.json --listEmittedFiles` initially reported 4 errors in
`observationVersionRepository.ts` / `projectRepository.ts`. These are **Phase 3
work-in-progress files in the working tree** (untracked), and the errors vanish
after purging `node_modules/.tmp` + `dist` (incremental-build cache). Exit code
0 on all clean reruns. No Phase 2 impact; noted so the next agent doesn't
misread Phase 3 WIP as a Phase 2 regression.

5.4 **Implementation-log discrepancies found** (log vs. verified reality):
* Log claims all 18 tests "passed" — 7 of them silently skipped (§3.1).
* Log lists branch `feature/phase-2-security-data`; actual branch is
  `security-data-foundation` (cosmetic).
* Log's §4 claim "client-supplied ownerId/uid ignored **or rejected**" is only
  half-demonstrated: schema `.strict()` rejects it in PATCH bodies (tested ✓);
  no test exercises query/header-supplied identity (middleware would ignore it,
  but that path is asserted nowhere).

5.5 **Frontend lint warning** — `authContext.tsx:58` fast-refresh warning
(hooks + component in one file). Standard pattern; 0 errors; no action needed.

## 6. DoD scorecard (plan §6)

| # | DoD item | Status |
| - | -------- | ------ |
| 1 | Security suites pass; CI runs them | 🟠 tests pass, rules half **unverified**; CI wiring **absent** |
| 2 | Sign-in end-to-end vs Auth Emulator | 🟠 code correct & typechecked; **not runtime-verified** (needs emulator + JDK, §3.1C); landing UI present |
| 3 | GET/PATCH /me behavior + immutable 400s | ✅ verified (live + suite) |
| 4 | Rules deny cross-user/unauth across collections | 🔴 **unverified at runtime** (blocker) |
| 5 | 5 indexes present; emulators boot | 🟠 indexes ✅; emulator boot **untested** (no JDK) |
| 6 | CI green incl. new suites | 🔴 CI has **no emulator/security step yet** |
| 7 | No secrets committed | ✅ verified (placeholders only, no SA JSON) |

## 7. Recommended next actions (before Phase 3 sign-off of this phase)

1. **Fail-closed rules suite** (§3.1A) — one-line change, do immediately.
2. **CI emulator step** (§3.1B) — add to `.github/workflows/ci.yml` backend job.
3. Install JDK locally and execute the rules suite once for real; record the
   green run in an addendum to this log.
4. Phase 3: add emulator-backed `userRepository` tests incl. the lazy-create
   branch (§3.2).
5. Optionally exercise `GET/PATCH /me` end-to-end once with the Auth Emulator
   minted token to close DoD #2/#3 runtime coverage.

---
*All commands and results in this log were executed by the tester on
2026-09-02 against branch `security-data-foundation` @ `debe710`. Raw evidence
snippets are embedded in §3. This log supersedes conflicting claims in
`implementation-logs.md` §3 where they disagree.*

---

# Addendum — 2026-09-02 (same day): remediation executed and rules verified for real

Actions recommended in §7 items 1–3 were implemented and re-verified.

## A1. Fail-closed rules suite (§3.1A) — DONE

All seven `if (!testEnv) return;` silent-skip guards in `rules.test.ts` replaced
with thrown errors. Verified: without the emulator the suite now **fails**
(7 failed) with a message naming the fix command; security tests can no longer
pass vacuously.

## A2. CI emulator wiring (§3.1B) — DONE

`.github/workflows/ci.yml` backend job now runs tests inside
`npx firebase-tools emulators:exec --only firestore --project demo-test "npm test"`
(ubuntu-latest runners ship Java; the fail-closed suite makes the emulator a
hard prerequisite — the CI path and the local path now fail the same way).

## A3. Rules suite executed FOR REAL — a genuine rules bug was found and fixed

With the emulator running (JDK 21 installed locally; Firestore emulator
v1.22.0), the first true execution **failed 1 of 7 rules tests** — proof the
skip-path had been hiding a real defect:

```text
FirebaseError: 7 PERMISSION_DENIED:
Incorrect number of arguments. Received: 1. Expected: map.get(string, any),
map.get(list, any). for 'create' @ L45 …
```

**Root cause:** Firestore rules `Map.get()` does not accept `null` as its
default argument — `validProjectRef`'s
`request.resource.data.get('projectId', null)` fails overload resolution at
evaluation time, denying *every* observation create/update regardless of
`projectId`. (Corollary: the previously "passing" foreign-`projectId` denial
test was being denied by the rule *error*, not by the `exists()` integrity
check — the positive-path test was what exposed the truth. Negative-only
suites mask exactly this class of bug.)

**Fix** (`firebase/firestore.rules` `validProjectRef`): absence detected via
`!request.resource.data.keys().hasAny(['projectId'])`; explicit `null` allowed
via `== null` comparison against a string-default `get`; non-string values
denied by an `is string` guard before `exists()`.

## A4. Post-fix verification (all re-executed under the emulator)

| Run | Result |
| --- | ------ |
| `test:security` under `emulators:exec` | **13/13 passed** (7 rules tests with real >200 ms runtimes + 6 isolation) |
| Full backend suite `npm test` under `emulators:exec` | **41/41 passed** (7 files — includes Phase 3 WIP tests present in the working tree) |
| Backend lint + typecheck after all edits | **clean** |

Foreign-`projectId` denial now occurs through the actual `exists()` integrity
check (a genuine evaluate-then-deny, per the emulator's rule-trace output), and
the owned-`projectId` create path genuinely succeeds.

## A5. Residual items (unchanged from §6)

* DoD #2 (browser sign-in against Auth Emulator) still requires a manual
  browser pass — code verified, UX not yet exercised.
* Emulator-backed `userRepository` tests incl. lazy-create branch — deferred to
  Phase 3 (§3.2).
* DoD #6 fully closes only when the updated CI workflow runs green on the next
  push (configuration verified locally; CI execution pending push).

**DoD #1 and #4 are now SATISFIED.** The Phase 2 security rules are
runtime-verified. Remaining open items: DoD #2 (manual browser pass), DoD #6
(first CI run), plus the Phase 3 deferrals above.
