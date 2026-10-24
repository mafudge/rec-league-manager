# Running the code

Four backends, three frontends, and **any frontend works with any backend**. Every backend serves the same REST API ([ADR 003](../docs/decisions/003-one-rest-contract-for-every-backend.md)), so a frontend only needs to know one thing: the backend's `API_URL`.

To run a pairing, start one backend, then start one frontend pointed at it. Each frontend says **"Hello from fastapi"** (or django, supabase, firebase) when it reaches its backend, and **"Can't reach the backend at …"** when it doesn't.

All commands run from the folder named in the heading. Each folder's own `README.md` has the details.

## The 12 pairings

Find your backend's row and your frontend's column. The cell is the command that starts that frontend against that backend.

| Backend ↓ · Frontend → | **web** — `src/frontends/web` | **streamlit** — `src/frontends/streamlit` | **flutter** — `src/frontends/flutter` |
|---|---|---|---|
| **fastapi** | `NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev` | `API_URL=http://localhost:8000 .venv/bin/streamlit run app.py` | `flutter run -d chrome --dart-define=API_URL=http://localhost:8000` |
| **django** | `NEXT_PUBLIC_API_URL=http://localhost:8001 npm run dev` | `API_URL=http://localhost:8001 .venv/bin/streamlit run app.py` | `flutter run -d chrome --dart-define=API_URL=http://localhost:8001` |
| **supabase** | `NEXT_PUBLIC_API_URL=http://localhost:54321/functions/v1 npm run dev` | `API_URL=http://localhost:54321/functions/v1 .venv/bin/streamlit run app.py` | `flutter run -d chrome --dart-define=API_URL=http://localhost:54321/functions/v1` |
| **firebase** | `NEXT_PUBLIC_API_URL=http://localhost:5000 npm run dev` | `API_URL=http://localhost:5000 .venv/bin/streamlit run app.py` | `flutter run -d chrome --dart-define=API_URL=http://localhost:5000` |

Then open the web app at http://localhost:3000 or Streamlit at http://localhost:8501. Flutter opens Chrome by itself.

Each backend has its own port, so all four can run at once: FastAPI 8000, Django 8001, Firebase 5000, Supabase 54321. A frontend with no `API_URL` set talks to FastAPI on 8000.

## Start a backend

Install once, then start. The check at the end of each one should print `contract ok`. If `python3 -m venv` fails, install `python3-venv` (`sudo apt install python3-venv`).

### fastapi — `src/backends/fastapi`
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # once
.venv/bin/uvicorn app.main:app --reload                              # http://localhost:8000
../../contract-test.sh http://localhost:8000                         # in a second terminal
```

### django — `src/backends/django`
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # once
.venv/bin/python manage.py migrate                                   # once
.venv/bin/python manage.py runserver                                 # http://localhost:8001
../../contract-test.sh http://localhost:8001                         # in a second terminal
```

### supabase — `src/backends/supabase`
Needs Docker with the Compose plugin; the first start downloads about 3 GB of images.
```bash
./start.sh                                                   # first run also creates docker/.env with fresh secrets
../../contract-test.sh http://localhost:54321/functions/v1   # API_URL ends in /functions/v1
cd docker && docker compose down                             # stop
```
The API is the Edge Function in `docker/volumes/functions/api/index.ts`. After you edit it, run `docker restart supabase-edge-functions`.

### firebase — `src/backends/firebase`
Needs Node 18.18+ and Java 11+. No Google account: everything runs in the emulators.
```bash
npm install                                   # once; also installs functions/
npm run emulators                             # Hosting :5000, Functions :5001, Firestore :8080, Auth :9099, UI :4100
../../contract-test.sh http://localhost:5000  # in a second terminal
```
The API is the Cloud Function in `functions/index.js`; Hosting forwards `/api/**` to it.

## Start a frontend

Install once, then use the command from the table above.

### web — `src/frontends/web`
```bash
npm install                     # once
cp .env.example .env.local      # once; NEXT_PUBLIC_API_URL here is the default backend
npm run dev                     # http://localhost:3000
```
Setting `NEXT_PUBLIC_API_URL` on the command line, as in the table, overrides `.env.local`. Restart `npm run dev` after you change it.

### streamlit — `src/frontends/streamlit`
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # once
API_URL=http://localhost:8000 .venv/bin/streamlit run app.py         # http://localhost:8501
```

### flutter — `src/frontends/flutter`
```bash
export PATH=$PATH:$HOME/.local/flutter/bin                            # if flutter is not found
flutter pub get                                                       # once
flutter run -d chrome --dart-define=API_URL=http://localhost:8000
```

## The API

Every backend serves these routes under its `API_URL`. Every response is JSON and allows any origin (CORS), because the web and Flutter apps run in a browser on a different port from the backend.

| Route | Response |
|---|---|
| `GET /api/health` | `{"status": "ok"}` |
| `GET /api/backend` | `{"backend": "fastapi"}` — or `django`, `supabase`, `firebase` |
| `GET /api/hello?name=Mike` | `{"message": "Hello Mike"}`; spaces around the name are trimmed |
| `GET /api/hello` with no name, or a blank one | `400 {"error": "Name is required"}` |
| `POST /api/auth/signup` `{email, password}` | `201 {"token", "refresh_token"}`; `400 Enter a valid email address` (no `@`), `400 Password must be at least 8 characters`, `409 An account with that email already exists`, checked in that order. Email is trimmed and lower-cased |
| `POST /api/auth/login` `{email, password}` (US01) | `200 {"token", "refresh_token"}`; `401 Email or password is incorrect` |
| `POST /api/auth/refresh` `{refresh_token}` (US01) | `200 {"token", "refresh_token"}`; `401 Sign in required` |
| 🔒 `GET /api/auth/me` (US01) | `200 {"email"}`, the signed-in organizer's lower-cased email (the web header shows it) |
| 🔒 `GET /api/leagues` (US02) | `200 [League]`, oldest first, only the signed-in organizer's |
| 🔒 `POST /api/leagues` `{name, location, sport, season, weeks, allow_ties}` (US02) | `201 League` = `{id, slug, name, location, sport, season, weeks, allow_ties}`; `400 Name is required`, `400 Name must be 100 characters or fewer` (after trimming), `400 Location is required`, `400 Weeks must be at least 1` (missing, not a whole number, or < 1), `400 Weeks must be between 1 and 52` (a whole number above 52), checked in that order. Name, location, sport and season are trimmed; `sport` and `season` are optional and stored as `""`; `allow_ties` defaults to `false` and must be a JSON boolean (else `400 Invalid request`). `slug` is 6 characters from `abcdefghjkmnpqrstuvwxyz23456789` |
| 🔒 `GET /api/leagues/{id}` (US02) | `200 League`; `404 League not found` (unknown, or another organizer's) |
| 🔒 `GET /api/leagues/{id}/entrants` (US03) | `200 [Entrant]` = `[{id, name}]`, in the order added; `404 League not found` |
| 🔒 `POST /api/leagues/{id}/entrants` `{name}` (US03) | `201 Entrant`; `400 Name is required` (blank, or not a string), `400 Name must be 100 characters or fewer` (after trimming), `409 An entrant with that name already exists in this league` (names are compared after trimming, lower-cased with plain lower-casing, not Unicode case-folding: `" bag ladies "` after `"Bag Ladies"` is a duplicate, `"STRASSE"` after `"Straße"` is not; the trimmed name is stored as typed), `400 A league can have at most 52 entrants` (checked last, after the duplicate check: 53 entrants would need 53 weeks), `404 League not found` |
| 🔒 `POST /api/leagues/{id}/schedule` (US04) | `201 {weeks, message}`: a round robin (circle method; an odd count gives each entrant one bye) replaces any old games; `weeks` is the number of rounds and the league's `weeks` is set to it. `message` is `null` when the league's weeks already matched, else `This schedule needs {n} weeks, so the league now runs {n} weeks instead of {old}.`; `400 Add at least 2 entrants first`, `409 Scores already recorded — clear them first`, `404 League not found` |
| 🔒 `GET /api/leagues/{id}/games` (US04) | `200 [Game]` = `[{id, week, home_id, home_name, away_id, away_name, home_score, away_score}]` by week then position in the week; a bye has `away_id`, `away_name` and both scores `null`; `[]` before a schedule; `404 League not found` |
| 🔒 `DELETE /api/leagues/{id}/scores` (US04) | `200 {cleared: <number of games that had a score>}`; game ids and byes are untouched; `404 League not found` |
| 🔒 `PUT /api/games/{id}/score` `{home_score, away_score}` (US05) | `200 Game` with both scores set (a second `PUT` replaces them); both scores `null` (or both keys absent, `{}`) clears the game back to unplayed, `200 Game` with both `null` (clearing an unplayed game is a no-op); `404 Game not found` (unknown, or in another organizer's league), `400 A bye has no score` (even for a clear), `400 Scores must be whole numbers 0 or greater` (missing or `null` beside a number, negative, fractional, a string, a boolean, or ≥ 2³¹; an integral float such as `21.0` counts as 21), `400 This league doesn't allow ties` (equal scores when `allow_ties` is `false`), checked in that order. A body that is not a JSON object is `400 Invalid request`, checked before all of these |
| 🔒 `GET /api/leagues/{id}/standings` (US06) | `200 Standings` = `{rows: [{entrant_id, name, w, l, t, pf, pa, diff}], played, tiebreak}`, computed on every request from the games (nothing stores standings). Every entrant has a row, zeros before any score; `played` counts non-bye games with a score; byes and unscored games contribute nothing; a tie gives each side a `t` and neither a `w` or `l` (`t` is always present, frontends hide it when the league doesn't allow ties). Rows sort by `w`, then `diff`, then `pf` (all descending), then name; `tiebreak` is exactly `Sorted by wins, then point difference, then points for.`; `404 League not found` |
| `GET /api/public/{slug}` (US07) | `200 {league, current_week, games, standings}` with **no token** (an `Authorization` header is ignored): `league` is the League without `id`; `games` is `[Game]` by week then position; `standings` is the Standings shape; `current_week` is the lowest week with an unplayed non-bye game, the last week when every non-bye game is played, `null` with no schedule; `404 {"error": "League not found"}` for an unknown slug |

A route marked with a lock needs `Authorization: Bearer <token>`; a missing, malformed or expired token gets `401 {"error": "Sign in required"}`. Every route that takes a body (signup, login, refresh, `POST /leagues`, `POST …/entrants`, `PUT …/score`) answers `400 {"error": "Invalid request"}`, never 422, when the body is missing, is not valid JSON, or is valid JSON that is not an object (`[]`, `"x"`, `5`); an object with missing or wrong-typed fields gets that route's own message instead. Response bodies are compared as JSON, so spacing, key order and `\u` escapes don't matter. Access tokens last 1 hour, refresh tokens 30 days.

Try one in a browser: http://localhost:8000/api/hello?name=Mike (or any backend's `API_URL` followed by `/api/hello?name=…`).

`./contract-test.sh <API_URL>` checks a running backend against this table. A new route goes in this table, in every backend, and in the contract test.

## Tests

| Folder | Unit tests | Against a running backend |
|---|---|---|
| `backends/fastapi` | `.venv/bin/python -m pytest` | `../../contract-test.sh http://localhost:8000` |
| `backends/django` | `.venv/bin/python manage.py test` | `../../contract-test.sh http://localhost:8001` |
| `backends/supabase` | — | `./smoke.sh`, then `../../contract-test.sh http://localhost:54321/functions/v1` |
| `backends/firebase` | — | `./smoke.sh`, then `../../contract-test.sh http://localhost:5000` |
| `frontends/web` | `npm test` | `LIVE_API_URL=<API_URL> LIVE_BACKEND=<name> npm test` |
| `frontends/streamlit` | `.venv/bin/python -m pytest` | `LIVE_API_URL=<API_URL> LIVE_BACKEND=<name> .venv/bin/python -m pytest` |
| `frontends/flutter` | `flutter analyze && flutter test` | `LIVE_API_URL=<API_URL> LIVE_BACKEND=<name> flutter test` |

`LIVE_BACKEND` is optional; with it, the test also checks that the right backend answered.

## Stop what you start

Ctrl+C stops the servers started in a terminal. Supabase runs in Docker and keeps running until `cd src/backends/supabase/docker && docker compose down`.
