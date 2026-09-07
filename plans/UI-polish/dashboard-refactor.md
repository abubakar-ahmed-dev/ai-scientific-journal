Here is a clean plan you can give directly to the coding agent.

````md
# Dashboard Redesign Plan — AI Scientific Journal

## Goal

Redesign the authenticated dashboard so it feels like a private scientific research workspace, not a second homepage.

The homepage already explains the product, workflow, privacy, and AI value. The dashboard should focus on action, research status, and next steps.

Implement two dashboard states:

1. New user dashboard: no projects, no observations, no tasks, no analyses.
2. Returning user dashboard: user has existing data.

Do not make the new-user dashboard visually identical to the homepage or old-user dashboard.

---

## Global Layout

Use the existing app shell:

- Keep the left sidebar.
- Keep the top header/search/user/sign-out area.
- Main content starts after sidebar and below header.
- Use a max content width of around `1280px`.
- Desktop page padding: `32px`.
- Tablet padding: `24px`.
- Mobile padding: `16px`.
- Vertical spacing between major sections: `28px` to `36px`.
- Card gap: `20px` to `24px`.
- Card radius: `8px`.
- Use subtle borders and very light shadows only.
- Background should remain soft green/off-white.
- Cards should be white or very lightly tinted.
- Avoid huge empty cards.
- Avoid large marketing-style centered sections inside the app.

Suggested structure:

```text
App Shell
  Sidebar
  Top Header
  Main Dashboard Content
```

---

# 1. New User Dashboard

## Purpose

The new-user dashboard should help the user create their first real research record quickly.

It should feel like:

> “You are inside your private research workspace. Start your first observation.”

It should not explain the whole product again.

---

## New User Layout

Desktop layout:

```text
Page Header
Primary Start Panel
Two-column area:
  Left: Quick Observation Draft
  Right: Workspace Readiness
Feature Preview Row
```

Mobile layout:

```text
Page Header
Primary Start Panel
Quick Observation Draft
Workspace Readiness
Feature Preview Cards stacked
```

---

## A. Page Header

Place at top of dashboard content.

Left side:

```text
Good afternoon
Start your first research record.
```

Right side:

```text
[New Observation]
```

Use the same primary button style already used in the app.

Spacing:

* Header margin-bottom: `28px`.
* H1 size around `32px` desktop, `26px` mobile.
* Subtitle size around `15px` or `16px`.
* Keep it left-aligned.

Do not use a big homepage-style hero here.

---

## B. Primary Start Panel

Place directly below header.

This is the main empty-state card.

Card layout:

```text
[Small notebook/observation icon]

Start with one observation.
Capture what happened, add notes or measurements, and save it as your first research record.

[Record First Observation] [Create Project]
```

Design:

* Card height should be around `220px` to `260px`, not full-page.
* Left-align content on desktop.
* Use a very subtle green-tinted background or white card with a soft accent strip.
* Primary button: `Record First Observation`.
* Secondary button: `Create Project`.

Important:

* The main CTA should be `Record First Observation`, not only `Create Project`.
* Observation is the core object of the app.
* Do not show a rocket illustration.
* Do not show a long numbered onboarding list here.

---

## C. Quick Observation Draft Card

Place below the primary panel, left side of a two-column grid.

Width:

* Desktop: about 65% of row.
* Right panel: about 35%.
* Gap: `24px`.

Card title:

```text
Quick Capture
```

Content:

```text
Observation title
What did you observe?
Optional notes
```

Actions:

```text
[Save Draft] [Open Full Form]
```

This can be a lightweight form or a visual preview if full inline creation is not implemented yet.

UX purpose:

* Make the dashboard feel usable immediately.
* User should feel they can start writing without navigating around.

If inline save is too much for now, clicking inside the card can route to the full New Observation page.

---

## D. Workspace Readiness Card

Place to the right of Quick Capture.

Card title:

```text
Workspace Ready
```

Show short status rows:

```text
✓ Private account active
✓ AI assistant available
✓ Secure storage ready
○ No observations yet
```

Design:

* Compact.
* No long explanation.
* Use small icons and green check indicators.
* This card quietly reinforces security and stability without repeating homepage privacy content.

---

## E. Feature Preview Row

Place below the quick capture/workspace row.

Use three compact cards:

```text
AI Analysis
Unlocks after your first observation.

Research Map
Appears when observations include location.

Research Tasks
Create follow-up work from findings.
```

Design:

* Three-column desktop grid.
* One-column mobile stack.
* Cards should look slightly muted/inactive.
* Do not use large illustrations.
* Do not show fake data unless there is a deliberate sample/demo mode.
* Each card can have a small icon and one short sentence.

Purpose:

* Show what comes next without turning dashboard into homepage marketing.

---

## F. What Not To Show For New Users

Do not show these sections when all counts are zero:

* Recent Observations empty list
* Today’s Tasks empty list
* Recent Activity empty list
* Four stat cards all showing `0`
* Large blank panels
* Repeated “How it works” content

New users should see starting actions, not empty database state.

---

# 2. Returning User Dashboard

## Purpose

Returning-user dashboard should become a research command center.

It should answer:

1. What is active?
2. What changed recently?
3. What should I do next?
4. What can AI help with now?

---

## Returning User Layout

Desktop layout:

```text
Page Header
Today’s Research Brief
AI Research Assistant Row
Stats Row
Two-column content:
  Left: Recent Observations
  Right: Today’s Tasks + Recent Activity
```

---

## A. Page Header

Left:

```text
Good evening
Continue your research where you left off.
```

Right:

```text
[New Observation]
```

Keep current behavior, but ensure the header does not overlap sidebar/topbar.

---

## B. Today’s Research Brief

Replace the current plain “Current Research” card with a more useful panel.

Card content:

```text
Current Research
Project Name
Short project description

1 recent observation
0 open tasks
Last activity: 8h ago

Suggested next step:
Analyze your latest observation to find patterns.

[Continue Research] [Analyze Latest] [View Project]
```

Design:

* Full-width card.
* Height around `220px`.
* Stronger visual hierarchy than stat cards.
* Use a small status badge: `ACTIVE`.
* Add one “Suggested next step” line to make it feel intelligent.

If there is no active project but user has observations, show:

```text
Latest Research Activity
You added [observation title] recently.
[View Observation] [Analyze]
```

---

## C. AI Research Assistant Row

Place below Today’s Research Brief.

Use 3 action cards:

```text
Analyze Latest
Generate a structured analysis from your newest observation.

Ask Journal
Ask questions grounded in your saved observations.

Suggest Next Steps
Turn findings into research tasks.
```

Design:

* Three-column grid on desktop.
* Use AI accent color only here.
* Cards should be clickable.
* Each card should have icon + title + one short description.
* Do not make these look like generic navigation buttons.

---

## D. Stats Row

Show four stat cards only for returning users.

Cards:

```text
Observations
Active Projects
Open Tasks
AI Analyses
```

Each stat card should include:

* Number
* Small icon
* One useful secondary line

Examples:

```text
Observations
12
+3 this week

Open Tasks
4
2 due soon
```

If trend data is not available, use useful links:

```text
View journal
Manage projects
Open task board
Review analyses
```

Spacing:

* Four columns desktop.
* Two columns tablet.
* One column mobile.
* Gap: `20px`.

---

## E. Main Content Area

Use two-column layout.

Left column: `2fr`
Right column: `1fr`
Gap: `24px`.

### Left: Recent Observations

Section header:

```text
Recent Observations        View all →
```

Observation card layout:

```text
Observation title
Short description
Date · Measurements · Files · Location precision
Status badge
```

Rules:

* Show max 3 recent observations.
* Cards should be compact.
* Status badge should be visible but not loud.
* Each card should be clickable.

### Right: Today’s Tasks

Section header:

```text
Today’s Tasks        View all →
```

Show max 3 tasks.

If no tasks:

```text
You are caught up.
[Add Task]
```

Keep this smaller than the main observation column.

### Right: Recent Activity

Below Today’s Tasks.

Show short activity list:

```text
Observation added · 37m ago
Project updated · 8h ago
AI analysis created · Yesterday
```

Use icons and timestamps.

---

## Visual Rules

* Do not use large hero typography inside dashboard.
* Dashboard text should be practical and scannable.
* Use left alignment for most content.
* Use centered content only for very small empty cards.
* Avoid repeated homepage patterns like large feature explanations.
* Avoid too many zero-count cards.
* Keep cards compact and information-dense.
* Use color meaningfully:

  * Green: primary research/action
  * Purple: AI features
  * Blue: evidence/map/search
  * Orange/yellow: warning/uncertainty
  * Red: destructive/errors only

---

## Responsive Behavior

Desktop:

* Sidebar visible.
* Main content max width around `1280px`.
* Returning user main area uses `2fr / 1fr` grid.
* New user quick capture uses `2fr / 1fr` grid.

Tablet:

* Reduce padding to `24px`.
* Stats become two columns.
* Main content can remain two columns if width allows.

Mobile:

* Sidebar collapses/drawers.
* All dashboard grids become one column.
* Primary actions stack vertically or become full-width.
* Cards should not overflow.
* Search can collapse to icon or full-width row.

---

## Acceptance Criteria

New user dashboard:

* Does not repeat homepage “how it works” content.
* Shows one clear primary action: record first observation.
* Does not show empty old-user sections.
* Feels like a usable workspace, not a marketing page.

Returning user dashboard:

* Shows current research context.
* Shows AI-powered next step.
* Shows stats only when meaningful.
* Shows recent observations, tasks, and activity.
* Gives clear routes to continue research, analyze, ask AI, or add tasks.

Overall:

* No layout overlap with sidebar/header.
* No excessive whitespace.
* No giant empty card.
* Works cleanly on desktop, tablet, and mobile.

```
```
