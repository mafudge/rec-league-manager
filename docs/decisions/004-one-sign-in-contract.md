# 004 · One sign-in contract, four implementations

**Status.** Accepted · 2026-10-24

## Decision

Every backend serves the same three sign-in routes, and every frontend uses them the same way. Behind the routes, each backend uses its own sign-in system.

| Route | Body | Answer |
|---|---|---|
| `POST /api/auth/signup` | `{email, password}` | `201 {token, refresh_token}` |
| `POST /api/auth/login` | `{email, password}` | `200 {token, refresh_token}`, or `401 {"error": "Email or password is incorrect"}` |
| `POST /api/auth/refresh` | `{refresh_token}` | `200 {token, refresh_token}`, or `401 {"error": "Sign in required"}` |

Every route that changes data, and every organizer read, needs `Authorization: Bearer <token>`. A missing, malformed or expired token gets `401 {"error": "Sign in required"}`. On a 401, the frontend tries one refresh and retries the request; only when the refresh fails does it send the organizer to sign in. Signing out happens in the frontend only: it forgets both tokens.

| Backend | Behind the contract |
|---|---|
| `fastapi` | bcrypt-hashed passwords in SQLite; signed JWTs (1-hour access, 30-day refresh) |
| `django` | Django's built-in `User`; a refresh token the backend issues, 1-hour access tokens |
| `supabase` | Supabase Auth (GoTrue) email/password, email autoconfirm on; the Edge Function proxies it |
| `firebase` | Auth emulator email/password; the Function verifies ID tokens and uses the secure-token refresh |

## Why

- ADR 003: a frontend knows only `API_URL`. If sign-in differed per backend, every frontend would need four sign-in paths.
- Firebase and Supabase tokens expire after an hour, and DRF tokens never do. Refresh in the contract makes all four behave alike, so an organizer stays signed in through league night on any backend.
- Four implementations of one contract are the comparison this project exists to show: written by hand (FastAPI), built in (Django), and a platform's auth service (Supabase, Firebase).

## Consequences

- Supabase and Firebase sign-in go through our server function, not their client SDKs in the browser.
- Considered and rejected: **Sign in with Google.** US01 says email and password, and Google sign-in would need every student to register a Google Cloud OAuth client, undoing ADR 001's "no Google account". It's on the backlog for a later release.
- Not in v0.2.0: password reset (US14 on the backlog; it needs email) and server-side token revocation.
