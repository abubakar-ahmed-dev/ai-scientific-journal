# UI Polish — Implementation Log

Record per-block progress under `plans/UI-polish/`.

---

## Homepage redesign (public landing page)

**Status:** Complete.
**Date:** 2026-09-06
**Scope:** `plans/UI-polish/homepage-guidelines.md` (public homepage only). Authenticated
app untouched.

**Files changed**
- `frontend/src/index.css` — added `lp-` design-token block (`@theme`): bg `#F6F8F5`,
  surface white, ink `#17211D`, muted `#59645F`, border `#DCE3DF`, heading teal `#164E43`,
  primary `#0F766E`/hover `#115E59`, soft teal `#E0F0E9`, AI violet `#6D5BD0` (+ darkened
  text variant `#55418f` + surface `#F0ECFA`), evidence link `#1D4ED8`, uncertainty amber
  pair. Landing-scoped `.lp :focus-visible` override (teal ring).
- `frontend/src/components/landing/FeatureSection.tsx` (new) — reusable showcase section:
  label + heading + paragraph + ≤2 points + preview; desktop alternation, text-first mobile.
- `frontend/src/components/landing/previews.tsx` (new) — static sample previews:
  `ObservationPreview` (semantic measurement table), `AnalysisPreview` (violet label,
  uncertainty statement, supporting titles, provenance footer), `StructuredEditorPreview`
  (read-only editor illustration), `MapPreview` (schematic "Illustrative map",
  "Approximate location" area, no exact coords, hidden-locations note), `AnswerPreview`
  (answer / Example sources / what remains uncertain). All labeled "sample data"; no fake
  focusable controls; no live AI/map/network calls.
- `frontend/src/pages/LandingPage.tsx` — rewritten: sticky 64px header (anchors
  `#how-it-works`/`#features`/`#privacy` + auth CTA), asymmetric 42/58 hero with
  ObservationPreview + overlapping AnalysisPreview, compact trust strip (4 items),
  workflow ordered list (4 steps + suggest-vs-accept note), three FeatureSections
  (6A/6B/6C), integrity + privacy two-column with closed-by-default `<details>` accordion,
  final CTA band, footer (name + tech attribution). One h1, skip link, `scroll-mt` on all
  anchor targets, mobile menu with focus trap + Escape + restore focus to trigger, existing
  `signInWithGoogle` reused (signed-in users see "Open Dashboard" everywhere).
- `frontend/src/pages/LandingPage.test.tsx` — rewritten for the new page (7 cases: hero +
  CTA, sample-data labeling, anchors, workflow distinction, feature headings, signed-in vs
  signed-out CTAs, single-h1 + skip link).

**Decisions**
- Tokens namespaced `lp-` and page root carries `.lp` class — authenticated app keeps its
  slate/indigo system; no shared-theme migration (guidelines §1 scope rule).
- No serif font bundled (guidelines offer it as optional); sans-serif used throughout.
  Recorded as a limitation, not skipped silently.
- No owned/licensed photo asset in `public/` → hero ObservationPreview omits the optional
  evidence image (guidelines §3 conditional).
- Map preview is a restrained SVG/CSS schematic labeled "Illustrative map" — no map SDK,
  no API keys, no geographic accuracy claims (guidelines §6B fallback path).
- Accordion implemented as native `<details>`/`<summary>` — behavior needed is trivial;
  no Sheet/Accordion library exists in this repo (hand-rolled primitives only), and the
  guidelines forbid adding deps for simple needs.
- 12px-preview-text rule respected: smallest preview metadata is 12–13px (`text-xs`,
  `text-[13px]` mono values); no 9–11px text remains on the landing page.

**Validation**
- `npm --prefix frontend run typecheck` — 0 errors.
- `npm --prefix frontend run lint` — exit 0 (pre-existing warnings unchanged; landing
  files introduce none).
- `npx vitest run src/pages/LandingPage.test.tsx src/components/Layout.test.tsx
  src/app/App.test.tsx` — 15/15.
- `npm --prefix frontend run build` — clean.
- Browser (Playwright): desktop 1366px (hero overlap + alternating sections verified),
  tablet 1280px, mobile 390px (stacked, no overlap, no horizontal overflow —
  `scrollWidth === clientWidth` at both sizes); anchor navigation lands sections below the
  sticky header; mobile menu opens/closes (link click + Escape path compiled, focus trap
  same pattern as app drawer); zero console errors.

**Limitations / remaining**
- Serif headline font not bundled — plain sans-serif headings (optional per guidelines).
- Signed-in browser CTA behavior verified by tests + code path; not exercised against a
  live Firebase session (emulator not running).
- Full frontend suite not run (pre-existing MarkdownText worker-OOM on this machine;
  touched suites run individually instead).
