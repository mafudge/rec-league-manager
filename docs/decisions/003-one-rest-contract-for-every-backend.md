# 003 · Every backend serves one REST contract

**Status.** Accepted · 2026-10-08

## Decision

Every backend in `src/backends/` serves the same JSON routes under `{API_URL}/api/...`. A frontend knows only `API_URL`; it never knows which backend it is talking to.

| Backend | How it serves `/api/...` | `API_URL` |
|---|---|---|
| `fastapi` | FastAPI routes | `http://localhost:8000` |
| `django` | DRF views | `http://localhost:8001` |
| `supabase` | An Edge Function named `api` (`docker/volumes/functions/api/`) | `http://localhost:54321/functions/v1` |
| `firebase` | A Cloud Function named `api`, reached through a Hosting rewrite of `/api/**` | `http://localhost:5000` |

The first routes are `GET /api/health` → `200 {"status":"ok"}` and `GET /api/backend` → `200 {"backend":"<name>"}`, where the name is `fastapi`, `django`, `supabase` or `firebase`. Each frontend's smoke screen says "Hello from <name>", which shows at a glance which backend answered. Every route allows cross-origin requests, because the web and Flutter frontends run in a browser on a different port. `src/contract-test.sh` checks a running backend against the contract.

## Why

- One client per frontend instead of one per backend: 3 clients, not 4 × 3 = 12 adapters to keep in step.
- Streamlit has no official Firebase client SDK, so an adapter approach would have made it the odd one out.
- The contract is one test that every backend must pass, which keeps the comparison between backends fair (ADR 002).
- PRD §5: "This document has to be true for every implementation under `src/`." Rules like "standings are derived, never stored" are then enforced in one place per backend, not in every frontend.

## Consequences

- Supabase and Firebase are used as platforms we write server code on (Edge Functions in Deno, Cloud Functions in Node), not as databases the browser talks to directly through supabase-js or the Firebase SDK. This supersedes ADR 001's "Managed back end means … no server code of our own"; the CP-M3 comparison should say so.
- Row-level security (Supabase) and `firestore.rules` (Firebase) become a second line of defence, not the only one, because the functions do the writes.
- Sign-in (US01) still needs its own decision: each backend issues a token in its own way, and the contract has to say what the frontend sends back.
- Considered and rejected: an adapter per backend in every frontend, each using that backend's own client SDK.
