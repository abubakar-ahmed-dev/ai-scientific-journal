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

## Block 3 — Feedback primitives & destructive actions

**Status:** Complete. Commit: `feat(frontend): accessible confirm dialogs, toasts, and saved states`.

**What changed**
- New primitives in `frontend/src/components/ui/`:
  - `Dialog.tsx` — accessible modal: `role="dialog"` + `aria-modal` + accessible name,
    Escape closes, Tab focus trap, focus restored to the triggering element on close.
  - `ConfirmDialog.tsx` — destructive variant (red confirm button + warning icon, `autoFocus`
    on Cancel-first flow avoided: confirm focused for non-destructive, red for destructive);
    consequence text slot; used for all destructive confirmations (guidelines §53).
  - `Toast.tsx` — `ToastProvider` + `useToast()` (`success`/`error`), 4.5 s auto-dismiss,
    manual dismiss buttons, `aria-live="polite"` region, `role="status"`/`role="alert"`.
    Provider mounted once in `App.tsx`.
- Replaced all 4 `window.confirm()` call sites with `ConfirmDialog`:
  - Project delete: states the project is permanently deleted and that observations/tasks are
    kept as unfiled (matches `projectRepository.delete()` side effect, DATABASE_SCHEMA §19).
  - Observation delete: observation + media + version history deleted; analyses kept.
  - Conversation delete: conversation + all messages deleted.
  - Task delete: task deleted.
  - Delete triggers carry `aria-haspopup="dialog"` + `focus-visible` rings.
- Toasts wired into project/observation/conversation/task create/update/delete success and
  failure paths. Routine saves stay inline: SettingsPage button now shows `Saving…` →
  `✓ Saved` transient state (2.5 s, green) instead of a toast (guidelines §38/§39).
- Tests: `components/ui/ui.test.tsx` (6 cases: confirm actions/Escape/closed state; toast
  roles, manual dismiss, auto-dismiss, provider guard). Conversations/ResearchTasks/
  ProjectDetail/e2eJourney suites updated with a Toast module mock.

**Validation:** tsc clean, eslint 0 errors, affected suites 13/13.

---

## Block 4 — Command palette MVP

**Status:** Complete, awaiting user browser verification.

**What changed**
- `frontend/src/components/CommandPalette.tsx` (new): Ctrl/Cmd+K palette (guidelines §7/§45).
  - Sources — real capabilities only: 8 page-nav items, 4 quick actions (New Observation,
    Ask Journal, Open AI Chat, Create Task), plus 5 most-recent projects and 5 most-recent
    observations fetched on open via existing list endpoints.
  - Query filters item labels/sections only — no fake full-text search (guidelines §7).
  - Keyboard-first: input autofocused, ↑/↓ cycle, Enter activates, Esc closes,
    Tab wraps input↔list; `role="dialog"` + `aria-modal`, `role="listbox"`/`option`
    with `aria-selected`, hover syncs active row, `⏎` hint icon on active row.
  - Focus restored to the trigger on close.
- `Layout.tsx`: global Ctrl/Cmd+K listener (toggle), header `Search… Ctrl K` button
  (hidden on xs, real behavior — opens the palette), palette mounted at shell root.
- Tests: `CommandPalette.test.tsx` (5 cases: closed/open render, query filter,
  recent projects/observations load, arrow+Escape, Enter-activates-closes).

**Validation:** tsc clean, eslint 0 errors, palette + Layout + e2eJourney + Dashboard +
ui suites 13/13.

---

## Block 5 — Accessibility pass

**Status:** Complete.

**What changed**
- `frontend/src/index.css` (global):
  - `:focus-visible` outline (indigo, 2px, offset) on every focusable element — keyboard
    users always see focus; mouse users do not get spurious outlines.
  - `prefers-reduced-motion: reduce` guard: `animate-pulse` skeletons become effectively
    static, all transitions/animations minimized (guidelines §48).
- Accessible names on icon-only buttons (guidelines §44) — all previously tooltip-only
  (`title`) controls now carry `aria-label` incl. the item name:
  - ConversationsPage: archive/unarchive, delete (per-conversation labels).
  - ResearchTasksPage: edit, delete (per-task labels).
- Form control label associations (`htmlFor`/`id` or `aria-label`):
  - ObservationsPage: search input (`aria-label`), project/status/sort selects (`htmlFor`).
  - ProjectsPage: create-project title/field/tags/description fields (`htmlFor`);
    status filter tabs got `aria-pressed`.
  - ObservationFormPage: title, description, project, status, observed-at, hypothesis,
    notes, lat/lng/label/precision — all label-associated.
  - SettingsPage: display name, photo URL, theme, timezone (`htmlFor`; checkboxes were done).
  - ResearchMapPage: project/tag/date filter selects (`aria-label`, icons `aria-hidden`).
  - ConversationsPage: chat search input (`aria-label`).
- Keyboard operability (guidelines §45): conversation list cards were click-only `<div>`s —
  now `role="button"`, `tabIndex={0}`, Enter/Space activate, `aria-pressed` for selected,
  visible focus ring.
- Icon-only lucide icons next to labeled controls marked `aria-hidden` (decorative).

**Validation:** tsc clean, eslint 0 errors; all 8 affected suites 24/24.

---

## Block 6 — Secondary refinements

**Status:** Complete.

**What changed**
- **Projects search + clear filters** (guidelines §51): search input filters by
  title/field/tags client-side; status tabs + search combined under one "Clear filters"
  action shown only when filters are active; empty state distinguishes "no projects yet"
  from "no matches". Also replaced the last `alert()` (project create error) with a toast
  and added a success toast.
- **Tasks filter clarity**: status tabs wrapped in a labelled `role="group"`, tabs carry
  `aria-pressed`, a "Clear filter" link appears next to the tabs when a status filter is set.
- **Observation form progressive disclosure** (guidelines §52): hypothesis, notes,
  measurements, location, and tags moved into a native `<details>` "Advanced Fields" section
  (collapsed for new observations, expanded in edit mode so existing data stays visible).
  Keyboard-accessible with no extra JS; tag remove buttons got `aria-label`s.
- **Settings grouping** (guidelines §30/§54): restructured into labelled sections —
  Account (read-only), Researcher Profile (`fieldset`/`legend`), Application Preferences
  (`fieldset`/`legend`) — plus an honest "Your research data" privacy note. No fake danger
  zone: account deletion does not exist in the backend, so none was added.
- **Build hygiene discovered during validation**: `npm run build` surfaced pre-existing
  type errors in test files that `tsc --noEmit` (project references) was not catching —
  fixed `ui.test.tsx` unused imports, `DashboardPage.test.tsx` mock typing helper, and an
  unused/`Conversation`-typed state in `DashboardPage.tsx`. Build now passes cleanly.

**Validation:** `npm run build` clean (chunk-size advisory only), lint 0 errors,
10 affected suites 27/27.

---

## Phase status

All 6 blocks complete. Remaining deferred items (explicit non-goals, see plan §1/§5):
breadcrumbs (flat hierarchy — little value today), full-suite vitest worker OOM on
MarkdownText (pre-existing environment issue, documented in Block 2), notifications
(no backend capability).

**Environment note for future blocks:** full-suite vitest runs on this machine are flaky
(worker fork OOM ~2 GB ceiling on MarkdownText suite; pre-existing). Run touched suites
individually for reliable signal; revisit vitest pool config if a block touches MarkdownText.
