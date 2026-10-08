# 002 · Implementations are split into backends and frontends

**Status.** Accepted · 2026-10-01

## Decision

`src/` has two families instead of one folder per full stack:

- `src/backends/` — `django` (DRF), `fastapi`, `firebase`, `supabase`
- `src/frontends/` — `web` (Next.js), `flutter`, `streamlit`

Supabase and Firebase stay self-hosted (ADR 001).

## Why

- The product and its API are the same across stacks, so backend and UI choices can be compared independently.
- It gives more combinations to compare (for example Next.js on FastAPI, Flutter on Supabase) without duplicating every folder.

## Consequences

- Supersedes the one-folder-per-stack table in `README.md` (`src/fastapi/`, `src/django/`, `src/streamlit/`, `src/supabase/`, `src/firebase/`). Streamlit is now a frontend, and the earlier "each folder runs on its own" promise becomes "each folder runs on its own, and a frontend needs a backend".
- Firebase and Supabase expose their own APIs, not the Django/FastAPI one. A shared API contract, and which frontend talks to which backend, is still to be decided (backlog). *Decided in [ADR 003](003-one-rest-contract-for-every-backend.md): one REST contract.*
- Shared logic (`src/core/`) is deferred.
