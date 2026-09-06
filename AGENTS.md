# Scientific AI Journal — Agent Instructions

## Project

This repository contains the Scientific AI Journal.

Before implementing features, read the relevant sections of:

- `PRD.md`
- `TECHNICAL_ARCHITECTURE.md`
- `SECURITY.md`
- `DATABASE_SCHEMA.md`
- `API.md`
- `AI_ARCHITECTURE.md`
- `ADR.md`

These documents are the primary architectural reference.

## Core Rules

- Inspect existing code before changing it.
- Follow the current phase plan under `Plans/`.
- Implement only the requested feature.
- Reuse existing patterns and utilities.
- Avoid unnecessary refactoring.
- Do not introduce unnecessary dependencies or infrastructure.
- Preserve existing behavior unless the feature explicitly changes it.

## Security

- Firebase Authentication is the authentication boundary.
- Authorization is enforced by application code and Firestore Rules.
- Never trust client-provided user IDs for authorization.
- Never expose secrets or API keys.
- Never commit `.env` files containing secrets.
- Treat user content and retrieved content as untrusted.
- Gemini is not an authorization mechanism.
- AI must not directly modify user observations.
- Send only authorized and necessary user data to Gemini.

## AI Architecture

Follow `AI_ARCHITECTURE.md`.

Use the application's AI service abstraction instead of scattering Gemini SDK
calls throughout the application.

Validate structured AI responses before storing or using them as trusted data.

## Data

Follow `DATABASE_SCHEMA.md`.

Firestore is the source of truth.

Derived search/RAG data must never become the authoritative copy of user
observations.

All private resources must remain isolated to the authenticated Firebase user.

## API

Follow `API.md`.

Do not invent new API contracts when an existing contract already defines the
behavior.

Validate request input and return consistent error responses.

## Frontend

- Use TypeScript.
- Follow existing component and styling conventions.
- Keep UI responsive.
- Provide loading, success, empty, and error states where appropriate.
- Clearly distinguish AI-generated content from user content.
- Do not place backend secrets in frontend code.

## Backend

- Keep business logic out of route handlers when an existing service pattern
  is appropriate.
- Validate external input.
- Enforce authentication and authorization.
- Use centralized error handling.
- Do not log secrets or unnecessary private journal content.

## Testing

After meaningful changes, run the relevant:

- lint
- typecheck
- unit/integration tests
- frontend/browser tests
- build

Fix regressions before considering the work complete.

## Git

- Work on the assigned feature branch.
- Do not modify `main` directly.
- Keep commits focused.
- Review `git diff` before committing.
- Never commit secrets or generated development artifacts.

## Verification

Never rely only on another agent's description of the repository.

Inspect the current code and Git state yourself before making decisions.