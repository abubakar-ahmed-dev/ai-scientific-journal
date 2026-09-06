# UX Polish Phase — Plan

**Source:** `plans/UX-Polish-phase/Raw-UX Guidelines.md` + frontend audit (2026-09-05)
**Branch:** continues `feature/phase-9-production-hardening`
**Governing principle:** every change must make it easier for a researcher to understand where
they are, continue their work, and complete the next meaningful action. Judge-visible usability
and coherent workflows rank above literal guideline coverage. Honest UI over impressive UI.

---

## 1. Audit Summary (current state vs guidelines)

### Application shell & navigation (P1)
- Top navbar with 8 links; guidelines call for grouped sidebar (§4–§5). Labels present, icons absent.
- Active nav state is color+weight only — needs non-color indicator (§5.2).
- No sidebar, no collapse, no preference persistence.
- Header has no search/notifications area (§6) — keep honest, no dead icons.
- No breadcrumbs (§50). Back links exist only on observation/project detail pages.
- Mobile drawer exists with focus trap + Escape — keep (already conforms §44/§45).

### Dashboard (P3)
- Generic title, metrics grid first. Guidelines: greeting, Current Research hero first, metrics demoted (§9–§10).
- No "Current Research / Continue Research" component (§11) — the most important gap.
- No "continue where you left off" framing (§15).
- Quick actions: Ask/Map/Chat/Projects gradient cards. Required set: New Observation, Ask Journal, AI Chat, Add Task. Gradients violate restraint (§2.1).
- No contextual AI panel (§16), no clickable activity feed (§17).
- Task panel unsorted by relevance; no due dates in data model — use status priority (in_progress > planned > suggested) + recency instead.
- No new-user onboarding state (§20.1).
- Already conform: honest "+N" metrics, skeletons, partial-failure retry, empty states with action.
- **No research-progress field exists in the data model** — no % bar. Show observation count,
  open-task count, status, last activity instead (§11 forbids fake progress).

### Feedback & destructive actions (P4)
- `window.confirm()` × 4 (conversation, observation, project, task delete) — replace with one
  reusable accessible ConfirmDialog; project deletion must state consequences (§53).
- No toasts; success feedback inconsistent (§39).
- Saving states exist on observation form + settings; no "Saved" confirmation state (§38).

### Accessibility (continuous, not postponed)
- `prefers-reduced-motion` unsupported anywhere (§48).
- Interactive controls lack accessible names on several pages (ObservationsPage has zero `aria-`).
- Sweep focus-visible, semantic structure, dialog focus handling as each component is touched.

### Command palette (P5)
- Zero keyboard shortcuts today. MVP Ctrl/Cmd+K: page nav + quick actions + recent
  projects/observations from already-loaded APIs. No fake full-text search (§7).

### Journal Intelligence (P6)
- Only if backed by real data: recent analyses exist — surface latest analysis-derived
  suggestion with action link, labeled "AI suggestion" (§16, §22.2, §56). Skip if forced.

### Secondary (P7)
- Projects/Tasks search + clear-filters (§51); observation-form progressive disclosure (§52);
  Settings grouping + danger zone (§30); breadcrumbs where hierarchy warrants (§50);
  remaining loading/empty/error states (§37, §20).

### Defer (explicit)
- Notifications UI (no backend capability) — do not add dead bell icon.
- Decorative motion, marketing gradients, vanity metrics.

---

## 2. Implementation Blocks

### Block 1 — Application shell & sidebar navigation
- New `AppShell`/`Sidebar` in `Layout.tsx`: desktop persistent sidebar, grouped sections
  (WORKSPACE: Dashboard / RESEARCH: Observations, Research Map, Ask Journal / WORK: Tasks,
  Projects / AI: AI Chat / bottom: Settings), icon + label (lucide icons).
- Active state: background + accent + left indicator bar + semibold — not color-only.
- Keep header slim: logo, user chip, sign out. No fake search/notifications.
- Mobile: keep existing drawer + focus trap, reuse same nav model.
- Sidebar collapsed-state persistence deferred unless trivial (`localStorage` ok).
- All authenticated pages render inside the one shell (check each page wraps `Layout`).

### Block 2 — Dashboard restructure
- Time-based greeting + contextual subtitle ("Good evening — continue your research where you left off.").
- **Current Research hero**: most recently active project (updatedAt desc, status active).
  Shows title, description, status badge, honest stats (observation count, open task count,
  last activity time), primary `[Continue Research]` (link to project detail), secondary
  `View all projects`. No progress bar (no data). Empty → onboarding state instead.
- Onboarding state when zero projects AND zero observations: "workspace ready" + numbered
  getting-started (create project → add observation → explore AI) with action links.
- Quick actions row: New Observation / Ask Journal / AI Chat / Add Task — flat cards, no gradients.
- Metrics row demoted below quick actions (keep honest counts + "+" semantics).
- Task summary: prioritize in_progress → planned → suggested, recency tiebreak, max 5, "View all".
- Recent activity: merge recent observations/tasks/analyses into chronological feed,
  each item clickable to its object, relative timestamps.
- Journal Intelligence: if latest analysis exists, small panel "AI suggestion — from your latest
  analysis of X: first suggested next step" + [Review analysis] action, clearly labeled.

### Block 3 — Feedback primitives & destructive actions
- New shared components: `Dialog` (focus trap, Escape, labelled), `ConfirmDialog`
  (consequence text + Cancel/confirm), `Toast` provider (success/error, auto-dismiss,
  reduced-motion aware), `SavedState` inline indicator where useful.
- Replace 4 `window.confirm()` call sites; project delete dialog lists consequences
  (project record removed; observations/tasks unlinked or retained per actual backend behavior —
  verify `projectRepository.delete()` before writing copy).
- Wire toasts into create/update/delete success + failure paths across pages.
- Keep saving spinners; add "Saved ✓" transient state on settings + observation form.

### Block 4 — Command palette (MVP)
- `CommandPalette.tsx`: Ctrl/Cmd+K opens, Esc closes, arrow-key navigation, Enter selects,
  focus trapped, `role="dialog"` + `aria-modal`.
- Sources: static page nav + quick actions; dynamic recent projects + recent observations
  (fetch on open, limit 5 each — reuse existing list endpoints).
- Header button (real search affordance, opens palette) + visible shortcut hint.

### Block 5 — Accessibility pass (continuous + final sweep)
- `prefers-reduced-motion` global CSS guard for animate-pulse/transitions.
- Accessible names on icon-only buttons (edit/delete/etc.) across pages.
- Focus-visible styles on interactive elements; check tab order on new components.
- Dialog/drawer focus management verified (existing pattern in Layout reused).

### Block 6 — Secondary refinements (as time allows)
- Projects + Tasks pages: search input / status filter clarity + "Clear filters".
- Observation form: progressive disclosure (advanced fields collapsible).
- Settings: grouped sections, visually separated danger zone.
- Breadcrumbs on project→observation depth if hierarchy warrants.
- Remaining loading/empty/error states on list pages.

---

## 3. Component strategy
Primitives built opportunistically inside the blocks above, placed in
`frontend/src/components/ui/`: `Button`, `Dialog`, `ConfirmDialog`, `Toast`, `EmptyState`,
`Skeleton`, `Badge`, `PageHeader`. Only extract a primitive when ≥2 call sites exist.
No standalone design-system rewrite. Reuse existing patterns (Layout focus trap, badge styles).

## 4. Validation per block
- `npm --prefix frontend run typecheck` + `lint` + targeted vitest per touched suite.
- Update existing tests broken by shell/dashboard changes (Layout.test, DashboardPage.test,
  LandingPage.test nav assumptions, e2eJourney).
- Browser verification of each user-facing block before commit.
- Progress recorded in `plans/UX-Polish-phase/implementation-logs.md`.

## 5. Non-goals
- No backend changes required (all blocks use existing APIs).
- No notifications, no offline claims, no fabricated metrics, no new deps unless unavoidable
  (command palette built with existing tooling).
