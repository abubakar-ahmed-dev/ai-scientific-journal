# User Guide

**Last verified:** 2026-09-11  
**Product:** AI Scientific Journal

AI Scientific Journal is a private workspace for recording observations and turning them into better research questions. You can use it for field notes, lab-style records, nature observations, class projects, hobby research, or ordinary journal notes that you may want to revisit later.

This guide explains what you can do in the app in plain language.

## Table of Contents

1. [The Big Idea](#the-big-idea)
2. [Sign In and Start](#sign-in-and-start)
3. [Dashboard](#dashboard)
4. [Where Things Live](#where-things-live)
5. [Observations](#observations)
6. [Projects](#projects)
7. [Research Tasks](#research-tasks)
8. [AI Chat](#ai-chat)
9. [Ask My Journal](#ask-my-journal)
10. [AI Analyses](#ai-analyses)
11. [Research Map](#research-map)
12. [Settings](#settings)
13. [Everyday Workflows](#everyday-workflows)
14. [Help and Troubleshooting](#help-and-troubleshooting)

## The Big Idea

Most journals only store what you write. AI Scientific Journal helps you come back to those records, ask questions about them, compare them, and plan what to investigate next.

The app follows this rhythm:

```text
Observe -> Record -> Analyze -> Organize -> Discover -> Investigate Further
```

The most important record is an **Observation**. An observation can be a full scientific note with measurements, location, tags, and evidence, or it can be a simple journal entry with just a title and description.

The app is built around four promises:

| Promise | What it means for you |
| --- | --- |
| Authenticity | Your own observations remain the original record. |
| Usability | You can start quickly and add detail only when it helps. |
| Stability | If AI or media loading fails, your saved journal records should remain safe. |
| Security | Your journal is private to your signed-in account. |

AI can help summarize, suggest, and answer questions, but it does not become the truth of your journal. Your writing, notes, measurements, and uploaded evidence stay separate from AI-generated content.

Screenshot placeholder: product landing page.

## Sign In and Start

Use the Google sign-in button on the landing page. Once you are signed in, you will see your private workspace.

If this is your first time using the app, the dashboard gives you a few simple ways to begin:

- **Record First Observation** opens the full observation form.
- **Create Project** lets you make an optional research project.
- **Quick Capture** lets you save a short draft with only a title and description.
- **Open Full Form** carries what you typed in Quick Capture into the larger form without saving it first.
- **Workspace Ready** shows helpful setup checks.
- Feature previews show what the app can do once your journal has more records.

You do not need to create a project first. You can record observations now and organize them later.

Screenshot placeholder: first signed-in dashboard.

## Dashboard

The dashboard is your home base. It helps you continue from where you left off.

For an active journal, the dashboard shows:

- A greeting and **New Observation** button.
- Your current or latest research activity.
- A suggested next step. This may come from a recent AI analysis, or it may be a simple app suggestion based on your current records.
- Shortcuts to Ask Journal, Research Map, AI Chat, and Projects.
- Counts for observations, active projects, open tasks, and AI analyses.
- Recent observations.
- Current tasks.
- Recent activity from observations, completed tasks, and analyses.

If you see a plus sign beside a count, it means the app is showing a page of recent items and there may be more.

If one part of the dashboard fails to load, the app shows a retry option for that part. It should not pretend failed data is empty.

Screenshot placeholder: returning-user dashboard.

## Where Things Live

The sidebar is the quickest way to move around:

| Sidebar item | Use it when you want to... |
| --- | --- |
| Dashboard | Resume work and see recent activity. |
| Observations | Browse, search, create, and open journal records. |
| Research Map | See observations that have displayable locations. |
| Ask Journal | Ask questions across your own observation history. |
| Tasks | Track follow-up investigations. |
| Projects | Organize related records into research efforts. |
| AI Chat | Have a longer back-and-forth conversation with the assistant. |
| Settings | Update your profile and journal defaults. |

You can also open the command palette with Ctrl+K or Cmd+K and search for pages, actions, or recent observations.

Screenshot placeholder: sidebar and command palette.

## Observations

Observations are the heart of the app. They can be simple or detailed.

An observation can include:

- Title.
- Description.
- Observed date and time.
- Project, if you want to file it somewhere.
- Status: Observed, Draft, or Archived.
- Your own hypothesis.
- Extra notes.
- Measurements, such as temperature, count, size, duration, or any numeric reading.
- Tags.
- Location.
- Evidence media after the observation exists.

### Observation List

The Observations page lets you browse your records. You can search, filter by project or status, and sort by recently updated records or observed date.

The list is paginated: the header shows how many records match (for example, "Showing 1–10 of 55 observations"), and Previous / Next buttons move between pages. During a text search the exact total is not shown, because matching happens while reading your records — the header then shows the current page number instead.

Observation cards are clickable. They show useful hints such as tags, status, measurements, media count, and location label when available.

Screenshot placeholder: observations list.

### Create an Observation

Use **New Observation** from the dashboard, sidebar, or command palette.

Only title and description are required. Everything else is optional.

The advanced fields section includes:

- **Project:** file the observation under a project or leave it unfiled.
- **Status:** save as Observed or Draft.
- **Observed Date/Time:** when the event happened.
- **User Hypothesis:** your own explanation or idea.
- **Supplementary Notes:** extra context, equipment notes, conditions, or reminders.
- **Measurements:** add rows with a name, value, unit, and notes.
- **Location:** attach coordinates manually or with your device location.
- **Tags:** add free-form labels that make records easier to find later.

If you turn location on, enter both latitude and longitude or turn location off again. A location with only one coordinate cannot be saved.

Location privacy choices:

| Choice | What you will see |
| --- | --- |
| Exact | The map can show the recorded point. |
| Approximate | The map shows a less precise area instead of the exact point. |
| Hidden | The location is kept out of map display and AI context. |

Evidence files are attached from the observation detail page after the observation has been saved.

Screenshot placeholder: observation form.

### Quick Capture

Quick Capture is for moments when you want to save the idea before it slips away.

You can:

- Enter a title and description.
- Save it as a draft.
- Continue editing in the full form right away.
- Or open the full form with your typed text carried over before saving.

Screenshot placeholder: Quick Capture.

### Edit and Version History

When you edit an observation, the app keeps a version snapshot. Later, you can open version history from the observation detail page and compare an older snapshot with the current record.

If the same observation was changed in another session, the app may show a version conflict. Reload the record, review the latest version, and then apply your change again.

Screenshot placeholder: version history and comparison.

### Observation Detail

The detail page is where one observation comes together.

You can review:

- Description.
- Your hypothesis.
- Notes.
- Measurements.
- Tags.
- Location display.
- Evidence media.
- Related observations.
- AI analyses connected to this observation.
- Version history.

You can also:

- Edit the observation.
- Run **Analyze with AI**.
- Run **Suggest Next Steps**.
- Start **Discuss with AI** for an observation-linked chat.
- Upload, view, caption, or delete evidence media.
- Delete the observation after confirming.

Archiving is done by editing the observation status. Deleting an observation also deletes its media and version snapshots. AI analyses that already referenced it are kept as historical AI records and show the source as deleted when needed.

Screenshot placeholder: observation detail and media gallery.

## Projects

Projects are optional folders for related research. They are useful when several observations, tasks, or conversations belong to the same effort.

On the Projects page you can:

- Create a project.
- Search projects.
- Filter by All, Active, Completed, or Archived.
- Open a project detail page.

A project can have a title, research field, tags, description, and status.

The project detail page currently focuses on linked observations and linked research tasks. You can add an observation to the project from there, edit project details, or delete the project.

Deleting a project does not delete your observations or tasks. They become unfiled so you can keep using them. AI analyses keep their historical project reference.

Screenshot placeholder: projects page and project detail page.

## Research Tasks

Research tasks help you turn ideas into follow-up work.

You can create tasks yourself, or you can accept a suggested next step from an AI analysis. AI suggestions do not become tasks until you choose to accept them.

Task statuses are:

- Suggested
- Planned
- In Progress
- Completed
- Dismissed

On the Tasks page you can:

- Filter tasks by status.
- Create a task.
- Edit a task.
- Move a task to a project or back to Unfiled.
- Change its status.
- Delete it.

The dashboard updates from your task list, so completed and open work stay visible in your workspace.

Screenshot placeholder: tasks page.

## AI Chat

AI Chat is for conversation. Use it when you want to think through an observation, brainstorm possible explanations, or ask follow-up questions.

A chat can be:

- General.
- Linked to an observation.
- Linked to a project.
- Linked to an AI analysis.

The chat header shows the context when a chat is linked. Assistant replies can show the model name, response time, and token count when that information is available.

Press Enter to send. Use Shift+Enter for a new line.

If sending fails, your text is preserved and you can retry AI generation. Archived conversations are read-only until you unarchive them.

Screenshot placeholder: AI Chat.

## Ask My Journal

Ask My Journal is for questions about your saved observations.

Examples:

- "Have I recorded this before?"
- "What did I observe near the pond?"
- "Which observations mention cold weather?"
- "What patterns appear in my feeding-time records?"

The app looks through your own records, chooses relevant observations, and asks AI to answer from that evidence. A good answer may include:

- A clear response.
- Supporting evidence cards.
- Links back to source observations.
- Uncertainties or caveats.
- Model and prompt information.

Sometimes the best answer is that your journal does not contain enough evidence yet. In that case, the app says so instead of inventing a confident answer.

Screenshot placeholder: Ask My Journal with evidence.
Screenshot placeholder: Ask My Journal with insufficient evidence.

## AI Analyses

AI analyses are structured AI outputs attached to your research. They are separate from your observations.

The app can generate:

- Summaries.
- Observation analyses.
- Research suggestions.

An analysis can include:

- Summary.
- Key findings.
- Possible hypotheses with confidence labels.
- Uncertainties.
- Suggested questions.
- Suggested next steps.
- Links to supporting observations.

Suggested next steps can be accepted as research tasks. You stay in control of whether a suggestion becomes part of your task list.

Running AI again creates a new analysis. It does not rewrite your previous analysis or change what you originally observed.

Screenshot placeholder: AI analysis viewer.

## Research Map

The Research Map shows observations with locations that are safe to display.

You can filter the map by:

- Project.
- Tag.
- Date range.

Map markers open details and link back to the observation page.

Hidden locations are not shown on the map. Approximate locations are shown less precisely. Exact locations are shown as recorded.

Screenshot placeholder: research map.

## Settings

Settings is where you manage your profile and journal defaults.

You can:

- Change your display name.
- Upload an avatar image and preview it before saving.
- Remove your avatar.
- Choose whether new observations should start with location capture enabled.
- Save or discard unsaved changes.

Sign-out is available from the app header and mobile menu. The app asks for confirmation because unsaved changes on the current page may be lost.

The current Settings page does not show a self-service account deletion button. You can delete individual observations, projects, media, conversations, and tasks from their own screens where supported.

Screenshot placeholder: settings page.

## Everyday Workflows

### Record, Analyze, Then Plan

1. Create an observation.
2. Add optional details like measurements, tags, location, and evidence.
3. Open the observation detail page.
4. Select **Analyze with AI**.
5. Review the findings, hypotheses, and uncertainties.
6. Select **Suggest Next Steps** if you want follow-up ideas.
7. Accept a useful suggestion as a task.
8. Move the task through Planned, In Progress, and Completed.

### Ask, Check Evidence, Then Discuss

1. Open Ask Journal.
2. Ask a question about your records.
3. Read the answer and open the evidence links.
4. From an observation, start **Discuss with AI** if you want a deeper conversation.

### Organize After Recording

1. Record observations without choosing a project.
2. Create a project once a theme becomes clear.
3. Edit observations or tasks to file them under that project.
4. Use the project detail page and dashboard to continue the work.

### Draft First, Finish Later

1. Use Quick Capture from the dashboard.
2. Save a draft or open the full form.
3. Add fields when you have time.
4. Change the status to Observed when the record is ready.

## Help and Troubleshooting

### Useful Limits

| Area | Limit |
| --- | --- |
| Chat message | 8,000 characters |
| Ask Journal question | 2,000 characters |
| Observation description | 20,000 characters |
| Tags | Up to 20 |
| Measurements | Up to 50 per observation |
| Image upload | Up to 10 MB |
| Audio upload | Up to 25 MB |
| Video upload | Up to 100 MB |

### Common Questions

| Question | Answer |
| --- | --- |
| Do I need a project? | No. Projects are optional. Start with observations and organize later. |
| Can AI change my observation? | No. AI output stays separate from your own record. |
| Why did Ask Journal say there was not enough evidence? | The app did not find enough matching observations to answer safely. Add more records or ask a more specific question. |
| Why did a suggestion appear? | It may come from an AI analysis, or from a simple dashboard rule such as reminding you to analyze a recent observation. |
| What happens to AI analyses if I delete an observation? | They remain as historical AI records, but the deleted source is shown as missing. |
| Why did media stop loading? | Media links are temporary. Retry or refresh to request fresh access. |
| What browsers should work? | Use a modern browser with JavaScript enabled. Google sign-in may need popups allowed for the site. |

### Quick Fixes

| Problem | Try this |
| --- | --- |
| Sign-in popup closes | Allow popups for the app and try again. |
| A page keeps loading | Refresh, then use the page's retry button if one appears. |
| Dashboard section failed | Use **Retry Failed Sections** or the section retry button. |
| AI request failed | Retry later. Your saved observations and typed chat text should remain available. |
| Media is blocked or expired | Refresh the page or retry loading the media. |
| Location is wrong or denied | Enter coordinates manually or turn location off. |
| Edit conflict appears | Reload the observation before saving again. |

### Glossary

| Word | Meaning |
| --- | --- |
| Observation | Your main journal record. It can be simple or scientific. |
| Project | An optional way to group related work. |
| Analysis | AI-generated research output, kept separate from your record. |
| Research task | Follow-up work you create or accept from an AI suggestion. |
| Evidence | Media attached to an observation, such as photos, audio, or video. |
| Grounded answer | An answer based on your saved observations. |
| Context | The observation, project, analysis, or chat history the assistant is using. |

## Not Yet Included

Some ideas are planned or reserved for later, but are not current user workflows:

- Voice journaling.
- AI auto-tagging.
- Pattern reports.
- Offline capture and sync.
- Hypothesis-only or classification-only AI generation.
- A self-service account deletion screen.

