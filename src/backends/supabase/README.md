# Supabase backend, self-hosted (stub)

The open-source Supabase stack (Postgres, Auth, REST, Studio…) run locally with Docker Compose. **No Supabase cloud account, project or API key is used** (see [ADR 001](../../../docs/decisions/001-self-hosted-supabase-and-firebase.md)).

`docker/` is a copy of upstream's [`docker/`](https://github.com/supabase/supabase/tree/master/docker) folder at commit `be976bec49da3c92d030a526e7916688449a2638` (2026-10-01), minus its `dev/` and `tests/`. Image versions are pinned in `docker/docker-compose.yml`.

## Requirements
Docker with the Compose plugin, about 3 GB of images.

## Run
```bash
./start.sh      # first run creates docker/.env, generates secrets, moves the gateway to port 54321
./smoke.sh      # prints "rest ok" and "auth ok"
```
- API gateway: http://localhost:54321 (`/rest/v1`, `/auth/v1`)
- Studio (dashboard): http://localhost:54321, login from `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` in `docker/.env`
- Stop: `cd docker && docker compose down`; to wipe the data also delete `docker/volumes/db/data`

`docker/.env` holds the generated secrets and is git-ignored. Never commit it.

## Test
`./smoke.sh` against a running stack.

## TODO
- [ ] `migrations/0001_init.sql`: leagues, entrants, games, scores with row-level security
- [ ] Organizer sign-in with email + password (US01); the stack has no real mail server, so no magic links
- [ ] Standings computed on read, e.g. a Postgres view or function (US06)
- [ ] Public read-only access for the anonymous role (US07)
- [ ] Reachable from a phone on the LAN: set `SUPABASE_PUBLIC_URL` and `API_EXTERNAL_URL` in `docker/.env` to the machine's address
- [ ] Apply migrations automatically on start
