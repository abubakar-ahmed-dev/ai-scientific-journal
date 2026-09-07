# Dashboard Refactor — Plan (2026-09-07)

Status: **PROPOSAL — awaiting review. No code written yet.**
Branch will be `refactor/dashboard` off `dev` when approved.

Inputs: `plans/UI-polish/dashboard-refactor.md` (user guide — treated as advice),
`plans/UI-polish/UI-Guidelines.md` (app-wide rules — treated as constraints),
current `frontend/src/pages/DashboardPage.tsx` (750 lines, audited 2026-09-07).

---

## 1. Current-state audit (verified in code)

| What exists today | Verdict |
|---|---|
| New-user state: rocket icon + "workspace is ready" + numbered 3-step list + only a **Create Project** CTA | **Replace.** Rocket + numbered list is homepage-style; observation-first CTA missing (observations are the core object per UI-Guidelines §2) |
| Returning state order: hero → 4 quick-action cards → AI banner → 4 stat tiles → 2-col feeds | **Restructure.** Quick-action grid duplicates the sidebar nav (Ask / Chat / Tasks all already there) — classic template filler. Stat tiles duplicate the feeds below them |
| "Current Research" hero counts: `observations.filter(o => o.projectId === id).length` over the **6 fetched** rows | **Honesty bug.** Says "0 recent observations" for a project with 40. Backend already supports `projectId` filter — fetch real counts |
| AI suggestion banner: latest analysis regardless of age, links to `/observations` | **Fold into Research Brief** as a deterministic "suggested next step"; link to the actual analysis |
| Hand-rolled `Promise.allSettled` + 10 state atoms + per-section failure map | **Replace with react-query** (pattern already established by `useProfile.ts`). Per-query retry comes free; ~150 lines of plumbing die |
| `relativeTime`, `greeting`, `STATUS_PRIORITY` inline | Move to `lib/` (reusable, testable) |
| Empty-observations panel inside returning state, "No active research" panel | Keep concept, restyle compact |
| Greeting header + New Observation button | Keep (works) |

Verified backend facts that unlock guide items:

- `CreateObservationSchema` accepts `status: "draft" | "observed"` → **inline Quick Capture draft save is supported by the existing API** (guide offered it as optional; it's cheap and real).
- `ListObservationsQuerySchema` supports `projectId` + `status` query params → per-project counts and per-project brief data are honest without new endpoints.
- No due-date field on ResearchTask → guide's "2 due soon" stat line is **not implementable**; excluded.
- No weekly-count endpoint → guide's "+3 this week" trend is **not honestly computable** client-side (page-limited fetches ≠ totals); excluded rather than faked.
- Analysis generation entry point lives on ObservationDetailPage (`generateAnalysis`) → AI cards deep-link there; no inline analysis invocation from dashboard.

---

## 2. Goals

1. New-user dashboard = **one clear action**: record the first observation. No marketing echo of the homepage.
2. Returning-user dashboard = research command center: what's active → what AI can do now → what changed.
3. Kill template smell: no nav-duplicating quick-action grid; no `0`-only stat tiles for new users (reviewer decision: returning users keep a meaningful stats row).
4. All numbers on the page real (fix the miscounted hero).
5. Data layer on react-query; component split so DashboardPage stops being a 750-line monolith.

## 3. Non-goals

- No new backend endpoints, no schema changes, no AI calls from the dashboard.
- No dark theme, no notifications, no sample/demo data, no fake trends or due-soon claims.
- No route changes; sidebar/header shell untouched.
- No changes to other pages beyond shared utils extraction.

---

## 4. Decisions and deviations (resolved in review, 2026-09-07)

| Guide says | Plan does | Why |
|---|---|---|
| Stats row: 4 cards with "+3 this week" / "2 due soon" secondary lines | **Returning state keeps a stats row**; new-user state has none (Workspace Readiness + Feature Previews replace it). Tile secondary lines = **links only** ("View journal", "Manage projects", "Open tasks board", "Review analyses") — no trend/due-soon claims | Reviewer decision 2026-09-07: stats meaningful for returning users, empty `0` tiles hurt new users. Trends/due-soon not computable honestly (no endpoints) |
| AI Research Assistant Row with "Suggest Next Steps" card | Card kept but targets the **latest observation's detail page** (where analysis types are actually generated) | No dashboard-side analysis invocation exists; honesty over layout symmetry |
| "Today's Research Brief … 1 recent observation" | Same card, but counts fetched per-project (real numbers), badge = project status | Guide's layout right, its numbers were illustrative |
| Workspace Readiness card with "✓ AI assistant available / ✓ Secure storage ready" | Kept, trimmed to real states only (account active, AI enabled, storage ready, observation count status) | Fine as-is; rows derived from actual fetch success, not decoration |

Everything else in the guide (section order, 2fr/1fr grid, compact cards, muted feature previews, responsive collapse) is adopted.

---

## 5. Target design

### 5.1 New-user state (zero observations AND zero projects, fetches confirmed)

```
┌──────────────────────────────────────────────────────────────┐
│ Good morning                                    [+ New       │
│ Start your first research record.               Observation] │
├──────────────────────────────────────────────────────────────┤
│ ┌─ Primary start panel ────────────────────────────────────┐ │
│ │ (notebook icon)                                          │ │
│ │ Start with one observation.                              │ │
│ │ Capture what happened, add notes or measurements…        │ │
│ │ [Record First Observation]  [Create Project]             │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌─ Quick Capture (2fr) ───────────┐ ┌─ Workspace (1fr) ────┐ │
│ │ Title                           │ │ ✓ Account active     │ │
│ │ What did you observe?           │ │ ✓ AI assistant ready │ │
│ │ [Save Draft] [Open Full Form]   │ │ ✓ Private storage    │ │
│ │                                 │ │ ○ No observations yet│ │
│ └─────────────────────────────────┘ └──────────────────────┘ │
│ ┌ AI Analysis ┐ ┌ Research Map ┐ ┌ Research Tasks ┐ (muted)  │
│ │ unlocks after first observation │ │ appears with location │…  │
└──────────────────────────────────────────────────────────────┘
```

Decisions:

- **Observation-first CTA.** "Record First Observation" is primary; "Create Project" secondary. Projects optional per PRD/UI-Guidelines §2.
- **No stat tiles in this state** (reviewer decision 2026-09-07): four `0` tiles read as emptiness. Workspace Readiness + Feature Previews carry the orientation job instead.
- **No rocket, no numbered onboarding list.**
- **Quick Capture is a real form** (existing POST /observations, `status: "draft"`): title + description, saves via react-query mutation → toast "Draft saved" + link to the created observation. Drafts appear in the journal as draft — honest, no new backend. Validation errors render inline near fields.
- **Workspace Readiness rows are evidence-based**: check/circle per actually-confirmed fetch (account = authed; AI = `/me` + analyses endpoint healthy; storage = media endpoint config — static row "Private storage ready" only if it reflects real config; otherwise dropped). No fake checks.
- **Feature preview cards muted** (border, not tinted; small icon + one sentence). They are informational, not buttons that look interactive — `cursor-default`, no hover-lift. AI Analysis card notes "Unlocks after your first observation."

Edge: projects exist but zero observations (or vice versa) → not "new user". Route to returning state; its empty-observations panel handles the gap. Only the true zero/zero case gets onboarding. (Guide didn't address this; current code has same rule — keep it.)

### 5.2 Returning-user state

```
┌──────────────────────────────────────────────────────────────┐
│ Good evening                                    [+ New       │
│ Recent research activity                        Observation] │
├──────────────────────────────────────────────────────────────┤
│ ┌─ Today's Research Brief (full width) ────────────────────┐ │
│ │ CURRENT RESEARCH  [ACTIVE]                               │ │
│ │ Project title                                            │ │
│ │ Short description                                        │ │
│ │ 8 observations · 3 open tasks · last activity 2h ago     │ │
│ │ ▸ Suggested next step: Analyze your latest observation.  │ │
│ │ [Continue Research] [Analyze Latest] [View Project]      │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌ Analyze Latest ┐ ┌ Ask Journal ┐ ┌ Review Analyses ┐      │
│ └────────────────┴───────────────┴─────────────────────────┘ │
│ ┌─ Stats row: Observations · Active Projects · Open Tasks ·  │
│ │              AI Analyses  (secondary line = link) ──────── │
│ ┌─ Recent Observations (2fr) ──┐ ┌─ Today's Tasks (1fr) ──┐ │
│ │ Title · date · meta · badge  │ │ task rows (max 3)      │ │
│ │ …max 4, compact, clickable   │ │ ──────────────────────  │ │
│ │                              │ │ Recent Activity         │ │
│ │                              │ │ · Observation added 37m │ │
│ └──────────────────────────────┘ └────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Decisions:

- **No counts line in the header** (reviewer decision 2026-09-07): subtext is non-count wording ("Recent research activity" or project-aware equivalent). Capped page counts must never masquerade as totals.
- **Stats row (returning state only)**: Observations / Active Projects / Open Tasks / AI Analyses. Primary number = count from fetched data with explicit `+` suffix when `meta.hasMore` caps it (existing convention — the `+` is the honesty marker). Secondary line = **link only** (View journal / Manage projects / Open tasks board / Review analyses). No trend lines, no "due soon". Tiles hidden when the backing query failed (retry panel instead), and no zero-only walls: tiles render regardless of value for returning users, since real activity exists around them.
- **Research Brief** (replaces hero + AI banner):
  - Most-recently-updated active project (current logic kept).
  - Counts scoped with `fetchObservations({ projectId, limit: 1 })` `meta` and open tasks per project — real numbers, not the 6-row filter.
  - **Suggested next step** = deterministic, zero-cost rule, first match wins:
    1. Latest observation unanalyzed → "Analyze your latest observation."
    2. `suggested` tasks from AI exist → "Review N task suggestions from your last analysis."
    3. Open tasks exist → "You have N open tasks."
    4. No active project but observations exist → "Group your observations into a project."
    5. Fallback: "Record a new observation."
    Labeled as a hint, not AI output (it isn't). Where the real latest-analysis `suggestedNextSteps[0]` exists and is fresh, prefer it and label it "From your last analysis" — AI-labeled, violet accent, links to the analysis. Both sources clearly attributed (UI-Guidelines §6).
  - No active project variant: brief shows latest observation activity instead (guide's fallback), with "Create Project" CTA.
- **AI row (3 cards)**: Analyze Latest → `/observations/:latestId` (Analyze lives there); Ask Journal → `/ask`; Review Analyses → latest **analyzed** observation's detail (analysis viewer lives there). If no analyzed observation exists, that card renders its empty variant: "No analyses yet" + inline links to Analyze Latest / Ask Journal (reviewer decision 2026-09-07 — no new analyses listing page). Violet accent only on this row. Cards are real links with descriptions; row omitted when no observations exist at all (that's the new-user state).
- **Recent Observations (left, 2fr)**: max 4, existing card anatomy (title, description clamp, date · measurements · files · location label, status pill), whole card clickable, "View all →". Skeletons while loading; amber retry panel per-section on failure (current F6 behavior preserved via react-query error states).
- **Today's Tasks (right, 1fr)**: max 3 by current priority sort (status priority → recency). Empty state "You're all caught up" + Add Task. "View all →".
- **Recent Activity (right, below tasks)**: unchanged concept (client-side merge of observations/completed tasks/analyses, max 6, clickable, relative time).

### 5.3 Responsive

- Desktop: brief full width; AI row 3-col; content 2fr/1fr; new-user capture 2fr/1fr.
- Tablet (~≤1024px): AI row 3→1 or 2-col; content stacks; capture stacks.
- Mobile: everything single column; header buttons full-width; cards never overflow. Page paddings via existing Layout container.

---

## 6. Data layer refactor

Replace the hand-rolled loader with react-query (project already depends on it):

- `useDashboardData()` in `frontend/src/lib/useDashboardData.ts`:
  - `useQuery` per source: observations (limit 4, recent), projects (active + recent), tasks (suggested/planned/in_progress/completed — current 4-fetch pattern kept), analyses (limit 5), conversations omitted (currently fetched and discarded — dead request, delete it; one fewer network call).
  - `refetch` per query → per-section retry without reloading everything (preserves F6).
  - `staleTime` ~60s so sidebar round-trips don't refetch.
- Derived helpers stay pure functions (testable without React): `pickCurrentResearch`, `summarizeTasks`, `buildActivity`, `nextStepSuggestion`.
- Shared utils → `frontend/src/lib/format.ts` (`relativeTime`, `greeting`).

Component split (all under `frontend/src/components/dashboard/`):

| Component | Responsibility |
|---|---|
| `DashboardHeader` | Greeting, non-count subtext, New Observation button |
| `ResearchBrief` | Returning-state hero card + next-step hint |
| `AiActionsRow` | 3 AI cards incl. Review Analyses empty variant |
| `StatsRow` | Returning-state 4 tiles, link secondary lines, `+` cap marker |
| `RecentObservationsFeed` | Left column incl. loading/error/empty |
| `TasksPanel` | Right column tasks incl. empty/error |
| `ActivityFeed` | Right column activity |
| `NewUserDashboard` | §5.1 composition (header + start panel + capture + readiness + previews) |
| `QuickCaptureForm` | Inline draft form (title + description only, `status: "draft"`) + mutation + inline errors; on success → route to the new observation's detail/edit page, or success state with "Continue editing" link — whichever reads cleaner at impl, both end at the created record |
| `WorkspaceReadiness` | Evidence-based status rows |
| `FeaturePreviews` | 3 muted cards |

`DashboardPage.tsx` shrinks to: pick state (new vs returning, outage-aware), compose components. Error banner (partial failure) stays at page level.

---

## 7. Honesty fixes checklist (each is a defect today)

1. Hero "N recent observations" miscounts (filters 6 fetched rows) → real per-project count.
2. AI banner unattributed age → next-step hint labeled + linked to its source.
3. Conversations fetched then discarded → request deleted.
4. Stat tiles with `hasMore`-blind counts → explicit `+` cap marker kept (returning stats row); header carries no counts at all.
5. Quick-action grid implying features (none broken, but nav-duplicating) → removed.

---

## 8. Work items

| # | Item | Files | Effort |
|---|---|---|---|
| 1 | `useDashboardData` + `format.ts` utils; delete conversations fetch | `lib/useDashboardData.ts`, `lib/format.ts` | M |
| 2 | Dashboard components (table §6) + page rewrite, both states | `pages/DashboardPage.tsx`, `components/dashboard/*` | L |
| 3 | Quick Capture draft mutation (POST /observations, status draft) + toast + inline errors | `components/dashboard/QuickCaptureForm.tsx` | M |
| 4 | Research brief real counts (projectId-scoped fetch meta) + deterministic next-step | `ResearchBrief.tsx` | M |
| 5 | Tests: new-user state (no rocket/numbered list, observation-first CTA, no stat tiles, quick-capture save + validation), returning state (stats row `+` marker, brief counts, next-step rule table-driven, AI row targets + Review Analyses empty variant, feeds, per-section failure retry), utils | `DashboardPage.test.tsx` (rewrite), new component tests | M |
| 6 | Docs: no API/schema change; note in `plans/UI-polish/implementation-logs.md` | — | S |

No backend work. No dependency additions.

## 9. Validation plan

- `npm run lint` + `tsc` + `vitest` (frontend).
- `npm run build`.
- Browser smoke vs local emulators, both states: (a) fresh account → onboarding layout, quick-capture draft round-trip; (b) seeded account → brief counts match real data, next-step correctness for rules 1–5, AI row links, mobile 390px + tablet 768px screenshots.
- Contrast check on new muted/hint surfaces (4.5:1 body text).

## 10. Review outcome (resolved 2026-09-07)

1. **Stats row**: removed from new-user state only; kept for returning users with link-only secondary lines (no trends, no due-soon).
2. **Quick Capture**: real draft save (`status: "draft"`, existing API). Title + description only. On success route to observation detail/edit or success + "Continue editing".
3. **Review Analyses**: targets latest analyzed observation's detail page; empty variant = "No analyses yet" + links to Analyze Latest / Ask Journal. No new listing page.
4. **Header counts line**: omitted. Subtext uses non-count wording. Capped counts never presented as totals; `+` marker only inside returning stats tiles.

Ready for implementation on approval — branch `refactor/dashboard` off `dev`.
