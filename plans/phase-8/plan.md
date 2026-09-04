# Phase 8 — Frontend Application Completion: Implementation Plan

**Source plan:** `plans/IMPLEMENTATION_PLAN.md` §3 Phase 8  
**Governing docs:** `PRD.md` (FR-02, NFR-03, FR-11–FR-17); `TECHNICAL_ARCHITECTURE.md` (§9, §52–§55, §66, §74); `API.md` (§6.7, §7.2, §7.3, §8); `SECURITY.md` (§8, §14, §15); `TESTING.md` (§7, §8).  
**Branch:** `feature/phase-8-frontend-completion` (off `dev` — never work directly on `main`)

---

## 0. Phase Goal & Overview

Phase 8 completes the responsive web application for the Scientific AI Journal, bringing every workflow defined in the PRD and Technical Architecture to a unified, production-grade standard:

1. **Dashboard Aggregation (`/dashboard`)**:
   - Comprehensive research overview: recent observations, active projects, pending/suggested research tasks, recent AI analyses, and active conversations at a glance.
   - Quick scientific action shortcuts ("+ New Observation", "Ask My Journal", "Research Map", "+ New Project").
2. **Scientific Landing Page (`/`)**:
   - Modern value-proposition presentation explaining empirical observation capture, multi-modal evidence, AI analysis pipelines, grounded journal RAG, and interactive research mapping.
   - Seamless Google Sign-In onboarding with automatic session redirection.
3. **Responsive Layout & Navigation Hardening (`Layout.tsx`)**:
   - Mobile-responsive navigation drawer (hamburger toggle) with accessible ARIA semantics (PRD NFR-03).
   - Active route styling, user profile avatar / email pill, and accessible skip-links.
4. **Version History Snapshot Inspector (`ObservationDetailPage.tsx`)**:
   - Interactive version snapshot inspector modal/drawer consuming `GET /api/v1/observations/:observationId/versions[/:versionId]`.
   - Side-by-side or revision preview comparing historical snapshot titles, descriptions, notes, measurements, and timestamps.
5. **Dangling Source Resilience (`AnalysisViewer.tsx` & `ProjectDetailPage.tsx`)**:
   - Fulfills `API.md` §7.2 and `TECHNICAL_ARCHITECTURE.md` §66: graceful handling and visual rendering of deleted source observations (`[Observation deleted]`) and deleted projects (`[Unfiled / Project deleted]`) without broken links or application crashes.
6. **Universal UX & Accessibility Contracts (TA §54, §55)**:
   - Consistent state lifecycle: **Loading** (skeletons), **Empty** (clear calls-to-action), **Success**, **Error** (clear explanations), and **Retry** (preserving user inputs without data loss) across all views.
   - Unambiguous visual distinction between user-authored empirical data and AI-generated outputs (PRD FR-14) with model and prompt provenance badges.
   - Strict keyboard accessibility, focus visible rings, semantic landmarks, and WCAG AA contrast.
7. **End-to-End Stubbed-AI Journey Suite (`TESTING.md` §8)**:
   - Comprehensive E2E test verifying the complete user workflow: Sign-in → Dashboard → Create Observation with measurements/location → Run Structured Analysis → Accept Suggestion into Research Task → Stateful Chat Discussion → Ask My Journal Q&A → Research Map Inspection.

---

## 1. Existing State & Gap Analysis (Verified against working tree)

| Area | Current Implementation | Phase 8 Completion Gaps |
| :--- | :--- | :--- |
| **Navigation & Layout** | `Layout.tsx` has desktop navigation links; links are hidden on mobile (`hidden md:flex`) without a mobile menu. | Implement mobile hamburger drawer, accessible ARIA attributes (`aria-expanded`, `aria-label`), keyboard navigation, and active link highlights. |
| **Landing Page** | `LandingPage.tsx` is a minimal 42-line placeholder with only a title and basic sign-in button. | Build an engaging scientific landing page featuring value proposition, feature grid, workflow walkthrough, and sign-in callouts. |
| **Dashboard** | `DashboardPage.tsx` only loads the latest 5 observations and active projects. | Expand to aggregate research tasks, recent AI analyses, conversation counts, summary metrics, and quick scientific action shortcuts. |
| **Version History** | `ObservationDetailPage.tsx` has a basic list rendering `Revision v{ver.version}`. | Build an interactive Version History snapshot modal/drawer displaying full historical measurements, tags, location, and comparison with current state. |
| **Dangling Sources** | `AnalysisViewer.tsx` renders raw observation IDs and assumes all referenced observations exist. | Implement `API.md` §7.2 dangling source resolver: if an observation or project is deleted, render graceful `[Source observation deleted]` or `[Unfiled project]` pill. |
| **Projects UI** | `ProjectsPage.tsx` and `ProjectDetailPage.tsx` have basic CRUD. | Add status filter tabs (active, completed, archived), associated observations count, and research tasks grouped by project. |
| **Conversations UI** | `ConversationsPage.tsx` has chat interface. | Add safety / prompt injection disclaimer, markdown formatting for assistant responses, and clear distinction between user and assistant message turns. |
| **Testing** | 7 test files (18 tests) passing across individual pages. | Add `DashboardPage.test.tsx`, `ProjectDetailPage.test.tsx`, `Layout.test.tsx`, and full Stubbed-AI E2E Journey test (`e2eJourney.test.tsx`). |

---

## 2. Architecture & Design Rules

1. **AI vs. User Content Distinction Everywhere (PRD FR-14, TA §54)**:
   - AI-generated content (chat assistant messages, structured analyses, Ask My Journal answers) must always display:
     - Clear visual accent (e.g. purple/indigo gradient, Sparkles icon, distinct background).
     - Provenance badges: model identifier (e.g. `gemini-2.5-flash` or `fake-model`) and prompt version (e.g. `ask-grounded-v1`).
     - Honest uncertainties callout.
   - User content (observations, hypothesis, measurements) remains visually distinct as grounded empirical truth.
2. **Universal State Contract (TA §54)**:
   - Every view must explicitly handle all 5 core UI states:
     - `Loading`: animated skeleton loaders rather than generic full-screen spinners.
     - `Empty`: contextual illustration/icon, clear explanation, and primary action button.
     - `Success`: smooth rendering without UI jumpiness.
     - `Error`: readable error message with `requestId` if available from API.
     - `Retry`: button to retry failed query without wiping already entered form data.
3. **Dangling Source Graceful Rendering (API §7.2, TA §66)**:
   - Append-only AI analyses retain historical references even after observations or projects are deleted (ADR-015, ADR-021).
   - The UI must NEVER crash, display blank entries, or fail silently when an ID cannot be resolved against active collections. Render a muted pill: `[Deleted observation]` or `[Unfiled project]`.
4. **Location Privacy Enforcement (SECURITY §14)**:
   - If `observation.location.precision === "hidden"`, coordinates must **never** be rendered on any screen, map, or card.
   - If `approximate`, coordinates must be rendered with an uncertainty indicator (e.g. "Approximate area (~10km)").
5. **Mobile Responsiveness & Accessibility (PRD NFR-03, TA §55)**:
   - Mobile-first responsiveness tested from 375px (mobile) to 1440px (desktop).
   - Interactive touch targets ≥ 44×44px.
   - Keyboard accessible: Tab navigation, visible focus rings (`focus:ring-2 focus:ring-indigo-500`), and ESC key dismisses modals/drawers.

---

## 3. Implementation Tasks Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 8 IMPLEMENTATION FLOW                            │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Task 1: Navigation & Layout   │ Mobile drawer, accessible header, a11y      │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Task 2: Dashboard & Landing   │ Full metrics aggregation, modern landing UI │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Task 3: Versions & Dangling   │ Snapshot comparison modal, missing sources  │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Task 4: Polish & States       │ Projects lifecycle, chat polish, skeletons  │
├───────────────────────────────┼─────────────────────────────────────────────┤
│ Task 5: E2E Journey & Tests   │ Full multi-step E2E journey, component tests│
└───────────────────────────────┴─────────────────────────────────────────────┘
```

---

### Task 1: Navigation & Layout Hardening (Responsive & A11y)

#### 1.1 Mobile Navigation Drawer
- **File:** `frontend/src/components/Layout.tsx`
- Add mobile menu state: `const [mobileMenuOpen, setMobileMenuOpen] = useState(false);`
- Add hamburger button visible on `< md` viewports:
  - `aria-label="Toggle navigation menu"`
  - `aria-expanded={mobileMenuOpen}`
- Implement slide-over mobile drawer:
  - Accessible backdrop with click-to-dismiss.
  - Links to all primary routes: Dashboard, Observations, Research Map, Ask Journal, Tasks, AI Chat, Projects, Settings.
  - Auto-close drawer on route transition (`useLocation()` listener).
- Add keyboard accessibility:
  - Trap focus inside drawer when open; close on `Escape` key.

#### 1.2 User Profile Pill & Header Polishing
- Header displays user avatar (or initial fallback circle) + display name / email.
- Active navigation link indicator with bold typography and indigo pill background.
- Semantic HTML tags: `<header role="banner">`, `<nav aria-label="Main Navigation">`, `<main role="main">`.

#### 1.3 Layout Unit Tests
- **File:** `frontend/src/components/Layout.test.tsx`
  - Tests desktop navigation link rendering.
  - Tests mobile hamburger toggle opening and closing the drawer.
  - Tests sign-out button interaction.

---

### Task 2: Dashboard Aggregation & Scientific Landing Page

#### 2.1 Scientific Landing Page
- **File:** `frontend/src/pages/LandingPage.tsx`
- Features:
  - **Hero Section**: Value proposition — "The Intelligent Lab & Field Notebook for Modern Science".
  - **Core Pillars Grid**:
    1. *Empirical Grounding*: Immutable observation recording with multi-modal media and location tracking.
    2. *Scientific AI Pipelines*: Automated pattern synthesis, hypothesis generation, and experimental next steps.
    3. *Ask My Journal (RAG)*: Grounded question answering citing exact field observations.
    4. *Research Map*: Geospatial exploration of field observations with privacy-preserving location precision.
  - **Researcher Workflow Preview**: Step-by-step visual progression (Record → Analyze → Plan → Explore).
  - **Call to Action**: Prominent "Sign in with Google" button with clear privacy and security reassurance.
  - Automatic redirect: if already authenticated (`currentUser`), automatically redirects to `/dashboard`.

#### 2.2 Dashboard Aggregation Page
- **File:** `frontend/src/pages/DashboardPage.tsx`
- Parallel data loading with `Promise.allSettled`:
  - `fetchObservations({ limit: 5 })`
  - `fetchProjects({ limit: 20 })`
  - `fetchResearchTasks({ limit: 5, status: "planned" })`
  - `fetchConversations({ limit: 5 })`
  - `fetchAnalyses({ limit: 5 })`
- **Dashboard Sections**:
  1. **Metric Cards Grid**:
     - Total Observations count.
     - Active Projects count.
     - Pending Research Tasks count.
     - AI Analyses Generated count.
  2. **Quick Scientific Actions**:
     - "+ New Observation" (`/observations/new`)
     - "Ask My Journal" (`/ask`)
     - "Research Map" (`/map`)
     - "+ New Project" (`/projects`)
  3. **Recent Activity Split Layout**:
     - Left Column: Recent Journal Observations with tags, date, and status badges.
     - Right Column:
       - Active Research Tasks with priority and status transitions.
       - Recent AI Analyses with type badges (`summary`, `analysis`, `research_suggestions`).
       - Recent Conversations with message count.
  4. **Loading State**: Clean Tailwind skeleton placeholders mirroring the grid layout.
  5. **Empty State**: Friendly onboarding cards for new researchers with one-click actions.

#### 2.3 Component Tests
- **File:** `frontend/src/pages/LandingPage.test.tsx` (expand existing test to cover features and redirect).
- **File:** `frontend/src/pages/DashboardPage.test.tsx` (verify metric cards, quick actions, and recent lists).

---

### Task 3: Version History Inspection & Dangling Source Handling

#### 3.1 Version History Snapshot Inspector
- **File:** `frontend/src/components/VersionSnapshotModal.tsx` (New Component)
- Invoked from `ObservationDetailPage.tsx` when clicking a revision in the Version History list.
- Features:
  - Fetches specific version details if needed or inspects selected `ObservationVersion` object.
  - Displays revision metadata: Revision number (`v1`, `v2`, etc.), edit timestamp, and editor.
  - Displays snapshot content:
    - Title and Description at that point in time.
    - Historical Measurements table.
    - Historical Location and Precision setting.
    - Historical Tags.
  - Side-by-side or tabbed diff: highlights what changed between the historical version and current canonical observation.
  - Accessible modal dialog: backdrop, close button (`Esc` to close), focus trap.

#### 3.2 Observation Detail Page Integration
- **File:** `frontend/src/pages/ObservationDetailPage.tsx`
- Replace inline basic version list with clean revision timeline cards.
- Clicking "Inspect Snapshot" opens `<VersionSnapshotModal />`.

#### 3.3 Dangling Source Handling
- **File:** `frontend/src/components/AnalysisViewer.tsx`
- Support `includeSources=summary` resolution:
  - When rendering `observationIds[]` or `supportingObservationIds[]`:
    - If observation exists: render clickable pill linking to `/observations/:id`.
    - If observation was deleted: render neutral badge: `<span className="text-slate-400 bg-slate-100 italic">Observation deleted</span>`.
  - When rendering `projectId`:
    - If project exists: render link to `/projects/:id`.
    - If project was deleted: render neutral badge: `<span className="text-slate-400 bg-slate-100 italic">Unfiled project</span>`.
- Ensure zero console errors or broken links when viewing historical analyses with missing sources.

---

### Task 4: Cross-Cutting UX Polish (Projects, Conversations & States)

#### 4.1 Projects Management Polish
- **Files:** `frontend/src/pages/ProjectsPage.tsx` & `frontend/src/pages/ProjectDetailPage.tsx`
- Filter tabs: `All` | `Active` | `Completed` | `Archived`.
- Project detail displays:
  - Project metadata and status toggle.
  - Associated Observations tab with count badge and "+ Add Observation to Project" button.
  - Associated Research Tasks tab showing tasks linked to this project.
  - Delete project modal with clear warning: *"Observations will be retained and set to unfiled."*

#### 4.2 Research Assistant / Conversations Surface Polish
- **File:** `frontend/src/pages/ConversationsPage.tsx` & `frontend/src/components/ChatWindow.tsx`
- Polish:
  - Clear distinction between User and Assistant message bubbles.
  - Assistant bubbles feature Gemini Sparkles icon, model pill (`gemini-2.5-flash`), and markdown rendering for code/equations.
  - Context indicator banner at top of chat: "Discussing Observation: [Title]" or "Project: [Title]".
  - AI Safety Disclaimer: *"AI suggestions should be experimentally verified. Empirical observation records remain your authoritative ground truth."*
  - Retry mechanism for failed messages: preserves message input in the text box so user never loses their question.

#### 4.3 Universal Error Boundary & Global Notification
- **File:** `frontend/src/components/ErrorBoundary.tsx`
  - Catches runtime rendering errors gracefully.
  - Displays user-friendly error card with "Reload Page" or "Go to Dashboard" button.
- Clean empty and error states across all pages using reusable UI components (`EmptyState.tsx`).

---

### Task 5: Frontend Component Tests & Stubbed-AI E2E Journey Suite

#### 5.1 Component Test Suite Expansion (`TESTING.md` §7)
- **`frontend/src/pages/DashboardPage.test.tsx`**:
  - Tests metrics calculation from mocked API responses.
  - Tests loading skeletons and empty states.
- **`frontend/src/pages/ProjectDetailPage.test.tsx`**:
  - Tests project detail rendering, observation list grouping, and update actions.
- **`frontend/src/components/VersionSnapshotModal.test.tsx`**:
  - Tests rendering of historical snapshot fields (title, measurements, location).
- **`frontend/src/components/AnalysisViewer.test.tsx`**:
  - Tests rendering of dangling sources without crashing.

#### 5.2 Stubbed-AI E2E Journey Test (`TESTING.md` §8)
- **File:** `frontend/src/test/e2eJourney.test.tsx`
- Complete automated simulation of the researcher journey against mocked API client:
  1. **Sign In**: Researcher signs in via Google auth on Landing Page → transitions to Dashboard.
  2. **Dashboard Overview**: Verifies metrics and clicks "+ New Observation".
  3. **Observation Recording**: Fills form with scientific title, description, measurements (`Temp: 22.4 °C`), attaches location (`exact`), saves observation.
  4. **Observation Inspection**: Views observation detail page, inspects media gallery and mini map.
  5. **AI Structured Analysis**: Triggers "Analyze with AI" → receives structured analysis with hypotheses, confidence badges, and suggested next steps.
  6. **Task Acceptance**: Clicks "+ Accept as Research Task" on suggestion #1 → creates task in `suggested` state.
  7. **Stateful Conversation**: Starts discussion from observation → sends question → receives assistant response with model provenance.
  8. **Ask My Journal (RAG)**: Navigates to `/ask` → asks question across journal → verifies grounded answer and evidence citation pills.
  9. **Research Map**: Navigates to `/map` → verifies observation pin appears geographically with inspection popup.
  10. **Version History**: Updates observation → opens version history drawer → verifies revision `v1` is captured.

---

## 4. Verification Plan

### 4.1 Automated Quality Gates

| Gate | Tool / Command | Pass Criteria |
| :--- | :--- | :--- |
| **Frontend Tests** | `npm --prefix frontend run test` | All component and E2E journey tests pass. |
| **Frontend Typecheck** | `npm --prefix frontend run typecheck` | 0 errors (`tsc -b`). |
| **Frontend Lint** | `npm --prefix frontend run lint` | 0 errors (`oxlint`). |
| **Frontend Build** | `npm --prefix frontend run build` | Clean production build with Vite bundle analysis. |
| **Backend Regression** | `npm --prefix backend run test` | All 111 backend tests remain passing. |

### 4.2 Accessibility & Usability Inspection Checklist (NFR-03, TA §55)
- [ ] Keyboard navigation: Every interactive button, link, input, and modal reachable and operable via Tab, Enter, and Escape.
- [ ] Visual focus: Distinct focus ring (`focus:ring-2 focus:ring-indigo-500`) visible on all focused controls.
- [ ] Mobile navigation: Hamburger menu opens drawer smoothly on screens < 768px; drawer closes on link click or backdrop click.
- [ ] Color contrast: Text adheres to WCAG AA standard (≥ 4.5:1 for normal text, ≥ 3:1 for large text).
- [ ] Screen reader landmarks: `<header>`, `<nav>`, `<main>`, `<section>` properly declared.
- [ ] Resilient AI error states: When AI service returns 503/502, user text is preserved and retry button is available.
- [ ] Dangling reference resilience: Analyses referencing deleted observations display graceful fallback pills without throwing.

---

## 5. Risk Matrix & Mitigations

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Scope Creep in Frontend Polish** | Medium | Strictly adhere to the PRD Phase 2 scope and NFR-03 usability bar. Do NOT implement out-of-scope optional features (e.g. speech-to-text, offline sync, auto-tagging). |
| **Mobile Layout Breakage on Data-Heavy Tables** | Medium | Wrap measurements tables and version diffs in horizontally scrollable containers (`overflow-x-auto`) with responsive padding. |
| **Bundle Size Overhead from Leaflet & Charting** | Low | Route-level code splitting via `React.lazy()` and `Suspense` for heavy components (`ResearchMapPage`), already configured in `App.tsx`. |
| **Dangling Source Null Pointer Exceptions** | Medium | Enforce optional chaining (`obs?.title`) and fallback rendering helper across all components displaying referenced entities. |
