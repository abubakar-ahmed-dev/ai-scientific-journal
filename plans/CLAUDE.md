# Implementation Phase Instructions

This directory contains implementation plans for the Scientific AI Journal.

## Before Starting

Read:

1. The relevant `plan.md`.
2. The relevant sections of `PRD.md`.
3. The relevant architecture/security/API/database documentation.
4. `ADR.md` when architectural decisions are involved.
5. The current progress file for the phase.

Then inspect the existing implementation.

## Work Scope

- Implement only the current phase/feature.
- Do not start future phases.
- Do not redesign unrelated parts of the application.
- Avoid unnecessary refactoring.
- Preserve existing functionality.

## During Implementation

Before changing a file:

- understand its current responsibility
- check how it is used
- follow existing project patterns

When introducing a new dependency, service, API, database structure, or
external integration, verify that it is consistent with the project
architecture before implementing it.

## Testing

Run the tests appropriate for the change.

Frontend changes should normally include:

- lint
- typecheck
- relevant tests
- browser/Playwright testing when user-facing behavior changes

Backend changes should normally include:

- lint
- typecheck
- unit/integration/API tests

Infrastructure or security changes should include the relevant security or
deployment validation.

## Progress Log

Maintain the phase progress file.

Keep entries concise.

Record:

- implementation completed
- files changed
- validation performed
- issues discovered
- important decisions

Update existing entries when correcting previous work instead of creating
unnecessary duplicate entries.

## Git

Only commit work that belongs to the current feature.

Before committing:

1. Check `git status`.
2. Review `git diff`.
3. Run required validation.
4. Confirm no secrets or generated artifacts are included.
5. Commit with a meaningful message.

Never force-push shared branches.

## Completion

A phase is complete only when:

- planned implementation is complete
- relevant tests pass
- required validation has been performed
- known issues are resolved or explicitly documented
- progress documentation is updated
- final Git diff is reviewed