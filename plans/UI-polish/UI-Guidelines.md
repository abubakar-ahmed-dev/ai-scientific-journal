# UI Guidelines — AI Scientific Journal

App-wide design standard. Page-specific implementation prompts define individual layouts and features; this document defines the shared rules. Priorities: Authenticity, Usability, Stability, and Security.

## 1. Authority and scope

- PRD, API, DATABASE_SCHEMA, SECURITY, TECHNICAL_ARCHITECTURE, and applicable ADRs govern functionality, data contracts, and security. UI proposals cannot override them.
- These guidelines govern shared visual tokens, interaction patterns, accessibility, and truthful presentation.
- Page-specific instructions govern section order, composition, component selection, content, and justified local exceptions. Explicitly name any exception; keep it scoped to that page or component. Never override security, data integrity, accessibility, or truthful behavior.
- The latest homepage implementation prompt is aligned: its asymmetric hero, serif marketing headings, static sample previews, larger section spacing, and public header are page-specific choices—not requirements for every screen. Its written instructions take precedence over the generated image. Images are inspiration, not contracts or evidence of implemented features.
- Improve one requested area at a time. Do not change routes, backend behavior, authentication, shared themes, or unrelated screens without corresponding scope. Flag contract gaps instead of inventing functionality.

## 2. Product principles

- Create a calm, precise, evidence-oriented research notebook—not a generic AI dashboard.
- Support Observe → Record → Analyze → Organize → Discover → Investigate. Observations are fundamental; projects and scientific details are optional.
- Make the main task obvious. Use progressive disclosure for advanced fields and technical details; avoid duplicate actions and decorative metrics.
- Keep user records, AI interpretations, evidence, and suggested actions distinguishable. Grounded journal answers and general AI brainstorming must not imply the same evidence guarantees.
- Prefer meaningful content and working interactions over extra cards, animations, or integrations.

## 3. Visual system

Use semantic tokens rather than scattered hardcoded colors. Preserve shared conventions and migrate tokens deliberately.


| Role                      | Color                 | Application                                |
| ------------------------- | --------------------- | ------------------------------------------ |
| App background            | `#EEF5F2`             | More noticeable mint tint                  |
| Content surface           | `#FFFFFF`             | Forms, observations, tables                |
| Soft teal surface         | `#E0F0E9`             | Section headers, selected panels, toolbars |
| Sidebar background        | `#123D36`             | Deep teal navigation                       |
| Sidebar text              | `#E5F2ED`             | Labels and icons                           |
| Sidebar active background | `#24594E`             | Selected navigation item                   |
| Main headings             | `#164E43`             | Page titles and section headings           |
| Body text                 | `#17211D`             | Keep existing                              |
| Secondary text            | `#59645F`             | Keep existing                              |
| Borders                   | `#CBDDD4`             | Slightly stronger definition               |
| Primary / hover           | `#0F766E` / `#115E59` | Keep existing buttons                      |
| AI surface / accent       | `#F0ECFA` / `#6D5BD0` | AI panels and attribution                  |


- These are base tokens, not universally accessible foreground/background pairs. Check actual contrast; use darker warning text and suitable tinted surfaces where necessary. Never rely on color alone.
- Use one existing or locally bundled sans-serif font (e.g. Inter or Geist). An optional single serif family may serve long-form reading or page-approved editorial headings. Monospace is for technical identifiers and code only.
- Defaults: body 16px; controls, labels, badges, and meaningful metadata at least 14px; rare secondary technical metadata 12px. Avoid 9–11px text. Page titles 28–32px, section headings 20–24px, card titles 16–18px. Marketing headings may be larger responsively.
- Use regular body weight, medium labels, and semibold headings. Comfortable line height (about 1.5–1.65 for prose); avoid excessive bold, uppercase, and long line lengths.
- Use a consistent spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Typical surfaces have 16–24px padding. Reading layouts have bounded width; tables, maps, and workspaces may use available width. Page-specific instructions set density and section spacing.
- Default radii: 8px controls, 12px larger panels; pills for statuses/tags. Prefer borders and tonal separation over shadows. Elevation belongs mainly to overlays and selectively approved previews.
- Avoid repetitive card grids, neon, glassmorphism, blobs, excessive gradients, and decorative metrics. Optional faint patterns stay away from reading text. Dark mode is separate scoped work, not an automatic addition.

## 4. Components and navigation

- Reuse React/TypeScript, Tailwind, existing shadcn/ui equivalents, Lucide icons, routing, and authentication. Add dependencies only for a concrete unmet requirement; do not replace established libraries for visual polish.
- Use semantic HTML for basic layout, lists, links, and tables. Use accessible existing primitives for buttons, dialogs, sheets, tabs, accordions, menus, badges, and alerts where their behavior is needed. Do not use Card for every container.
- Preserve the authenticated shell, responsive drawer, command palette, keyboard support, and existing route behavior. Group navigation logically; active states need text/icon/weight or shape cues plus color. Public pages can use their own header.
- Provide contextual titles, breadcrumbs/back navigation where useful, and clear action hierarchy. Keep destructive actions separate. Only show search, counts, notifications, or sync indicators when behavior is implemented and accurately scoped.
- Navigation uses links; actions use buttons. Icon-only controls need accessible names. Tooltips supplement—not replace—essential labels. No dead links or working-looking fake controls.

## 5. Forms, records, and collections

- Label fields visibly, distinguish optional input, explain constraints and units, and put validation near the relevant field. Preserve input after errors and focus the first invalid field where appropriate.
- Show unsaved, saving, saved, and failed states accurately. Warn before losing unsaved work. Resolve version conflicts without silently overwriting. Do not promise autosave or offline persistence unless implemented.
- Save source records independently of AI processing. Prevent duplicate submissions and use the existing safe retry/idempotency behavior.
- Keep observed time distinct from created/updated time; show understandable dates, timezone context where relevant, measurement units, and available provenance.
- Use canonical names, enums, and allowed transitions. Observation statuses: draft, observed, analyzed, archived—not “final.” Task statuses: suggested, planned, in_progress, completed, dismissed. Do not allow users to set server-managed states directly.
- Expose only supported search, sort, and filters; label partial/local results honestly. Reset pagination when query scope changes. Respect opaque cursors and incremental loading; do not fabricate page numbers, totals, progress percentages, or due-date claims.
- Distinguish no records from no filter matches; offer the appropriate create or clear-filter action. Keep archive and delete separate, explain deletion consequences, and offer undo only when supported.

## 6. AI and scientific integrity

- Label AI-generated text and hypotheses explicitly; violet is an accent, not a substitute for attribution. Never silently merge AI-generated measurements or interpretations into original records.
- Show available summary/findings, evidence, hypotheses, uncertainty, questions, and next steps according to the actual response type. Do not invent missing fields or force every output into the same layout.
- Make source titles and relevant dates readable and navigable. Display actual supporting-record counts only. Distinguish evidence from speculation; insufficient evidence is a valid outcome.
- Present confidence only when provided, as model-assessed rather than verified scientific certainty. Do not invent confidence percentages or equate retrieval scores with confidence.
- Make model, prompt version, generation time, and source context available where returned; secondary provenance may be expandable. Handle deleted sources gracefully. Do not claim version-level reproducibility without recorded source-version support.
- Analyses are append-only: regeneration creates a newer result, not an editable replacement. “Analyzed” does not mean scientifically validated or necessarily up to date.
- Suggestions are not tasks until explicitly accepted. Show origin and source links for Gemini-derived tasks. General chat is not automatically grounded evidence; persistence labels must reflect the actual endpoint behavior.

## 7. Privacy, media, and external services

- Preserve authentication and server-enforced ownership boundaries; UI hiding is not authorization. Never expose secrets, private cross-user data, raw traces, or sensitive details in previews/errors.
- Request location only after user action and explain precision. Exact may show a precise pin; approximate must not reveal precise coordinates; hidden must not expose a location through maps, labels, tooltips, previews, or metadata. Provide a usable list alternative to maps.
- For supported uploads, show file restrictions, previews, real progress or indeterminate state, per-file failures, retry, and removal. Preserve private authorized-media access; handle expired access gracefully.
- Notifications are optional, not a required bell or settings section. If implemented, require consent, event preferences, verified destinations, delivery/error handling, disconnection, and minimal private content. Do not add integrations solely for appearance.
- Public previews use clearly labeled sample data and owned/licensed assets, never private live records. Avoid live AI/map requests just for decoration. Static previews must not create fake interactive controls.
- Marketing/security claims must match verified behavior. No invented certifications, testimonials, uptime, training-policy guarantees, encryption guarantees, or scientific results.

## 8. Reliability and feedback

- Design applicable loading, empty, success, error/retry, unauthorized/session-expired, and network/offline states. Preserve working sections when another request fails.
- Cover relevant version conflicts, rate limits, AI/validation failures, partial uploads, denied location permission, map failures, stale search results, and deleted sources. Show only states the application can actually detect.
- Confirm saves only after success. “Saved; analysis failed” must remain distinct from “Save failed.” Failure of Gemini, Maps, or media must not erase saved source data.
- Use stable-size skeletons or clear progress text; no fabricated percentages. Keep recoverable input and actionable error messages. Retry must not duplicate writes.
- Use inline feedback for persistent/actionable errors and toasts for brief confirmation. Critical errors must not disappear only because a toast timer expires. Use safe support/request IDs instead of traces.

## 9. Responsive accessibility and motion

- Use semantic landmarks, one clear h1, logical heading order, labels, alt text, visible focus, keyboard navigation, and appropriate live announcements. Do not communicate state through color alone.
- Verify text contrast (at least 4.5:1 for normal text, 3:1 for large text) and essential control/focus contrast. Aim for 44px touch targets; never shrink critical controls for density.
- Dialogs/sheets need accessible titles, focus containment and restoration, and appropriate dismiss behavior. Sticky elements must not obscure focused controls or anchors.
- Reflow columns into logical reading order. Do not shrink a desktop screenshot to fit mobile. Contain unavoidable table overflow locally; avoid page-wide horizontal scrolling. Verify zoom and narrow layouts.
- Use subtle 120–200ms state transitions and respect reduced motion. No autoplay, scroll hijacking, or animation dependencies without a real interaction need.

## 10. Implementation and acceptance

- Preserve existing accessibility, partial-loading recovery, dialogs/toasts, and error handling. Use small reusable components without excessive abstraction.
- Prioritize correctness/security → main-task usability → evidence/provenance → visual polish. New optional features require separate scope, not a redesign shortcut.
- Keep initial rendering lightweight; size/optimize assets, lazy-load secondary media, and avoid unnecessary requests. Do not add placeholders for unsupported features.
- Before delivery, verify responsive layouts, keyboard/focus, zoom/contrast, auth states, links/actions, supported filters/pagination, and applicable failure recovery. Run available lint, typecheck, build, and relevant tests; report anything unverified.
- Summarize changes, scoped exceptions, and limitations. Page-specific prompts add their own acceptance checks without weakening this baseline.
