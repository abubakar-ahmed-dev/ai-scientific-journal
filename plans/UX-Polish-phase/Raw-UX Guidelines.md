# UX Guidelines — AI Scientific Journal

**Status:** Canonical UX/UI guidance
**Purpose:** Define the user experience, information architecture, interaction patterns, visual hierarchy, and usability requirements for the AI Scientific Journal web application.

---

## 1. Purpose

This document is the **UX source of truth** for the AI Scientific Journal application.

All frontend implementation must follow these guidelines unless an existing canonical product/architecture document explicitly requires otherwise.

The application must feel like a **professional scientific research workspace**, not a generic CRUD dashboard and not a generic AI chatbot.

The primary UX objective is:

> Users should immediately understand where they are, what they are currently working on, what requires attention, and what they can do next.

The interface should minimize cognitive load and make common research workflows obvious.

---

# 2. Core UX Principles

The following principles are mandatory.

## 2.1 Clarity over decoration

Do not add visual elements merely because they look impressive.

Every UI element should have a clear purpose.

Prefer:

* clear hierarchy
* readable typography
* obvious actions
* predictable navigation
* useful contextual information
* meaningful feedback

Avoid:

* excessive gradients
* excessive animations
* decorative charts
* unnecessary cards
* excessive shadows
* excessive icons
* visual clutter

The application should feel sophisticated through **clarity and consistency**, not visual noise.

---

## 2.2 The application is a scientific workspace

The UI should communicate:

* research
* organization
* evidence
* observations
* exploration
* structured thinking
* AI-assisted discovery

Avoid making the product look like:

* a social media application
* a generic analytics dashboard
* a cryptocurrency dashboard
* an AI chatbot wrapper
* a flashy marketing website

The visual language should be calm, professional, modern, and trustworthy.

---

## 2.3 Dashboard = orientation + continuation + action

The Dashboard is not supposed to contain everything.

Its job is to help users:

1. understand their current research context
2. continue where they left off
3. see what needs attention
4. perform common actions quickly
5. discover useful AI-assisted insights
6. access deeper application areas

The Dashboard should **not duplicate the full functionality** of:

* Observations
* Research Map
* Ask Journal
* Tasks
* AI Chat
* Projects
* Settings

Those pages should remain focused on their specific workflows.

---

## 2.4 Minimize cognitive load

Users should not have to remember:

* where a feature is located
* which page contains an object
* what button performs an action
* whether something was saved
* whether an operation succeeded
* how to return to their previous context

The UI should provide contextual navigation and feedback.

---

## 2.5 One obvious primary action

Important screens should have one visually dominant primary action.

Examples:

Dashboard:

> Continue Research

Observation page:

> Save Observation

Project page:

> Continue Project / Add Observation

AI interaction:

> Ask / Send

Avoid presenting many buttons with equal visual importance.

---

# 3. Application Information Architecture

The application contains the following primary pages:

```text
Homepage
Dashboard

Research
├── Observations
├── Research Map
└── Ask Journal

Work
├── Tasks
└── Projects

AI
└── AI Chat

Settings
```

The navigation must communicate this hierarchy.

---

# 4. Global Application Shell

The application should use a consistent application shell across authenticated pages.

Recommended structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ Top Header                                                  │
├───────────────┬─────────────────────────────────────────────┤
│               │                                             │
│ Sidebar       │ Main Content                                │
│               │                                             │
│ Navigation    │ Page                                        │
│               │                                             │
│               │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

The shell should remain consistent between:

* Dashboard
* Observations
* Research Map
* Ask Journal
* Tasks
* AI Chat
* Projects
* Settings

Do not redesign the navigation independently for each page.

---

# 5. Sidebar Navigation

## 5.1 Default state

The desktop sidebar should be expanded by default.

Navigation should use:

**icon + text label**

Do not rely on icons alone.

Recommended structure:

```text
✦ AI Scientific Journal

WORKSPACE

⌂ Dashboard

RESEARCH
◉ Observations
◈ Research Map
✦ Ask Journal

WORK
✓ Tasks
▱ Projects

AI
◇ AI Chat

────────────────

⚙ Settings
```

The exact icons may differ depending on the project's icon library, but their meanings must remain clear.

---

## 5.2 Active navigation state

The current page must be visually distinguishable.

Use:

* subtle background treatment
* accent color
* clear text weight
* optional indicator

Do not rely solely on color.

The active state should remain obvious to users with color-vision deficiencies.

---

## 5.3 Sidebar collapse

Desktop users may collapse the sidebar.

Collapsed state:

```text
◉
◈
✦
✓
▱
◇
⚙
```

When collapsed:

* preserve recognizable icons
* provide tooltips
* maintain keyboard accessibility
* never remove access to functionality

The application should remember the user's sidebar preference when practical.

---

# 6. Global Header

The top header should contain only useful global functionality.

Recommended:

```text
Page / Context                    Search       Notifications    Avatar
```

A global search/command action should be accessible from the header.

Recommended shortcut:

```text
Ctrl + K
```

on Windows/Linux.

On macOS:

```text
Cmd + K
```

Display the shortcut where appropriate.

---

# 7. Command Palette / Global Search

The application should support a command palette if technically feasible.

Activation:

```text
Ctrl + K
```

or

```text
Cmd + K
```

Example:

```text
┌──────────────────────────────────────────────┐
│ 🔍 Search observations, projects, actions...│
├──────────────────────────────────────────────┤
│                                              │
│ QUICK ACTIONS                                │
│                                              │
│ +  New Observation                           │
│ ✦  Ask Journal                               │
│ ◇  Open AI Chat                              │
│ ✓  Create Task                               │
│ ▱  Open Projects                             │
│                                              │
│ RECENT                                        │
│ Protein Folding Study                        │
│ Observation #184                             │
└──────────────────────────────────────────────┘
```

The command palette should eventually support:

* navigating to pages
* searching observations
* searching projects
* searching tasks
* opening recent items
* creating observations
* creating tasks
* opening AI Chat
* opening Ask Journal

Do not implement fake search behavior.

If a feature is not actually supported, do not expose it as an action.

---

# 8. Dashboard UX

## 8.1 Dashboard purpose

The Dashboard should answer these questions within approximately five seconds:

1. What am I working on?
2. What should I do next?
3. What did I recently work on?
4. What progress have I made?
5. Where can AI help?

---

# 9. Dashboard Information Hierarchy

Recommended order:

```text
1. Greeting / context
2. Current Research
3. Quick Actions
4. Today's Tasks + Research Overview
5. Journal Intelligence
6. Recent Activity
```

Do not place low-value analytics above active work.

---

# 10. Dashboard Header

Use contextual language rather than a generic dashboard title.

Preferred:

```text
Good evening

Continue your research where you left off.
```

Avoid:

```text
Dashboard
Welcome back!
```

The exact greeting should adapt to the time of day where appropriate.

Do not over-personalize.

---

# 11. Current Research / Continue Research

This is the most important Dashboard component.

It should provide the user's current research context.

Example:

```text
┌─────────────────────────────────────────────────────────────┐
│ CURRENT RESEARCH                                  ACTIVE    │
│                                                             │
│ Protein Folding Study                                       │
│                                                             │
│ Investigating structural changes under varying              │
│ environmental conditions.                                  │
│                                                             │
│ Research progress                                           │
│ ████████████████████████░░░░░░  78%                        │
│                                                             │
│ Last activity: Today, 7:42 PM                               │
│                                                             │
│ [ Continue Research ]              View Project →           │
└─────────────────────────────────────────────────────────────┘
```

Requirements:

* clearly identify the project/research context
* show useful progress when available
* show recent activity
* provide one primary continuation action
* provide secondary navigation to the project
* do not invent progress values

If the system does not have enough information to calculate research progress reliably, do not display a fake percentage.

---

# 12. Quick Actions

Immediately after the current research component, provide a small set of common actions.

Recommended:

```text
What do you want to do?

┌────────────────┐
│ +              │
│ New Observation│
│ Record research│
└────────────────┘

┌────────────────┐
│ ✦              │
│ Ask Journal    │
│ Search knowledge│
└────────────────┘

┌────────────────┐
│ ◇              │
│ AI Chat        │
│ Work with AI   │
└────────────────┘

┌────────────────┐
│ ✓              │
│ Add Task       │
│ Plan your work │
└────────────────┘
```

Maximum recommended default:

**3–4 actions.**

Do not create a grid containing every possible application function.

---

# 13. Research Overview

Metrics should be useful and contextual.

Recommended:

```text
Research at a glance

184 Observations
+12 this week

4 Active Projects
2 recently updated

7 Open Tasks
3 due today

23 AI Insights
+5 this week
```

Metrics must be based on real application data.

Do not fabricate metrics for visual purposes.

Avoid meaningless vanity statistics.

---

# 14. Today's Tasks

The Dashboard should show only actionable tasks.

Example:

```text
Today's Tasks                         View all →

☐ Review Observation #184             Today
☐ Add results to Protein Study        Today
☐ Review AI-generated insight         Tomorrow

+ Add task
```

Do not show dozens of tasks.

Recommended:

**3–5 most relevant tasks.**

Prioritize:

1. overdue
2. due today
3. high priority
4. recently created

Provide:

> View all →

for the full Tasks page.

---

# 15. Continue Where You Left Off

The application should preserve user context whenever possible.

Example:

```text
Continue where you left off

📝 Observation #184

"Temperature variation produced an unexpected..."

Edited 18 minutes ago

Open →
```

This can refer to:

* observation
* project
* research map
* AI conversation
* Ask Journal query
* task

The system should choose the most relevant recent activity.

Do not display multiple competing "continue" components.

---

# 16. Journal Intelligence

AI should appear as an intelligent layer over the research workspace.

Example:

```text
┌────────────────────────────────────────────────────────────┐
│ ✦ Journal Intelligence                                     │
│                                                            │
│ Based on your recent observations, you may want to review  │
│ 3 related observations.                                    │
│                                                            │
│ [ Review connections ]                                     │
└────────────────────────────────────────────────────────────┘
```

Another possible example:

```text
AI suggestion

Your last three observations mention
"temperature variation".

[ Explore with AI ]
```

Requirements:

* AI suggestions must be based on real data
* clearly distinguish suggestions from facts
* do not make unsupported scientific claims
* provide a way to inspect the source/context
* avoid interruptive AI popups

AI should assist the researcher without taking over the interface.

---

# 17. Recent Activity

Show a chronological, useful activity feed.

Example:

```text
Recent Activity                            View all →

● Added Observation #184                   18m ago

✦ AI generated summary for Observation #181
                                             1h ago

✓ Completed "Review experiment results"
                                             Yesterday

◇ Asked Journal:
"What evidence supports..."
                                             Yesterday
```

Activities should be clickable where possible.

Clicking an activity should take the user directly to the relevant object.

---

# 18. Dashboard Layout

Recommended desktop composition:

```text
Dashboard

Good evening
Continue your research where you left off.

┌──────────────────────────────────────────────────────────┐
│ Current Research                                         │
│                                                          │
│ Protein Folding Study                            78%      │
│ [ Continue Research ]                                    │
└──────────────────────────────────────────────────────────┘

Quick Actions

┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Observation│ │ Ask Journal│ │ AI Chat    │ │ Add Task   │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

┌────────────────────────────┐ ┌───────────────────────────┐
│ Today's Tasks              │ │ Research at a Glance      │
│                            │ │                           │
│ ☐ Review results           │ │ 184 Observations          │
│ ☐ Add experiment           │ │ 4 Active Projects         │
│ ☐ Review insight           │ │ 7 Open Tasks              │
└────────────────────────────┘ └───────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ ✦ Journal Intelligence                                   │
│                                                          │
│ 3 observations may be related to your current research. │
│ [ Explore connections ]                                  │
└──────────────────────────────────────────────────────────┘

Recent Activity
───────────────────────────────────────────────────────────
...
```

---

# 19. Dashboard Must Not Become a Data Dump

Avoid layouts containing:

* 10+ metric cards
* large unnecessary charts
* duplicate project information
* duplicate task lists
* excessive AI recommendations
* multiple competing primary buttons

The Dashboard is a **launchpad**, not the entire application.

---

# 20. Empty States

Empty states are first-class UX components.

Never display:

```text
No data available.
```

when a useful explanation can be provided.

---

## 20.1 New user Dashboard

Example:

```text
Your research workspace is ready.

Create your first research project to begin.

[ Create Project ]

Getting started

① Create your first project
② Record your first observation
③ Explore Journal AI
```

---

## 20.2 Empty Observations

Example:

```text
No observations yet.

Observations are the foundation of your research journal.

[ Add your first observation ]
```

---

## 20.3 Empty Projects

```text
No research projects yet.

Create a project to organize observations,
tasks, and AI-assisted research.

[ Create Project ]
```

---

## 20.4 Empty Tasks

```text
You're all caught up.

No tasks require your attention right now.

[ Add Task ]
```

Empty states should always explain:

1. what is empty
2. why it matters
3. what the user can do next

---

# 21. User State Adaptation

The Dashboard should adapt based on the user's state.

## New user

Show onboarding guidance.

```text
Welcome to your scientific workspace.

[ Create Project ]

Getting Started
① Create project
② Add observation
③ Explore AI
```

---

## Active user

Prioritize:

* current project
* recent activity
* tasks
* observations
* AI suggestions

---

## Returning user

Prioritize:

* unfinished work
* recent changes
* overdue tasks
* new AI insights

Example:

```text
Welcome back.

4 items may need your attention.

3 tasks are overdue
2 new AI insights are available

[ Review ]
```

Do not overwhelm the user with notifications.

---

# 22. AI UX Principles

AI is a core capability, but it must not dominate the application.

The application should feel like:

> A scientific journal enhanced by AI.

Not:

> A chatbot with a journal attached.

---

## 22.1 AI must be contextual

Prefer:

```text
Observation → Analyze with AI
Project → Ask about this project
Research Map → Explore connection with AI
Ask Journal → Search journal knowledge
```

over generic AI prompts disconnected from the user's research context.

---

## 22.2 AI-generated content must be distinguishable

Clearly distinguish:

* user-created content
* system-generated content
* AI-generated content

Use subtle labels such as:

```text
✦ AI generated
```

or:

```text
AI suggestion
```

Do not make AI content visually indistinguishable from user-authored scientific observations.

---

## 22.3 AI should explain context where important

For AI-derived insights, provide access to:

* source observations
* relevant project
* evidence/context
* timestamp
* reasoning or supporting references where the system supports them

Avoid presenting AI conclusions as scientific facts.

---

# 23. AI Chat UX

AI Chat should feel like a research assistant.

Recommended layout:

```text
┌────────────────────────────────────────────────────────────┐
│ AI Chat                                      New Chat       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ User                                                       │
│ What patterns appear in my recent observations?            │
│                                                            │
│ AI                                                         │
│ I found three recurring patterns...                        │
│                                                            │
│ Sources / Context                                          │
│ Observation #181                                          │
│ Observation #184                                          │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ Ask something about your research...              Send →   │
└────────────────────────────────────────────────────────────┘
```

The chat should support research context rather than being an isolated general-purpose chatbot.

---

# 24. Ask Journal UX

Ask Journal and AI Chat must have clearly differentiated purposes.

Recommended conceptual distinction:

### Ask Journal

> Search and ask questions about the user's journal/knowledge.

### AI Chat

> Have an interactive AI-assisted research conversation.

Do not make the two pages identical.

Ask Journal should emphasize:

* journal search
* evidence
* observations
* projects
* retrieved context
* grounded answers

AI Chat can emphasize:

* iterative conversation
* analysis
* brainstorming
* assistance
* research planning

---

# 25. Observations UX

Observations are fundamental scientific objects.

The UI should prioritize:

* clear creation
* readable content
* timestamps
* project association
* search/filter
* AI assistance
* editing
* source/context

Observation creation should feel lightweight enough that users can record information quickly.

Do not create unnecessarily long forms.

Use progressive disclosure for advanced fields.

---

# 26. Observation Creation

Recommended structure:

```text
New Observation

Title
[____________________________]

Observation
[                              ]
[                              ]
[                              ]

Project
[ Select project              ]

Tags
[ Add tags                    ]

Attachments / metadata
[ Optional                    ]

             Cancel   Save Observation
```

Primary action:

> Save Observation

Avoid overwhelming users with advanced options initially.

---

# 27. Research Map UX

The Research Map should communicate relationships between:

* observations
* projects
* concepts
* evidence
* research topics

Do not treat it as a decorative graph.

Every node should have meaning.

Users should be able to:

* understand relationships
* inspect nodes
* navigate to source objects
* filter the map
* zoom/pan where appropriate
* return to the current context

If the map becomes visually dense, provide filtering and progressive disclosure.

---

# 28. Tasks UX

Tasks should optimize for action.

Recommended structure:

```text
Tasks

Today
────────────────────────

☐ Review Observation #184
☐ Add experiment results
☐ Review AI insight

Upcoming
────────────────────────

☐ Prepare research summary
☐ Review project notes
```

Support:

* completion
* due dates
* priorities
* project association
* filtering
* sorting

Do not make task management unnecessarily complicated.

---

# 29. Projects UX

Projects should be the organizational backbone.

A project can contain:

* observations
* tasks
* AI conversations
* research context
* progress
* related information

Project pages should provide a clear overview before exposing detailed information.

Example:

```text
Protein Folding Study

Status: Active

Progress
██████████████████░░ 78%

Overview
...

Recent Observations
...

Tasks
...

AI Insights
...

[ Continue Research ]
```

---

# 30. Settings UX

Settings should be functional and organized.

Recommended categories:

```text
Settings

Account
Appearance
Notifications
AI Preferences
Privacy & Security
Data
```

Do not put unrelated settings into one giant form.

Use clear section headings.

Dangerous actions such as deletion must be visually separated and require confirmation.

---

# 31. Typography

Use a highly readable modern sans-serif font.

Recommended hierarchy:

```text
Page heading
28–32px
Semibold/Bold

Section heading
20–24px
Semibold

Card title
16–18px
Semibold

Body
14–16px
Regular

Metadata
12–13px
Regular
```

Exact values may be adjusted according to the established design system.

Prioritize readability over visual novelty.

---

# 32. Spacing

Use a consistent spacing scale.

Do not independently choose arbitrary margins and paddings throughout the application.

A reasonable base scale:

```text
4px
8px
12px
16px
24px
32px
48px
64px
```

Components should use spacing from this system.

---

# 33. Color Strategy

Use a restrained color palette.

Recommended conceptual structure:

```text
Background
Surface
Elevated Surface
Primary Text
Secondary Text
Border
Accent
Success
Warning
Error
```

The primary accent may use a scientific green/teal direction if consistent with the existing brand.

Do not use the accent color everywhere.

Accent should emphasize:

* active navigation
* primary buttons
* important states
* progress
* focused AI actions

Avoid excessive neon or gradient effects.

---

# 34. Cards and Containers

Cards should be used to establish meaningful grouping.

Do not place every UI element inside a card.

Bad:

```text
┌────────┐
│ CARD   │
└────────┘
┌────────┐
│ CARD   │
└────────┘
┌────────┐
│ CARD   │
└────────┘
```

Prefer a clear page composition with selective grouping.

Cards should communicate:

> These pieces of information belong together.

---

# 35. Buttons

Buttons must communicate hierarchy.

Recommended:

### Primary

For the main action.

Example:

```text
[ Continue Research ]
```

### Secondary

For related actions.

```text
[ View Project ]
```

### Tertiary / ghost

For low-priority actions.

```text
View all →
```

### Destructive

For irreversible actions.

```text
Delete Project
```

Destructive actions must require confirmation when appropriate.

---

# 36. Forms

Forms should:

* use clear labels
* provide helpful placeholders only when necessary
* show validation near the relevant field
* preserve entered data when possible
* communicate required fields
* clearly show saving state

Avoid relying on placeholder text as the only label.

---

# 37. Loading States

Never show large blank areas while content loads.

Use skeleton states for content-heavy components.

Example:

```text
Current Research

████████████████████
██████████████
██████████████████████
```

For AI operations:

```text
✦ Analyzing your research...
```

Loading indicators should communicate that work is occurring.

Avoid unnecessary spinners for very fast operations.

---

# 38. Saving States

Users must know whether their work has been saved.

Example:

```text
Saving...
```

then:

```text
✓ Saved
```

Do not repeatedly interrupt users with large success notifications for routine autosaves.

---

# 39. Success Feedback

Feedback should match the importance of the action.

For a routine action:

```text
✓ Saved
```

For a major action:

```text
Observation created successfully.
```

Avoid excessive toast notifications.

---

# 40. Error Handling

Errors must be human-readable.

Bad:

```text
500 Internal Server Error
```

Better:

```text
We couldn't load your research.

Your work is safe. Please try again.

[ Try again ]
```

Error messages should explain:

1. what happened
2. whether user data is affected
3. what the user can do next

---

# 41. AI Error Handling

Example:

```text
Journal AI couldn't complete this request.

Please try again.

[ Try again ]
```

If the AI operation depends on missing context:

```text
I need more journal context to answer this question.

Try selecting a project or adding an observation first.
```

Do not expose raw API errors to users.

---

# 42. Offline / Network Failure UX

If relevant to the application's architecture:

```text
You're offline.

Your recent changes will sync when you're back online.
```

Only claim that changes will sync if the implementation actually supports synchronization.

Never promise functionality that does not exist.

---

# 43. Notifications

Notifications should be meaningful.

Potential categories:

* task due
* task overdue
* AI result ready
* research processing completed
* important system message

Avoid notifying users about every minor system event.

Users should be able to distinguish:

* informational
* success
* warning
* error

---

# 44. Accessibility

Accessibility is a core UX requirement.

Implement:

* semantic HTML
* keyboard navigation
* visible focus states
* accessible labels
* sufficient color contrast
* screen-reader-friendly controls
* logical tab order
* accessible dialogs
* accessible form errors
* keyboard-accessible menus
* reduced-motion support

Never communicate critical information through color alone.

For example, instead of:

```text
red = overdue
```

use:

```text
⚠ Overdue
```

with color as additional reinforcement.

---

# 45. Keyboard Accessibility

Important actions should be keyboard accessible.

Recommended:

```text
Ctrl/Cmd + K
```

Global command palette.

For dialogs:

```text
Esc → close
```

For forms:

```text
Enter → submit where appropriate
```

Users must be able to navigate without a mouse.

Do not create custom controls that cannot be operated through the keyboard.

---

# 46. Responsive Design

The application must work across:

* desktop
* laptop
* tablet
* mobile

Do not simply shrink the desktop UI.

---

## Desktop

Use:

```text
Persistent sidebar
+
Main content
```

---

## Tablet

Allow sidebar collapse.

Prioritize the main content.

---

## Mobile

Use a compact header/navigation model.

Example:

```text
┌──────────────────────────┐
│ ☰   Journal       Avatar │
├──────────────────────────┤
│                          │
│ Good evening             │
│                          │
│ Current Research         │
│ ┌──────────────────────┐ │
│ │ Protein Folding      │ │
│ │ ███████████░░ 78%    │ │
│ │ [ Continue ]         │ │
│ └──────────────────────┘ │
│                          │
│ Quick Actions            │
│                          │
│ Today's Tasks            │
│                          │
└──────────────────────────┘
```

Do not attempt to display the full desktop navigation simultaneously on small screens.

---

# 47. Micro-interactions

Use subtle micro-interactions to communicate state.

Examples:

### Task completion

```text
☐ Review results
      ↓
☑ Review results
```

### Saving

```text
Saving...
      ↓
✓ Saved
```

### Button interaction

Use subtle hover/focus/pressed states.

Avoid:

* excessive bouncing
* large movement
* unnecessary particle effects
* dramatic page transitions

Animation should support understanding, not distract from research.

---

# 48. Motion Guidelines

Animations should generally be:

* short
* subtle
* purposeful

Use motion to communicate:

* state changes
* opening/closing
* navigation
* progress
* completion

Respect:

```text
prefers-reduced-motion
```

Users who request reduced motion should not receive unnecessary animations.

---

# 49. Navigation Behavior

Navigation should be predictable.

When a user opens an object from a list:

```text
Observations
   ↓
Observation #184
```

The user should have an obvious way to return:

```text
← Observations
```

or through standard browser navigation.

Do not make users reconstruct their location manually.

---

# 50. Breadcrumbs

Use breadcrumbs when pages have meaningful hierarchy.

Example:

```text
Projects / Protein Folding Study / Observation #184
```

Do not use breadcrumbs merely for decoration.

---

# 51. Search and Filtering

Search should be available where the volume of information justifies it.

Examples:

Observations:

```text
🔍 Search observations...
```

Projects:

```text
🔍 Search projects...
```

Tasks:

```text
Filter: All | Today | Upcoming | Completed
```

Filtering should be:

* obvious
* reversible
* easy to clear

Provide:

```text
Clear filters
```

when multiple filters are active.

---

# 52. Progressive Disclosure

Do not show every advanced option immediately.

Example:

Observation creation:

```text
Basic
Title
Observation
Project

Advanced
Tags
Metadata
Additional configuration
```

This keeps common workflows fast while preserving advanced functionality.

---

# 53. Confirmation Dialogs

Use confirmation dialogs for actions that are:

* destructive
* irreversible
* high impact

Example:

```text
Delete Project?

This will permanently remove the project
and its associated data.

[ Cancel ]   [ Delete Project ]
```

Do not ask for confirmation for harmless actions such as:

* opening a page
* saving ordinary content
* changing a non-destructive filter

---

# 54. Data Safety UX

Because this is a scientific journal, users must feel that their research is safe.

Where appropriate, communicate:

* save state
* synchronization state
* successful persistence
* deletion consequences
* privacy implications

Do not make unsupported claims such as:

> Your data is encrypted

unless the implementation actually provides the stated protection.

---

# 55. Scientific Content UX

Scientific information should be displayed with high readability.

Prefer:

* clear headings
* readable paragraphs
* structured metadata
* source references
* timestamps
* project context
* expandable sections for large content

Avoid:

* extremely small text
* dense unbroken paragraphs
* unnecessary decorative formatting

---

# 56. AI + Scientific Integrity

AI output must not visually imply scientific certainty.

Where relevant, use language such as:

```text
AI suggestion
```

```text
Potential connection
```

```text
AI-generated summary
```

rather than:

```text
Scientific conclusion
```

unless the user themselves has established that conclusion.

AI-generated information should remain distinguishable from user observations.

---

# 57. Consistency Requirements

The following must be consistent throughout the application:

* sidebar
* header
* typography
* colors
* buttons
* spacing
* cards
* form controls
* dialogs
* toasts
* loading states
* error states
* empty states
* AI indicators
* icons
* focus states

Do not implement page-specific UI patterns when an existing global component already solves the problem.

---

# 58. Design System First

Before implementing individual pages, establish reusable design primitives/components where appropriate.

Potential component categories:

```text
Layout
├── AppShell
├── Sidebar
├── Header
└── PageContainer

Navigation
├── NavItem
├── Breadcrumbs
└── CommandPalette

Buttons
├── PrimaryButton
├── SecondaryButton
└── IconButton

Feedback
├── Toast
├── Alert
├── ErrorState
├── EmptyState
└── LoadingState

Content
├── Card
├── Section
├── Badge
├── Progress
└── ActivityItem

Forms
├── Input
├── Textarea
├── Select
├── Checkbox
└── Dialog

AI
├── AIIndicator
├── AIMessage
├── AISuggestion
└── SourceContext
```

Use the project's existing component architecture if one already exists.

Do not create duplicate components that perform the same function.

---

# 59. UX Priority Order

When implementation time is limited, prioritize UX work in this order:

## Priority 1 — Navigation

Users must always understand:

* where they are
* where they can go
* how to return

## Priority 2 — Primary workflows

Users must be able to easily:

* create observations
* manage projects
* manage tasks
* ask Journal
* use AI Chat

## Priority 3 — Dashboard orientation

Users should immediately understand:

* current research
* next actions
* recent activity

## Priority 4 — States

Implement:

* loading
* empty
* success
* error
* saving

## Priority 5 — Accessibility

Ensure:

* keyboard access
* focus
* contrast
* semantic structure

## Priority 6 — Responsive behavior

Ensure the workflows remain usable on smaller screens.

## Priority 7 — Micro-interactions

Only after the fundamentals are correct.

---

# 60. UX Anti-Patterns

The following should be avoided.

## 60.1 Dashboard overload

Do not display every feature on the Dashboard.

---

## 60.2 Icon-only navigation

Do not assume users understand icons.

---

## 60.3 Excessive cards

Not every piece of information requires a card.

---

## 60.4 AI everywhere

Do not place AI suggestions on every component.

---

## 60.5 Fake analytics

Do not invent metrics, progress, insights, or activity.

---

## 60.6 Generic errors

Do not expose raw HTTP/API/database errors.

---

## 60.7 Empty white screens

Always provide loading, empty, or error states.

---

## 60.8 Excessive animations

Do not prioritize visual effects over usability.

---

## 60.9 Hidden primary actions

The main action of a screen must be visually obvious.

---

## 60.10 Inconsistent terminology

Choose one term and use it consistently.

For example, if the product uses:

> Observation

do not randomly alternate between:

> Note
> Entry
> Record
> Observation

unless these are intentionally different concepts.

---

# 61. Dashboard UX Acceptance Criteria

The Dashboard implementation should satisfy the following.

### Navigation

* [ ] Sidebar is persistent on desktop.
* [ ] Navigation uses icons + labels.
* [ ] Current page is clearly indicated.
* [ ] Sidebar can collapse where appropriate.
* [ ] Navigation is keyboard accessible.

### Dashboard

* [ ] Current research is immediately visible.
* [ ] "Continue Research" is the primary action.
* [ ] Quick actions are limited to the most useful actions.
* [ ] Tasks are summarized rather than duplicated in full.
* [ ] Recent activity is visible.
* [ ] Research metrics are meaningful and data-driven.
* [ ] AI suggestions are contextual.
* [ ] Empty state is useful for new users.

### Interaction

* [ ] Loading states exist.
* [ ] Error states exist.
* [ ] Success feedback exists where appropriate.
* [ ] Saving state is communicated.
* [ ] Destructive actions require appropriate confirmation.

### Accessibility

* [ ] Keyboard navigation works.
* [ ] Focus states are visible.
* [ ] Controls have accessible labels.
* [ ] Color is not the only state indicator.
* [ ] Reduced motion is respected.

### Responsive

* [ ] Desktop layout works.
* [ ] Tablet layout works.
* [ ] Mobile layout works.
* [ ] Primary workflows remain usable on mobile.

---

# 62. Final UX Goal

The final product should feel like this:

```text
                    AI SCIENTIFIC JOURNAL

                         Dashboard
                              │
              ┌───────────────┼───────────────┐
              │               │               │
          CONTINUE          DISCOVER          ACT
              │               │               │
          Projects         Insights          Tasks
          Observations     Connections       AI
          Research Map     Recent work       New work
              │               │               │
              └───────────────┼───────────────┘
                              │
                       Research Workspace
                              │
                    AI-assisted research
```

The user should be able to enter the application and naturally progress through:

```text
See current research
        ↓
Understand what needs attention
        ↓
Take an action
        ↓
Record / explore / analyze
        ↓
Receive useful AI assistance
        ↓
Return to research context
```

The interface should continuously preserve this context.

The ultimate UX principle is:

> **The application should help the researcher think and work, not make the researcher think about how to use the application.**

Every frontend decision should be evaluated against this principle.
