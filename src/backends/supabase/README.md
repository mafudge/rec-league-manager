# Supabase backend, self-hosted (stub)

The open-source Supabase stack (Postgres, Auth, REST, Studio…) run locally with Docker Compose. **No Supabase cloud account, project or API key is used** (see [ADR 001](../../../docs/decisions/001-self-hosted-supabase-and-firebase.md)).

`docker/` is a copy of upstream's [`docker/`](https://github.com/supabase/supabase/tree/master/docker) folder at commit `be976bec49da3c92d030a526e7916688449a2638` (2026-10-01), minus its `dev/` and `tests/`. Image versions are pinned in `docker/docker-compose.yml`.

## Requirements
Docker with the Compose plugin, about 3 GB of images.

## Run
```bash
./start.sh      # first run creates docker/.env, generates secrets, moves the gateway to port 54321;
                # every run turns on email auto-confirm and applies migrations/*.sql
./test.sh       # unit tests for the Edge Function (Deno in Docker; needs no running stack)
./smoke.sh      # prints "rest ok", "auth ok" and "api ok"
../../contract-test.sh http://localhost:54321/functions/v1
```
- API gateway: http://localhost:54321 (`/rest/v1`, `/auth/v1`, `/functions/v1`)
- **Our REST API** (ADR 003): `API_URL=http://localhost:54321/functions/v1`. It is the Edge Function `docker/volumes/functions/api/index.ts`; after editing it, `docker restart supabase-edge-functions`. Upstream's `docker/.gitignore` ignores every function folder, so ours is listed there by name.
- Studio (dashboard): http://localhost:54321, login from `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` in `docker/.env`
- Stop: `cd docker && docker compose down`; to wipe the data also delete `docker/volumes/db/data`

`docker/.env` holds the generated secrets and is git-ignored. Never commit it.

## Test
`./test.sh` runs the function's Deno unit tests (`docker/volumes/functions/api/*_test.ts`) in the `denoland/deno:2.1.4` image, so nothing is installed on the host. `./smoke.sh` and `../../contract-test.sh http://localhost:54321/functions/v1` run against a running stack; `CONTRACT_UPTO=accounts` checks only the sections built so far.

## Accounts
Sign-up and sign-in go through Supabase Auth (GoTrue); the function maps its answers to the contract's statuses and messages and never passes its bodies through. `start.sh` sets `ENABLE_EMAIL_AUTOCONFIRM=true` in `docker/.env` (there is no mail server, so nobody could confirm a sign-up); leave `FUNCTIONS_VERIFY_JWT=false`, since the function checks tokens itself. GoTrue refresh tokens are single-use: always use the newest `refresh_token` (the web client does, and `contract-test.sh` does).

## TODO
- [x] Serve the shared REST contract from an Edge Function (ADR 003); see [`src/README.md`](../../README.md)
- [ ] `migrations/0001_init.sql`: leagues, entrants, games, scores with row-level security
- [x] Organizer sign-in with email + password (US01); the stack has no real mail server, so no magic links
- [ ] Standings computed on read, e.g. a Postgres view or function (US06)
- [ ] Public read-only access for the anonymous role (US07)
- [ ] Reachable from a phone on the LAN: set `SUPABASE_PUBLIC_URL` and `API_EXTERNAL_URL` in `docker/.env` to the machine's address
- [ ] Apply migrations automatically on start
