# Scientific AI Journal — Claude Instructions

## Project Context

This repository contains the Scientific AI Journal, a personal scientific
observation and research assistant.

The canonical product and architecture decisions are documented in:

- `PRD.md`
- `TECHNICAL_ARCHITECTURE.md`
- `SECURITY.md`
- `DATABASE_SCHEMA.md`
- `API.md`
- `AI_ARCHITECTURE.md`
- `TESTING.md`
- `AI_EVALUATION.md`
- `OBSERVABILITY.md`
- `ADR.md`

Read the relevant documentation before implementing a feature.

## Source of Truth

Documentation and existing code together define the current system.

Do not invent architecture, API contracts, database structures, or security
behavior when they are already defined in the repository.

When documentation conflicts with implementation, stop and identify the
conflict before making a major architectural change.

`ADR.md` contains accepted architectural decisions. Do not casually reverse
an accepted decision.

## Implementation Rules

- Implement only the requested feature or current phase.
- Inspect existing code before modifying it.
- Reuse existing utilities, services, types, and patterns.
- Avoid unnecessary refactoring.
- Do not introduce new infrastructure or dependencies without a clear need.
- Keep frontend and backend responsibilities separated.
- Keep configuration centralized.
- Never hardcode secrets or credentials.
- Preserve existing functionality unless the plan explicitly changes it.

## Security

- Authentication must use Firebase Authentication.
- Authorization must be enforced by application code and Firestore Security
  Rules where applicable.
- Never trust a client-provided user ID for authorization.
- Never expose secrets, API keys, tokens, or private journal data.
- Treat user content and retrieved content as untrusted input.
- Gemini must never be treated as an authorization boundary.
- AI must not directly mutate user observations.
- Send Gemini only the minimum authorized context required for an operation.

## AI

Use the AI architecture defined in `AI_ARCHITECTURE.md`.

Application code should depend on the AI service abstraction rather than
calling the Gemini SDK throughout the codebase.

AI-generated content must remain distinguishable from user-generated content.

Structured AI output must be validated before being treated as trusted
application data.

## Validation

After implementation, run the checks relevant to the changed area.

At minimum, use:

- lint
- TypeScript/type checking
- relevant unit/integration tests
- frontend/browser tests when UI behavior changes
- build validation when applicable

Do not claim a feature works without actually validating it.

## Git

- Work only on the assigned feature branch.
- Do not work directly on `main`.
- Keep commits focused on the current feature.
- Review `git diff` before committing.
- Never commit secrets, credentials, generated artifacts, or local environment
  files.
- Do not reset or discard another agent's work.


## Plans and Progress

Implementation should follow the relevant plan under `Plans/`.

Keep progress documentation concise.

Record:

- what was changed
- files/components affected
- important decisions
- validation performed
- remaining issues

Do not create duplicate logs for the same work.

## Do Not Trust Previous Claims

Verify the repository yourself.

Do not assume that a previous agent:

- implemented a feature correctly
- ran tests successfully
- committed all changes
- followed the architecture
- updated documentation correctly

Use the actual repository, Git state, tests, and execution results as the
source of truth.