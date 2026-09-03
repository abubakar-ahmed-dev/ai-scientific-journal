# Phase 5 — Structured AI Analyses: Independent Testing Log

**Date:** 2026-09-02
**Tester:** Claude (independent verification — all Phase 5 source read in full before testing; nothing trusted from prior claims)
**Branch:** `feature/phase-5-structured-analyses` (WIP, uncommitted at test time)
**Method:** static source review + full emulator suite + **30-assertion live E2E** (in-process HTTP over real Firestore emulator + Auth-Emulator tokens, deterministic AI injection with malformed/schema-violating output modes)

---

## 1. Verdict

**The scientific core works: all three generation pipelines, the acceptance flow, append-only semantics, and the ADR-009 zero-write guarantee verified live (30/30 E2E, 76/76 suites).** Two must-fix issues before merge — a repeat of the timestamp-serialization defect class (F1) and a write-back that assumes doc existence (F2) — plus minor notes.

---

## 2. Verified (evidence)

### Suites
| Run | Result |
| --- | ------ |
| Full backend suite under Firestore emulator | **76/76 (16 files)** |
| Backend lint + typecheck | clean |
| Frontend typecheck + tests + build | 4/4, clean, bundle ok |

### Live E2E (30/30 after correcting two tester-side assertion miscounts — see §5)

**Generation pipelines**
* `/ai/analyze` (201, `type:"analysis"`) with provenance (`model`, `promptVersion`), correct `observationIds[]`, and **measurements verifiably present in the AI prompt context** (27.4 °C confirmed in the captured payload)
* `/ai/summarize` both variants — observation-sourced and conversation-sourced (`conversationId` recorded); exactly-one-source refine rejects both/neither (400)
* `/ai/suggest-research` (201, `type:"research_suggestions"`) with populated `suggestedNextSteps`
* **Server-side write-back:** `status:"analyzed"` set on both analyzed observations, and **only** status — title/hypothesis untouched (AI-never-mutates invariant)

**Suggestion → task acceptance (PRD FR-15)**
* Acceptance → task with `source:"gemini"`, `sourceAnalysisId` provenance, `status:"suggested"`, suggested text copied
* Out-of-range `suggestionIndex` → 400; **User B accepting User A's analysis → 404** (ownership)
* User-created tasks: `status:"planned"` default; invalid transition (planned→completed) → 400; valid (planned→in_progress) → 200

**Read surface & RETAIN (ADR-015)**
* List (4 after four pipelines — see §5), `type` filter, `observationId` array-contains filter
* `?includeSources=summary` resolves `{found:true, title, status}` for live sources
* **After source-observation deletion: analysis retained, source renders `found:false`** — the approved dangling-reference contract, verified live
* Cross-user isolation: User B sees zero analyses and 404 on A's analysis

**ADR-009 validate-before-persist — the phase's core guarantee**
* Malformed JSON from the model → **`502 AI_INVALID_RESPONSE`**
* Valid-JSON/schema-violating output (wrong types, invalid enum) → **`502`**
* **ZERO-WRITE:** analysis count unchanged after both failure modes — invalid AI output is never persisted

---

## 3. Findings

### F1 🔴 Firestore Timestamp leak in analyses + research-task responses (repeat of Phase 3-F1/Phase 4-F3)
`analysisRepository` and `researchTaskRepository` do not apply `serializeTimestamps` (verified: 0 references in source; live responses show `createdAt: {"_seconds":...}`). The `AnalysisViewer` UI will render "Invalid Date". **This is the third occurrence of the same defect class — the serializer exists (`backend/src/lib/serialize.ts`) but is not part of the repository template/convention.** Fix: apply at all return paths in both repositories, as done for observations/conversations/messages.

### F2 🟠 `markAsAnalyzed` batch-updates without existence checks
`observationRepository.markAsAnalyzed` writes `status:"analyzed"` to every requested id without verifying existence. Consequences: (a) `/ai/analyze` with a mix of valid ids and a *concurrently deleted* id silently writes to a nonexistent path (batch update of a missing doc **fails the whole batch** → the analysis was already persisted, so the client sees 201 but the write-back partially failed — inconsistent state, unlogged); (b) no per-doc error surfacing. Fix: fetch-and-filter existing ids first (single `getAll`), then batch only existing; treat vanished ids as acceptable (analysis RETAIN contract already tolerates dangling sources).

### F3 🟡 `research` contextType schema message now contradicts suggestion endpoint
Phase 4's F1 fix rejects `research`-context *conversations*; `POST /ai/suggest-research` legitimately references `analysisId` — no conflict in code, but the conversation-schema error message ("analyses arrive in a later phase") will read stale once Phase 5 *has* landed analyses. Cosmetic: update the message or lift the deferral (analyses now exist, though the conversation-context resolution for `research` type is still unimplemented in `contextBuilder`). Recommend: implement `research` context resolution against analyses now that the collection exists, or keep deferred with an updated message.

### M-notes (non-blocking)
* **M1:** `analyze` allows ≤10 ids (API.md ✓); `summarize`/`suggest` allow ≤20 (✓). Exactly-one-source refine for summarize ✓.
* **M2:** Suggestion acceptance does **not** implement the Idempotency-Key double-acceptance guard API.md §6.14 mentions ("Idempotency-Key honored — prevents double-accepting"). Same key retry currently creates two tasks. Add the same key-lookup pattern used by chat.
* **M3:** `analysisSchema` list filter uses `.passthrough()`-free plain object (good); `suggestionIndex` non-negative check present ✓.
* **M4:** Prompts are versioned modules with `promptVersion` propagated end-to-end ✓ (spot-checked all three).

---

## 4. Contract scorecard

| Contract | Status |
| --- | --- |
| API.md §6.15 pipeline: validate sources → context → model → schema-validate → persist | ✅ live-verified |
| ADR-009 zero-write on malformed/schema-violating output (`502`) | ✅ live-verified |
| `analyzed` write-back server-side only, status field only | ✅ live-verified |
| ADR-015 append-only + RETAIN with graceful dangling sources | ✅ live-verified |
| `includeSources=summary` | ✅ live-verified |
| FR-15 acceptance: ownership-checked, index-bounded, no autonomous tasks | ✅ live-verified |
| Task status transition validation (§6.14) | ✅ live-verified |
| Cross-user isolation on all new surfaces | ✅ live-verified |
| §6.14 Idempotency-Key on task acceptance | ❌ M2 |
| JSON-safe timestamps (§1.3) | ❌ F1 |

---

## 5. Tester-side note (transparency)

The first E2E run reported 28/30; both failures were **arithmetic errors in my own scenario script** (expected 3 analyses where four pipelines had legitimately created 4; expected 2 for the `observationId` filter where 3 reference the seeded observation). Corrected with documentation in-script; final run 30/30. Application behavior was correct in both cases — verified against raw emulator contents before concluding.

---

## 6. Recommended before merge

1. **F1** — apply `serializeTimestamps` in `analysisRepository` + `researchTaskRepository` (all return paths).
2. **F2** — existence-filter in `markAsAnalyzed` before the batch write.
3. **M2** — Idempotency-Key on research-task acceptance (reuse the chat key-lookup pattern).
4. F3 — decide: implement or re-message the `research` conversation context.
5. Regression tests for 1–3; rerun the 30-assertion E2E.

---

*Executed 2026-09-02 against the Phase 5 working tree on `feature/phase-5-structured-analyses`. Reproduction: emulators on 9099/8082 (JDK 21), backend via tsx with emulator env, tokens via Auth Emulator REST; the 30-assertion scenario is preserved in the session transcript.*
