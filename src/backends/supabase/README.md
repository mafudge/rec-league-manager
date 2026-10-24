# Supabase backend, self-hosted

The open-source Supabase stack (Postgres, Auth, REST, Studio…) run locally with Docker Compose. **No Supabase cloud account, project or API key is used** (see [ADR 001](../../../docs/decisions/001-self-hosted-supabase-and-firebase.md)).

`docker/` is a copy of upstream's [`docker/`](https://github.com/supabase/supabase/tree/master/docker) folder at commit `be976bec49da3c92d030a526e7916688449a2638` (2026-10-01), minus its `dev/` and `tests/`. Image versions are pinned in `docker/docker-compose.yml`.

## Requirements
Docker with the Compose plugin, about 3 GB of images.

## Run
```bash
./start.sh      # first run creates docker/.env, generates secrets, moves the gateway to port 54321;
                # every run turns on email auto-confirm and applies migrations/*.sql
./test.sh       # unit tests for the Edge Function (Deno in Docker; needs no running stack)
LIVE_SUPABASE=1 ./test.sh   # also proves row-level security against the running stack
./smoke.sh      # prints "rest ok", "auth ok" and "api ok"
../../contract-test.sh http://localhost:54321/functions/v1
```
- API gateway: http://localhost:54321 (`/rest/v1`, `/auth/v1`, `/functions/v1`)
- **Our REST API** (ADR 003): `API_URL=http://localhost:54321/functions/v1`. It is the Edge Function `docker/volumes/functions/api/index.ts`; after editing it, `docker restart supabase-edge-functions`. Upstream's `docker/.gitignore` ignores every function folder, so ours is listed there by name.
- Studio (dashboard): http://localhost:54321, login from `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` in `docker/.env`
- Stop: `cd docker && docker compose down`; to wipe the data also delete `docker/volumes/db/data`

`docker/.env` holds the generated secrets and is git-ignored. Never commit it.

## Test
`./test.sh` runs the function's Deno unit tests (`docker/volumes/functions/api/*_test.ts`) in the `denoland/deno:2.1.4` image, so nothing is installed on the host (downloaded modules are cached in the `rlm-deno-cache` Docker volume). `LIVE_SUPABASE=1 ./test.sh` also runs `live_test.ts` against the running stack: two organizers, where B's own token sent straight to PostgREST sees and changes none of A's rows and the function answers B with `404 League not found`. `./smoke.sh` and `../../contract-test.sh http://localhost:54321/functions/v1` run against a running stack; the contract test runs in full (`contract ok`); `CONTRACT_UPTO` can limit it to a section.

## Accounts
Sign-up and sign-in go through Supabase Auth (GoTrue); the function maps its answers to the contract's statuses and messages and never passes its bodies through. `start.sh` sets `ENABLE_EMAIL_AUTOCONFIRM=true` in `docker/.env` (there is no mail server, so nobody could confirm a sign-up); leave `FUNCTIONS_VERIFY_JWT=false`, since the function checks tokens itself. GoTrue refresh tokens are single-use: always use the newest `refresh_token` (the web client does, and `contract-test.sh` does).

## Leagues and entrants
`migrations/0001_init.sql` creates `leagues`, `entrants` and `games` in `public` with text ids (32 hex characters, so a malformed id is just not found) and turns **row-level security** on for all three: role `authenticated` sees and writes a league only when `organizer_id = auth.uid()`, and entrants and games only when their league is theirs. `anon` has no privileges on them. A game's `home_id` and `away_id` reference `entrants (league_id, id)` together with the game's `league_id`, because foreign-key checks bypass RLS: a game can only name entrants of its own league. The function queries PostgREST with supabase-js as the organizer (their own access token, `db.ts` `userClient`), so ownership is enforced by Postgres, not by a filter in our code; the service-role client (`serviceClient`) is only for the public page (US07). `start.sh` applies the migration on every start; it is safe to re-run. Validation (order, messages, the 52-entrant cap after the duplicate check) is in `leagues.ts`, matching FastAPI.

## Standings and the public page
Standings are computed in the Edge Function on every request (`standings.ts`, a port of FastAPI's `standings.py`); no view or table stores them. `GET /api/leagues/{id}/standings` queries as the organizer, so RLS is the ownership check. `GET /api/public/{slug}` needs no token and ignores any `Authorization` header: it is the one route using the service-role key (RLS hides other organizers' leagues from `anon` by design), the key never leaves the function, and the answer leaves out the league's `id`. Migrations (`migrations/*.sql`) are applied by `start.sh` on every start.

## TODO
- [x] Serve the shared REST contract from an Edge Function (ADR 003); see [`src/README.md`](../../README.md)
- [x] `migrations/0001_init.sql`: leagues, entrants, games, scores with row-level security
- [x] Organizer sign-in with email + password (US01); the stack has no real mail server, so no magic links
- [x] Standings computed on read, in the Edge Function (`standings.ts`; US06)
- [x] Public read-only page (US07): `GET /api/public/{slug}` reads with the service-role client by slug and returns no `id`
- [ ] Reachable from a phone on the LAN: set `SUPABASE_PUBLIC_URL` and `API_EXTERNAL_URL` in `docker/.env` to the machine's address
- [x] Apply migrations automatically on start
