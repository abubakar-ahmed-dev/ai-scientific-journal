# Settings Page Refactor — Plan (2026-09-07)

Status: **PROPOSAL — awaiting review. No code written yet.**
Branch will be `refactor/settings-page` off `dev` when approved.

## 1. Current-state audit (verified in code, 2026-09-07)

`frontend/src/pages/SettingsPage.tsx` + `backend/src/routes/users.ts` +
`backend/src/repository/userRepository.ts`.

| Shown in UI today | Reality | Verdict |
|---|---|---|
| Firebase UID | Raw 28-char ID; meaningless to researchers, mild info-disclosure smell | **Remove** |
| Email | From `/me`; correct | Keep |
| Role `user (server-managed)` / Status `active` | Every account is `role=user, active`; zero information | **Remove** (kept in API, hidden in UI) |
| Display Name | Saves to Firestore `/me` — but the header avatar/name (`Layout.tsx:161,307`) reads `currentUser` from **Firebase Auth**, which is never updated → name change never shows up anywhere | **Broken — fix** |
| Photo URL (HTTPS) | Saves to Firestore; **never rendered anywhere** in the app. Paste-a-URL is also poor UX | **Replace with avatar upload** |
| Theme (System/Light/Dark) | No dark theme exists anywhere in the app; setting is stored and silently ignored | **Remove** (per review: not building a dark theme now) |
| Timezone (free-text) | Stored, never read. All timestamps already render in the browser's own locale — a manual timezone would fight that | **Remove from UI** (field stays in API/schema, no migration) |
| "Enable geographic location capture by default" checkbox | Stored, never read — the observation form has no location-capture default | **Dead — wire it up for real** |
| "Show AI suggestions and insights" checkbox | Stored, never read. Audited the app's AI surfaces (2026-09-07): the only genuinely proactive surface is the dashboard "AI suggestion" panel — analysis sections are results of an explicit user action, and Ask/chat/Analyze are user-initiated tools. A toggle controlling one dashboard panel is not worth a setting | **Remove** (field stays in API/schema, no migration) |
| Data-safety note | Accurate | Keep, restyle |

## 2. Goals

- Show only settings that actually do something.
- Fix the two genuinely broken things: display-name propagation, no real avatar.
- researcher-grade profile header (avatar, name, email, member-since) instead of a form dump.
- Dirty-state save: button disabled until something changed; unsaved-changes guard on navigation.
- Remove raw UID from the UI.

## 3. Non-goals (explicit)

- No dark theme (no time to design one; the toggle would be another lie).
- No account deletion (full cascade is a separate feature with its own security review).
- No data export (valuable, but new endpoint + format decisions — deferred, see §8).
- No timezone setting (browser locale already correct).
- No changes to role/status model.

## 4. Target design

```
┌──────────────────────────────────────────────────────────┐
│  Settings                                                 │
│                                                           │
│  ┌─ Profile ────────────────────────────────────────────┐ │
│  │  (avatar 64px)  olive.algae.261        [Change]      │ │
│  │   olive.algae.261@example.com          [Remove]      │ │
│  │   Member since Aug 2026                               │ │
│  │                                                       │ │
│  │   Display name                                        │ │
│  │   [ olive.algae.261                    ]              │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─ Journal defaults ───────────────────────────────────┐ │
│  │  [toggle] Capture location by default                │ │
│  │    New observations start with the location panel    │ │
│  │    open and GPS capture attempted on save.           │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌─ Your data ──────────────────────────────────────────┐ │
│  │  Observations, projects, and media are stored        │ │
│  │  privately under your account…                       │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                           │
│            [ Discard ]  [ Save changes ]  (dirty-state)   │
└──────────────────────────────────────────────────────────┘
```

UX decisions:

- **Avatar**: 64px circle with instant local preview on select. Buttons: Change /
  Remove. Upload happens on Save (single save model, one server call for
  name + toggles + avatar file). Fallback = first letter (existing pattern).
- **Toggle switches** (not checkboxes) with one-line effect descriptions — the
  user should never wonder what a setting does.
- **Dirty-state**: `Save changes` disabled until form ≠ server state; `Discard`
  resets; `beforeunload` + react-router blocker guard against losing edits.
- **Success/toast**: reuse existing Toast provider instead of the inline banner.
- **No UID anywhere.** Account identity = email + member-since.

## 5. Work items

### Backend (new: `PATCH /api/v1/me/avatar`)

| Item | Detail | Effort |
|---|---|---|
| Avatar upload endpoint | multipart `file`; image-only (jpeg/png/webp via existing magic-byte check in `mediaSchema.ts`), ≤ 2 MB; streams to GCS `users/{uid}/avatar/avatar` (fixed name → overwrite = replace) via `IStorageService.uploadStream`; rate-limited (mediaRateLimiter) | Medium |
| Schema/doc | `users/{uid}` gains `avatarPath: string \| null` (DATABASE_SCHEMA §5.1 + `userRepository` + `userSchema`); `photoURL` field stays for API compat but UI stops using it | Small |
| `/me` response | `GET /me` returns `avatarUrl` = fresh short-lived signed URL when `avatarPath` set (reuse `getSignedReadUrl`; emulator branch already handled) | Small |
| Avatar remove | `DELETE /api/v1/me/avatar` — nulls field + deletes object | Small |
| Display-name propagation fix | `PATCH /me` also calls Firebase Admin `auth.updateUser(uid, { displayName })` so the Auth-derived header picks the name up on next token refresh (also aligns the Firebase console). Failure of this secondary write logs but does not fail the request (Firestore is source of truth) | Small |

### Frontend

| Item | Detail | Effort |
|---|---|---|
| `SettingsPage` rewrite | Per §4; react-query for `/me`; single dirty-tracked form; avatar file input with preview | Medium |
| `useProfile` hook (`frontend/src/lib/useProfile.ts`) | Shared react-query `/me` wrapper exposing `{ displayName, avatarUrl, email, memberSince, preferences }`; `Layout.tsx` header + mobile drawer switch to it (falls back to Auth email while loading) — display name + avatar then actually appear in the header | Small |
| Wire `locationEnabled` | `ObservationFormPage` reads preference: when true, the location panel starts expanded and GPS capture is attempted once on mount (new observation only) | Small |
| Theme / timezone / AI-toggle removal | Dropped from UI; `userSchema` untouched (fields remain optional server-side — no migration) | Trivial |

### Docs

- `API.md` §6.2: add avatar endpoints, `avatarUrl` in `/me` response, note
  displayName Auth propagation.
- `DATABASE_SCHEMA.md` §5.1: `avatarPath`.
- `TECHNICAL_ARCHITECTURE.md` only if avatar storage deserves a line next to
  ADR-016 media paths (it does — same bucket, new prefix).

## 6. Security notes

- Avatar upload: same trust level as media upload — authenticated, UID-scoped
  path, magic-byte sniffed, size-capped, streamed (no buffering).
- Signed URLs stay short-lived (existing `MEDIA_SIGNED_URL_TTL_MINUTES`);
  nothing becomes public; bucket IAM unchanged.
- `auth.updateUser` is called with the token-verified UID only (never a
  client-supplied ID), consistent with SECURITY rules.
- Emulator path works out of the box (Storage emulator branch in
  `storageService.getSignedReadUrl`).

## 7. Validation plan

- Backend: unit tests for avatar endpoint (type reject, oversize reject, happy
  path writing `avatarPath`, remove), `/me` returns `avatarUrl` (Mock + emulator),
  displayName propagation (mocked admin); full suite vs emulator.
- Frontend: SettingsPage tests (render, dirty-state, save, avatar preview,
  location toggle wired), ObservationFormPage default-location test;
  typecheck + lint; full suite.
- Manual: upload/remove avatar round-trip locally (emulators), header shows
  avatar + new name after save; prod check after next deploy.

## 8. Deferred (recorded, not planned)

| Idea | Why deferred |
|---|---|
| Data export (`GET /me/export`) | Real value, but aggregation scope + format need their own small design; settings refactor shouldn't carry it |
| Account deletion | Cascade across all collections + storage prefixes; security review warranted |
| "Sign out of all devices" (`revokeRefreshTokens`) | Nice-to-have; single-user product, low current value |
| Timezone-aware display | Browser locale already correct; a manual override adds failure modes |

## 9. Open questions for review

1. Avatar max size 2 MB and jpeg/png/webp — OK, or square-crop client-side too?
   (Recommend: no client crop in v1 — accept any aspect ratio, render with
   `object-cover`.)
2. `photoURL` API field: keep as-is for compatibility (recommended) or drop in a
   breaking cleanup?
