# 001 · Supabase and Firebase implementations are fully self-hosted

**Status.** Accepted · 2026-10-01

## Decision

`src/supabase/` runs the open-source Supabase stack locally (Docker). `src/firebase/` runs the Firebase Emulator Suite (Firestore, Auth, Hosting). Neither depends on a hosted Supabase or Firebase account, API key or cloud project.

## Why

- Each implementation must "run on its own with only its own README" (see `README.md`). A cloud account breaks that: it needs sign-up, credentials and possibly billing.
- Students and graders can reproduce the comparison without accounts or cost.
- No secrets or project IDs end up in the repo.

## Consequences

- Each README must say how to download and start its local stack.
- Auth: the self-hosted stacks have no real mail service by default, so magic-link / email-link sign-in is dropped from the README table. Email + password matches `docs/backlog.md` US01.
- "Managed back end" now means the *shape* (no server code of our own), not a vendor-hosted service. The stack-decision comparison (CP-M3) should say so.
- The Firebase Emulator Suite is for development and testing, not production. This implementation shows the architecture, not a deployable setup.
- The organizer's "phone during league night" and players' no-login read access still need to work against the local stack (reachable on the LAN).
