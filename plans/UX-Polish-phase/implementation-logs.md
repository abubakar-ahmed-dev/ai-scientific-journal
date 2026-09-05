# UX Polish Phase — Implementation Log

Record per-block progress. Follows `plans/UX-Polish-phase/plan.md`.

---

## Block 1 — Sidebar app shell + grouped navigation

**Status:** Complete. Commit: `feat(frontend): grouped sidebar app shell with non-color active states`.

**What changed**
- `frontend/src/components/Layout.tsx` rewritten:
  - Desktop persistent sidebar (240px, fixed, scrollable) replaces the 8-link top navbar.
  - Canonical grouped sections (guidelines §3/§5): WORKSPACE (Dashboard) · RESEARCH
    (Observations, Research Map, Ask Journal) · WORK (Tasks, Projects) · AI (AI Chat);
    Settings anchored at the sidebar bottom.
  - Every item: lucide icon + visible text label. Section headings in uppercase micro-type.
  - Active state: subtle indigo background + left accent bar + semibold weight +
    `aria-current="page"` — not color alone (guidelines §5.2).
  - Header slimmed to logo / user chip / sign out. No fake search or notification icons
    (guidelines §7: never expose unsupported functionality).
  - Logo now links to `/dashboard` (previously `/` landing page).
  - All focus rings moved from `:focus` to `:focus-visible`.
  - Mobile drawer preserved: same grouped nav model (single `NAV_SECTIONS` source feeds both
    surfaces so they cannot drift), existing focus trap + Escape handling kept.
- `frontend/src/components/Layout.test.tsx`: drawer test updated to the grouped model
  (drawer container `aria-label="Mobile navigation"`; duplicate-nav role removed).

**Validation**
- tsc clean, eslint 0 errors.
- Layout + e2eJourney + LandingPage + Dashboard suites: 11/11 green.
- Committed together with `plans/UX-Polish-phase/plan.md`.

**Decisions**
- Sidebar collapse deferred (plan Block 1 "unless trivial"); not needed for judge-visible value.
- Command-palette header button intentionally absent until Block 4 implements the real thing.

---

## Block 2 — Dashboard restructure

**Status:** Complete. Commit: `feat(frontend): restructure dashboard around current research and activity`.

**What changed**
- `frontend/src/pages/DashboardPage.tsx` rewritten to the guideline hierarchy (§9–§18):
  - **Contextual greeting** replaces the "Research Dashboard" title: time-based
    ("Good morning/afternoon/evening") + subtitle "Continue your research where you left off."
  - **Current Research hero** (first content, §11): most recently updated active project.
    Shows title, description, status badge, and honest stats only — count of recent
    observations filed to the project, open task count, relative last-activity time.
    Primary action "Continue Research" → project detail; secondary "View all projects".
    **No progress bar**: the data model has no research-progress field and §11/§60.5 forbid
    fabricated percentages. Empty-active-projects fallback card with Create Project action.
  - **New-user onboarding state** (§20.1): when zero projects AND zero observations, the whole
    dashboard collapses to "Your research workspace is ready." + [Create Project] + numbered
    getting-started list (create project → record observation → explore AI).
  - **Quick actions** (§12): the four canonical actions — New Observation, Ask Journal,
    AI Chat, Add Task — as flat white cards (all gradient backgrounds removed, §2.1).
    Replaces the old Ask/Map/Chat/Projects set.
  - **Journal Intelligence** (§16/§22.2/§56): "AI suggestion" panel rendered only when a real
    analysis exists; surfaces the latest analysis' first suggested next step with a
    "Review analysis" link. Clearly labeled as an AI suggestion — never stated as fact.
  - **Metrics row demoted** below quick actions (§9): same honest counts, same "+N" hasMore
    semantics, compact styling.
  - **Today's Tasks** (§14): prioritized by status (in_progress → planned → suggested, recency
    tiebreak; no due-date field exists in the task model), max 5, whole row clickable,
    empty state offers [Add Task] ("You're all caught up").
  - **Recent Activity** (§17): observations + completed tasks + analyses merged into one
    chronological feed, relative timestamps, every item clickable to its object.
  - "Research Map" quick-action card intentionally dropped (secondary destination; its page
    remains reachable from the sidebar).
- Tests:
  - `DashboardPage.test.tsx` rewritten: greeting + hero + honest metrics + 4 canonical quick
    actions + AI-suggestion labeling; onboarding empty state; partial-failure retry banner (F6).
  - `e2eJourney.test.tsx`: dashboard assertions updated (duplicate-title matcher for
    observation list vs. activity feed; "View all projects" replaces removed card).

**Validation**
- tsc clean, eslint 0 errors.
- Touched suites (Dashboard, Layout, e2eJourney, ResearchTasksPage, InlineProjectCreator):
  13/13 green.
- Full frontend suite: 16/17 files pass. `MarkdownText.test.tsx` worker crashes with
  Node OOM at ~2 GB heap — reproduced on a clean tree (git stash test), pre-existing
  environment issue unrelated to this phase; the component and its tests are untouched here.

**Decisions**
- Progress % deliberately not implemented (no data model field).
- "Continue where you left off" (§15) is expressed through the Current Research hero +
  Recent Activity feed rather than a separate component — avoids two competing
  "continue" surfaces, which §15 itself warns against.

---

## Remaining blocks (pending)

- **Block 3** — Dialog/ConfirmDialog/Toast primitives; replace 4 `window.confirm()` sites;
  project-delete consequence copy; Saved states.
- **Block 4** — Ctrl/Cmd+K command palette MVP (page nav, quick actions, recent items).
- **Block 5** — Accessibility sweep (reduced-motion, aria names, focus-visible).
- **Block 6** — Projects/Tasks search + clear filters, observation-form progressive
  disclosure, Settings grouping + danger zone, breadcrumbs, remaining states.

**Environment note for future blocks:** full-suite vitest runs on this machine are flaky
(worker fork OOM ~2 GB ceiling on MarkdownText suite; pre-existing). Run touched suites
individually for reliable signal; revisit vitest pool config if a block touches MarkdownText.
