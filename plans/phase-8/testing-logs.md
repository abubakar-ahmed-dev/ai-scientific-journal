# Phase 8 — Frontend Application Completion: Independent Testing Log

**Date:** 2026-09-04
**Tester:** Claude (independent verification — per CLAUDE.md "Do Not Trust Previous Claims"; every gate re-executed, every claim checked against source, canonical docs, and the real backend data flow)
**Branch:** `feature/phase-8-frontend-completion` (working tree, uncommitted — base `a78eb77`, the phase-7 merge)
**Scope tested:** all Phase 8 deliverables per `plans/phase-8/plan.md` §0–§5

---

## 1. Verdict

**Substantially implemented and visually complete — 2 high-severity correctness gaps in the dangling-source feature, 1 plan-vs-canonical-docs conflict, and 5 medium gaps in the E2E journey, metrics semantics, error handling, and chat polish.**

The core Phase 8 surfaces (mobile drawer, landing page, dashboard aggregation, version snapshot modal, ErrorBoundary, status filter tabs, provenance badges) are implemented and all automated gates pass. However:

* 🔴 **F1: The dangling-source UI (`AnalysisViewer`) never receives the data it needs in the real app.** `sourceSummaries` is only produced by `GET /analyses/:id?includeSources=summary`, but no component ever calls that endpoint — so deleted observations render as **clickable links to a 404** instead of the required `[Observation deleted]` pill. Component tests pass only because their fixtures inline `sourceSummaries`, which production data flow never supplies.
* 🔴 **F2: Deleted-project handling (`[Unfiled project]` pill, plan §3.3) is not implemented at all.**
* 🟠 **F3: Plan §3.1 requires historical location/tags in the version snapshot — the canonical schema (DATABASE_SCHEMA.md §9) deliberately does not store them.** Plan and canonical docs conflict; per CLAUDE.md this is surfaced, not silently resolved.
* 🟠 The E2E journey implements ~6 of the plan's 10 steps; chat, map, media-gallery, and observation-form steps are absent (F5).

---

## 2. Independent gate re-runs (re-executed by tester, 2026-09-04)

| Gate | Command | Result |
| :--- | :--- | :--- |
| Frontend typecheck | `npm --prefix frontend run typecheck` | ✅ 0 errors |
| Frontend tests | `npm --prefix frontend run test` | ✅ **14 files, 33/33 passed** (up from 7 files / 18 tests at phase-7 close) |
| Frontend lint | `npm --prefix frontend run lint` | ✅ exit 0 — but **10 warnings, several in phase-8-changed files** (see K2) |
| Frontend build | `npm --prefix frontend run build` | ✅ built; Leaflet verified **out** of the initial bundle (phase-7 K1 regression check passes); main chunk 523 kB triggers a >500 kB chunk-size warning (F12) |
| Backend regression | `npm --prefix backend run test` | ✅ **25 files, 156/156 passed** (no backend changes in this phase) |
| Backend typecheck / lint / build | per-app scripts | ✅ all clean |

---

## 3. Findings → required fixes

### Correctness findings

| ID | Severity | Finding | Required fix |
| :-- | :-- | :-- | :-- |
| **F1** | 🔴 High | **Dangling-source rendering is dead code in the production data flow.** `AnalysisViewer` renders `[Observation deleted]` pills only from `analysis.sourceSummaries`. That field is produced **only** by `GET /analyses/:id?includeSources=summary` (`analysisRepository.findByIdWithSourceSummary`). The actual render paths feed `AnalysisViewer` from (a) `fetchAnalyses({observationId})` — the **list** endpoint, which returns plain `AnalysisDocument`s without `sourceSummaries` — and (b) `generateAnalysis` / `generateResearchSuggestions` responses, built by `analysisRepository.create`, which also never attach `sourceSummaries`. `fetchAnalysis()` (the one client wrapper that passes `?includeSources=summary`) has **zero call sites**. Net effect: with a deleted source observation, `hypotheses[].supportingObservationIds` falls through to the default branch and renders a **clickable link with the raw ID → 404 page** — exactly the failure plan §3.3 forbids ("NEVER crash, display blank entries, or fail silently", "no broken links"). | Wire the real data flow: in `ObservationDetailPage.loadAnalyses()`, after listing analyses, resolve sources (call `fetchAnalysis(id, true)` per analysis, or batch-resolve `observationIds` via `fetchObservation` with 404→deleted mapping) and pass resolved summaries to `AnalysisViewer`. Alternative: extend the analyses **list** route to accept `includeSources=summary` server-side (small backend change, one round trip). Then update `AnalysisViewer.test.tsx` fixtures to derive from the same path the app uses so the test can no longer mask the gap. |
| **F2** | 🔴 High | **Deleted-project pill absent.** Plan §3.3 / API.md §7.2 require: `projectId` resolves → link `/projects/:id`; project deleted → `[Unfiled project]` neutral badge. `AnalysisViewer` never renders `analysis.projectId` at all (it only forwards it to `createResearchTask`). Grep for "Unfiled"/"deleted project" in `AnalysisViewer.tsx`: no match. | Add a project reference row in the Referenced Sources section (or header), resolved the same way as F1 (project exists → link; fetch 404 → `Unfiled project` badge). Note: there is no `includeSources` equivalent for projects — resolution must go through `fetchProject` and treat `404` as deleted. |
| **F3** | 🟠 Med | **Plan-vs-docs conflict on version snapshot contents.** Plan §3.1 requires the modal to show "Historical Location and Precision setting, Historical Tags". The canonical snapshot schema (DATABASE_SCHEMA.md §9 — fixed per ADR-016) stores only `version/title/description/hypothesis/measurements/editedAt/editedBy/changeReason`; `observationVersionRepository.createSnapshot` writes exactly those fields. The implemented `VersionSnapshotModal` is **faithful to the canonical schema**; the plan over-promises. Per CLAUDE.md ("When documentation conflicts… stop and identify the conflict") this is surfaced, not silently patched. | Decide and record: (a) accept canonical scope — fix the plan's expectation and the compare tab stays title/description/measurements (recommended: no schema migration, ADR-016 intact); or (b) extend the snapshot schema with `location`/`tags` — requires a schema change + ADR and is **not** justified as polish. Do not implement (b) implicitly. |
| **F4** | 🟠 Med | **Dashboard metric cards are mislabeled and truncated.** Cards claim "Observations / Active Projects / Research Tasks / AI Analyses" totals but render `array.length` from pages capped at `limit: 6/20/5/5`. The backend `meta` is `{nextCursor, hasMore, limit}` — **no `total`** (paginationSchema.ts) — so a journal with 40 observations permanently shows "6". Plan §2.2 calls these "Total … count". Also `fetchResearchTasks({limit: 5})` fetches the 5 **newest** tasks then filters client-side for pending — an older pending task beyond the page is invisible. | Either (a) relabel cards honestly ("Recent Observations" etc. — zero-risk, recommended for MVP), or (b) fetch with a large page size (dishonest at scale), or (c) add `meta.total` server-side (API contract change — needs an API.md note; not a Phase 8 frontend-only change). For tasks, request a larger limit or a `status` filter server-side (`fetchResearchTasks` already supports `status`). |
| **F5** | 🟠 Med | **E2E journey covers ~6 of the plan's 10 steps.** Implemented: landing sign-in (click-assert only; no route transition — acceptable in jsdom), dashboard, observation detail render, AI analysis, suggestion acceptance, version-history inspection, Ask My Journal. **Missing:** step 3 observation *recording* (form fill via `ObservationFormPage` — plan §5.2 step 3), media gallery inspection (step 4), stateful chat send + assistant response with model provenance (step 7 — `ChatWindow`/`ConversationsPage` not exercised at all in the journey), research map step (step 9). TESTING.md §8 positions this suite as the regression backbone; the missing steps are exactly the phase-4/6/7 surfaces. | Extend `e2eJourney.test.tsx`: mount `ObservationFormPage` and assert create-payload; mount `ChatWindow` with a stubbed `sendMessage` asserting optimistic user turn + assistant provenance pill + retry-preserves-input; mount `ResearchMapPage` (already has its own tests — a smoke pin assertion in the journey suffices); optionally a MediaGallery render step. Keep Gemini stubbed. |
| **F6** | 🟠 Med | **Dashboard partial-failure handling misleads and the error path is dead code.** `Promise.allSettled` rejections are swallowed (`if fulfilled` only) — if `fetchAnalyses` or `fetchResearchTasks` fails, the section renders the **empty state** ("No structured analyses generated yet…"), which asserts data absence that may be false. Because `allSettled` never rejects, the `catch` setting `error` is unreachable and the Retry banner can never appear. Violates TA §54 (error + retry must be distinct from empty) which the plan adopts globally. | Track per-section settled state; render a per-section error card with Retry (re-running `loadDashboardData`) when any promise rejected, instead of the empty state. Add a test: one fetch rejects → error card visible, empty state not. |
| **F7** | 🟡 Med | **Chat claims "Markdown supported" but renders plain text.** `ChatWindow` footer asserts markdown support; assistant content renders via `whitespace-pre-wrap` only; no markdown library exists in `package.json`. Plan §4.2 requires markdown rendering for assistant responses. Raw `**bold**`/code fences display literally. | Decide: (a) add `react-markdown` (new dependency — justified by an explicit plan deliverable; restrict rendering to assistant messages only, never user content, and disable raw HTML) and update the footer claim; or (b) drop the "Markdown supported" claim for MVP. Do not leave the UI claiming a capability it lacks. |
| **F8** | 🟡 Med | **Context indicator shows raw IDs, not titles.** Plan §4.2: banner "Discussing Observation: [Title]". `ChatWindow` header renders `Context: observation` + `ID: obs_123` verbatim. No title resolution for `contextId`. | In `ConversationsPage`/`ChatWindow`, resolve `contextId` via the already-loaded observation/project queries (both pages already have the data or the query hooks) and render the title; fall back to the raw ID when unresolvable (deleted context — consistent with dangling-reference behavior). |
| **F9** | 🟡 Low-Med | **No focus trap / initial focus in `Layout` drawer or `VersionSnapshotModal`.** Plan §1.1 ("Trap focus inside drawer when open") and §3.1 (modal focus trap). Escape-close ✅ (both, tested); backdrop click ✅; but Tab cycles into background content while open, and focus is not moved into the drawer/modal on open. Violates the plan's a11y contract (TA §55). | On open: move focus to the first focusable element; trap Tab within the container (small `useEffect` keydown handler on the container, or a dependency-free focus-trap helper co-located in the component — avoid a new dependency for this); restore focus to the trigger on close. |
| **F10** | ⚪ Low | **Test-expansion items from plan §5.1/§2.3 not done:** `LandingPage.test.tsx` is still the original 29-line test — the plan's required expansion (pillar grid, authenticated-redirect behavior) was not implemented; `DashboardPage.test.tsx` covers populated + empty but not the loading skeleton assertion or (per F6, currently impossible) the error/retry path. | Expand `LandingPage.test.tsx` (redirect when `currentUser` set — mock `useAuth` per-test; feature-grid smoke). After F6, add the dashboard error/retry test. |
| **F11** | ⚪ Low | **Quick action "+ New Project" missing from dashboard.** Plan §2.2 lists four quick actions; implemented cards are Ask My Journal / Research Map / AI Chat (+ "New Observation" in the header). No "+ New Project" affordance exists on the dashboard. | Add a fourth quick-action card linking to `/projects` (the projects page hosts creation), or fold "+ New Project" into an existing card's menu. |

### Cleanup / convention findings

| ID | Finding | Recommendation |
| :-- | :-- | :-- |
| **K1** | **Fetch-pattern inconsistency re-introduced in rewritten pages.** Phase 7's review (K3/F12) established TanStack Query as the convention and migrated offenders; Phase 8 rewrites (`DashboardPage`, `ProjectDetailPage`, `ProjectsPage`, `ObservationDetailPage`) keep hand-rolled `useEffect` + `loadX()` + `useState` fetch state, while `ChatWindow`/`MediaGallery`/`ConversationsPage`/`AskMyJournalPage` use TanStack Query. | Not a blocker. Migrate the rewritten pages to `useQuery`/`useMutation` opportunistically — it would also structurally fix F6 (per-query `isError`/`refetch`) and the K2 warnings below. |
| **K2** | **Lint warnings in phase-8-changed files** (phase 7's stated bar was "0 warnings in all changed/new files"): `set-state-in-effect` in `Layout.tsx:13`, `DashboardPage.tsx:75`, `ObservationDetailPage.tsx:83`, `ProjectDetailPage.tsx:53`, `ProjectsPage.tsx:32`; `exhaustive-deps` in `ObservationDetailPage.tsx:83`, `ProjectDetailPage.tsx:53`; plus pre-existing `ObservationsPage.tsx:49` and `authContext.tsx:58`. All are the hand-rolled-fetch pattern symptom. | Resolved as a side effect of K1's migration; if deferring, at minimum silence-free fix `Layout.tsx` (the drawer close can derive from `location.key` state or use the link `onClick` already present — the effect is redundant with the per-link `onClick` handler). |
| **F12** | **Main chunk 523 kB** (gzip 146 kB) — rolldown emits a >500 kB warning. Leaflet is correctly split (verified: no `leaflet` reference in `index-*.js`). The growth comes from dashboard/landing/detail pages landing in the entry chunk. | Non-blocking polish: `React.lazy` the heaviest below-the-fold surfaces (e.g. `AnalysisViewer` on detail, or keep as-is for MVP) or raise `chunkSizeWarningLimit` with a recorded note. |

### Refuted / no action during verification

- *"Sign-in auto-redirect is unimplemented"* — it exists (`LandingPage` `useEffect` → `/dashboard` replace, and `App.tsx` route gate `/` → `<Navigate to="/dashboard">`); only its **test** is missing (F10).
- *"Hidden-location leak on dashboard"* — `DashboardPage` renders `location.label` only when `precision !== "hidden"` and never renders coordinates anywhere; `ResearchMapPage`/`ObservationMiniMap` sanitizers from phase 7 remain the display authority. ✅
- *"Version history toggle desync"* (`setShowVersions(!showVersions)` in async closure) — real but benign: single-user local toggle, worst case one extra click. Cosmetic; fold into K1 if migrated to query state.

---

## 4. Verified-positive checks (plan conformance confirmed working)

* **Task 1 (Layout):** mobile hamburger with `aria-expanded`/`aria-controls`/`aria-label` ✅; slide-over drawer with backdrop dismiss + per-link close ✅; Escape close ✅ (tested); active-route indigo pill styling ✅; desktop user pill + initial-avatar fallback ✅; skip-link ✅; `header[role=banner]`/`nav[aria-label]`/`main[role=main]` landmarks ✅. (Focus-trap gap → F9.)
* **Task 2 (Landing):** hero, 4-pillar grid, 4-step workflow, security reassurance, footer, sign-in CTAs (header + hero) all present; authenticated redirect live. Test expansion gap → F10.
* **Task 2 (Dashboard):** `Promise.allSettled` of the five planned fetches ✅; metric grid, quick actions (3 of 4 — F11), recent-observations feed with status badges/measurements/media/location-label, tasks + analyses side column, skeleton loading, empty onboarding card ✅. Semantics → F4/F6.
* **Task 3 (Versions):** revision timeline cards + `VersionSnapshotModal` with snapshot-details tab (title/description/hypothesis/measurements/changeReason) and side-by-side compare tab ✅; Escape + backdrop + button close, `role="dialog"` + `aria-modal` + `aria-labelledby` ✅ (tested). Scope conflict → F3.
* **Task 3 (Dangling):** `AnalysisViewer` has the correct *rendering* design (`sourceSummaries` → live link vs `[Observation deleted]` badge; truncated-ID badge with tooltip in Referenced Sources) and passing tests — but the data flow never supplies it (F1) and the project half is absent (F2).
* **Task 4:** Projects status filter tabs (`all/active/completed/archived` with counts) ✅; project detail observations/tasks tabs with count badges + "Add Observation to Project" ✅; delete confirm warns "observations will NOT be deleted… set to unfiled" (ADR-021 semantics) ✅; chat user/assistant bubble distinction + model/latency/token provenance pills + AI-safety disclaimer ("AI suggestions should be experimentally verified…") + retry-preserves-input (`failedContent`) ✅; `ErrorBoundary` at root in `main.tsx` with Reload/Go-to-Dashboard ✅ (tested).
* **Privacy & provenance:** model + promptVersion badges on analyses and Ask My Journal answers ✅; `hidden` location never rendered ✅; mediaCount/location-label handling on dashboard cards ✅.
* **Backend contract sanity (read-only):** versions endpoints return `{data, meta}` matching the client's `res.data` usage ✅; `GET /analyses/:id?includeSources=summary` exists and works — it is the *client wiring* that's missing (F1); pagination `meta` has no `total` (basis of F4).

---

## 5. Recommended fix order (before merge to `dev`)

1. **F1 + F2** — make dangling-source rendering real (core plan deliverable, currently user-visible wrong behavior); re-point `AnalysisViewer.test.tsx` at the production data path.
2. **F6** — dashboard per-section error/retry (small, removes a misleading state).
3. **F4** — relabel or correctly source the metric cards (pick option (a) for MVP).
4. **F5** — extend the E2E journey with the form/chat/map steps (regression-backbone completeness).
5. **F7 / F8 / F9** — chat markdown decision + implementation or claim removal; context-title banner; focus traps.
6. **F3** — record the version-snapshot scope decision (recommend: canonical scope wins; fix the plan text; no schema change).
7. **F10 / F11 / K1 / K2 / F12** — test expansion, missing quick action, convention migration, bundle note. K1/K2 may be deferred to a post-merge cleanup commit if time-constrained; they carry no behavioral risk.

---

## 6. Residual items (documented, not blocking)

1. Backend regression gate passed as-is (156/156) — no backend changes in this phase; F1's preferred fix (list-endpoint `includeSources`) would be the first backend touch and must keep the API.md §6.13 note updated.
2. Browser-level (real viewport) responsiveness and WCAG contrast were **not** machine-verified in this pass — jsdom tests + static Tailwind class review only. The plan's §4.2 manual checklist (375 px–1440 px, touch targets, contrast) still needs a human/browser pass before calling NFR-03 done.
3. `meta.total` (F4 option c) is an API-contract change — if ever pursued, it belongs in API.md + backend pagination schema, not a frontend-only patch.

---

*All commands executed 2026-09-04 against the phase-8 working tree on `feature/phase-8-frontend-completion`. Data-flow claims (F1/F2/F4) verified by reading `frontend/src/lib/api.ts`, `frontend/src/pages/ObservationDetailPage.tsx`, `backend/src/routes/analyses.ts`, `backend/src/routes/ai.ts`, `backend/src/repository/analysisRepository.ts`, `backend/src/repository/observationVersionRepository.ts`, and `backend/src/schemas/paginationSchema.ts`; no fix code was applied by this testing pass.*
