Redesign the public homepage of my AI Scientific Journal app using the attached design image as visual inspiration.

Create a polished, responsive homepage that feels like a modern scientific notebook: calm, readable, evidence-oriented, and practical. Avoid excessive decoration, unnecessary dependencies, and repeated generic feature-card grids.

## Suggested libraries and components

Use the existing project stack:

* React + TypeScript + Vite.
* Tailwind CSS for layout, styling, and responsive behavior.
* Existing shadcn/ui components where available: Button, Badge, Sheet, Accordion, and optionally Card.
* Lucide React for consistent interface icons.
* Existing router and Firebase authentication integration.

Prefer semantic HTML for sections, navigation, lists, tables, and links. Do not introduce a component library just to implement something simple.

Do not add an animation library, chart library, live map dependency, carousel, or new form library for this homepage. CSS transitions are sufficient.

Inspect the repository before changing anything. Preserve authentication, routes, accessibility behavior, and established component conventions. Do not migrate or reinstall shadcn/ui if suitable components already exist.

## 1. Overall visual direction

Theme: “Modern Field Research Notebook.”

Colors:

* Page background: warm off-white, #F6F8F5.
* Surfaces: white.
* Main text: deep ink, #17211D.
* Secondary text: #59645F.
* Primary actions: deep teal, #0F766E.
* Primary hover: #115E59.
* Borders: #DCE3DF.
* AI content: restrained violet, #6D5BD0.
* Evidence links: dark blue.
* Uncertainty: pale amber background with dark readable text.

Use semantic theme tokens. Scope homepage-specific changes so the authenticated app is not unintentionally restyled.

Typography:

* Use the existing sans-serif font for navigation, descriptions, and preview UI.
* Optionally use one locally bundled serif font for the main headline and section headings.
* Keep body text approximately 16–18px.
* Keep meaningful preview text at least 14px.
* Avoid tiny labels and excessive uppercase text.

Layout:

* Center content within approximately 1200px.
* Use 24–32px desktop horizontal padding and 16–20px mobile padding.
* Use approximately 64–88px spacing between desktop sections and 40–56px on mobile.
* Use thin borders, restrained 8–12px radii, and minimal shadows.
* Reserve shadows mainly for the hero preview.

Avoid neon gradients, glassmorphism, floating blobs, scrolling marquees, fake metrics, and decorative animation.

A faint grid may appear behind one product section. Do not place patterns behind reading text.

## 2. Header

Components: semantic header and nav, Button, mobile Sheet.

Desktop layout:

* Left: a small notebook-style icon and “AI Scientific Journal.”
* Right: “How it works,” “Features,” “Privacy,” and “Sign in with Google.”
* Navigation links scroll to the corresponding sections.
* Keep the header around 64–72px tall with a subtle bottom border.

Use the existing logo if suitable. Otherwise, use a simple notebook icon rather than inventing an elaborate brand system.

Authentication:

* Reuse the existing Google sign-in action.
* For signed-in users, show “Open Dashboard.”
* Preserve loading and error handling.
* Do not create a second authentication implementation.

Mobile:

* Keep the brand readable.
* Collapse section links into a Sheet with a labeled menu trigger.
* Close the Sheet after navigation.
* Ensure keyboard focus is handled correctly.

A sticky header is optional; if used, ensure anchor destinations and focused elements are not obscured.

## 3. Hero: explain the value and show the product

Components: CSS Grid, Button, Badge, custom ObservationPreview and AnalysisPreview.

Use two columns on desktop:

* Left: approximately 42% for the message.
* Right: approximately 58% for a product preview.

Do not force the hero to fill the entire viewport. Let its content determine its height.

Left-side content:

Small eyebrow:
“YOUR PERSONAL RESEARCH NOTEBOOK”

Headline:
“Turn observations into evidence-backed research.”

Supporting paragraph:
“Capture notes, measurements, and location. Explore your observations with Gemini, review supporting evidence, and decide what to investigate next.”

Actions:

* Primary: “Start your journal,” using the existing sign-in flow.
* Secondary: “See how it works,” linking to the workflow section.

Below the actions:
“Your original observations stay yours. AI analysis stays separate.”

Right-side product preview:

Create a compact read-only interface composition using HTML and existing styling primitives. Do not use the generated image as one large screenshot containing the entire page.

ObservationPreview should contain:

* Small “Example observation” label.
* Title: “Pollinator activity after rainfall.”
* Date and approximate-location label.
* Two tags.
* A short observation description.
* Three measurement rows: air temperature, relative humidity, and bee count.
* One small evidence image only if a suitable owned or licensed asset exists.

Use a semantic table or definition list for measurements, not a data-table library.

AnalysisPreview should contain:

* “Gemini analysis” label in violet.
* A short possible interpretation.
* A clearly visible uncertainty statement.
* Supporting-observation titles.
* A restrained provenance footer.

Example uncertainty:
“One observation cannot establish a pattern. More comparable records are needed.”

Keep both panels aligned. A small overlap is acceptable on wide screens, but do not use rotation or awkward floating layers.

Clearly identify all preview content as illustrative sample data. Do not imply that a live Gemini request occurred.

On mobile:

* Stack message, actions, observation preview, and analysis preview.
* Remove overlap.
* Reduce preview content rather than shrinking all text.
* Avoid horizontal scrolling.

## 4. Compact trust strip

Components: semantic list, Lucide icons, border separators.

Place a slim strip beneath the hero with four brief points:

* “Original records remain unchanged.”
* “Journal answers show supporting observations.”
* “You choose location precision.”
* “Your account’s records are private.”

Use small icons and readable text. No large cards, shadows, or technical paragraphs.

Use four columns on desktop, two on tablet, and a simple stacked layout on narrow screens.

These statements must match actual implemented behavior. Do not add unverified claims about certification, model training, end-to-end encryption, or guaranteed accuracy.

## 5. Workflow: one understandable research story

Components: section heading, semantic ordered list, small icons.

Heading:
“From field note to next investigation.”

Supporting sentence:
“Record what happened, review what it might mean, and choose your next step.”

Show four steps:

1. Record — Capture what you observed.
2. Add evidence — Include measurements, media, or location.
3. Analyze — Review Gemini’s interpretation and uncertainty.
4. Investigate — Choose whether to add a suggested research task.

Use one connected horizontal sequence on desktop and a vertical list on mobile.

Prefer thin dividers and small numbered markers over four large identical cards. Do not introduce a stepper library or scroll-driven animation.

Keep the distinction clear: Gemini suggests investigations; the user creates a task by accepting one.

## 6. Feature showcase: three focused sections

Create one reusable FeatureSection layout component with:

* Section number or small label.
* Heading.
* Short paragraph.
* At most two supporting points.
* One illustrative product preview.

Alternate text and preview placement on desktop. Always put text before the preview in the mobile reading order.

Do not repeat the complete hero preview in every section.

### 6A. Structured observations

Components: FeatureSection, a custom read-only editor preview, Badge, semantic measurement table.

Heading:
“Capture the details that matter.”

Description:
“Start with a simple note. Add scientific detail when your research needs it.”

Preview content:

* Observation title and description.
* Observed date.
* Optional project label.
* Optional hypothesis.
* A compact measurement table.
* An evidence attachment indicator.

Keep this a static illustration, not a working form. Use text and styled containers instead of focusable fake inputs.

Show that projects, hypotheses, measurements, and location are optional. Do not imply that creating a project is required to record an observation.

### 6B. Research map

Components: FeatureSection, static map preview, small observation list, Badge.

Heading:
“See your research in context.”

Description:
“Explore where observations happened while controlling how precisely locations appear.”

Use an existing approved map screenshot or a clearly illustrative lightweight map graphic.

Show:

* A few observation pins.
* One selected observation.
* An approximate-location area.
* A short matching observation list.
* An “Approximate location” label.

Do not initialize a live map SDK, request browser location, fetch private observations, or introduce API keys just for this public preview.

Do not display exact coordinates for an approximate example. Hidden locations should not appear as pins.

If a map asset is unavailable, use a restrained schematic labeled “Illustrative map,” rather than inventing realistic geographic accuracy.

### 6C. Ask My Journal

Components: FeatureSection, custom AnswerPreview, Badge, semantic source list.

Heading:
“Ask questions. Follow the evidence.”

Description:
“Explore your own observations with answers that show their sources and limitations.”

Show a static example question:
“What can my observations tell me about pollinator activity after rain?”

Organize the preview into:

* Answer.
* Supporting observations.
* What remains uncertain.

Use human-readable observation titles instead of technical IDs. Label supporting records as “Example sources.”

Keep source references visually distinct from the answer. Do not invent numerical findings unless the displayed example records support them.

No live AI calls are needed. Do not show a working-looking question input or Send button unless an actual demo is implemented within scope.

## 7. Scientific integrity and privacy

Components: two-column section, semantic lists, optional Accordion.

Combine integrity and privacy into one focused section instead of adding multiple repetitive reassurance sections.

Heading:
“Your records are the source of truth.”

Left column:

* User-authored observations remain separate from AI interpretations.
* AI output is clearly labeled.
* Supporting observations and uncertainty are visible.
* Suggested tasks require user acceptance.

Include a small provenance example:
“Gemini analysis · Example sources · Generation details”

Only display real model and prompt-version values when they are available; do not present invented values as production metadata.

Right column:

Heading:
“Private by design.”

Short points:

* Google sign-in protects access.
* Each account’s records are isolated.
* Location precision is controlled by the user.
* Server-side secrets are not exposed in the browser.

Optionally use a single closed-by-default Accordion titled “How privacy works” for a short plain-language explanation.

Do not turn this into a lengthy security document, certification display, or guarantee.

## 8. Final call to action and footer

Components: section, Button, semantic footer.

Use a compact final CTA with a subtly tinted background:

Heading:
“Start with one observation.”

Supporting text:
“Build a research journal you can return to, question, and grow.”

Action:

* Signed out: “Start your journal.”
* Signed in: “Open Dashboard.”

Reuse the same authentication behavior as the hero.

Footer:

* Product name.
* Brief technology attribution: “Built with Google Cloud Run, Firebase, and Gemini.”
* Privacy or repository links only if valid destinations already exist.

Do not invent links, testimonials, user counts, awards, or partner endorsements.

## 9. Interaction and accessibility rules

* Use real links for navigation and buttons for actions.
* All visible interactive controls must work.
* Static previews must not contain misleading, focusable fake controls.
* Keep visible focus indicators and accessible names.
* Provide a skip-to-content link.
* Use one h1 and a logical heading hierarchy.
* Ensure readable contrast, including metadata and uncertainty text.
* Decorative icons and patterns should be hidden from screen readers.
* Keep touch targets comfortably sized.
* Respect reduced-motion preferences.
* Use only subtle hover/focus transitions; no autoplay or scroll hijacking.
* Provide meaningful alt text for product images.
* Avoid exposing private user data on the public homepage.

## 10. Scope and verification

This task redesigns the public homepage only. Do not change the database schema, AI behavior, private application navigation, or authentication architecture.

Reuse existing components and split the homepage into a small number of meaningful sections. Do not create an excessive component hierarchy.

Before finishing:

* Check desktop, tablet, and mobile layouts.
* Check keyboard navigation and the mobile menu.
* Verify signed-in and signed-out CTA behavior.
* Confirm all anchor links reach the correct sections.
* Confirm there is no horizontal overflow.
* Run available lint, typecheck, and build checks.
* Check that marketing claims match implemented features.
* Summarize changes and any remaining limitations.

The finished page should show a credible scientific workflow within the first screen, while remaining simple enough to implement and maintain.
