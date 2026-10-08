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

**In the Android emulator.** Needs the Android SDK and an emulator (here: `~/Android/Sdk`, emulator `rec_league_pixel`). Inside the emulator, `localhost` is the emulator itself; the machine running the backends is `10.0.2.2`.
```bash
flutter emulators --launch rec_league_pixel                           # wait for the Android home screen
flutter run -d emulator-5554 --dart-define=API_URL=http://10.0.2.2:8001
```

| Backend | `API_URL` from the emulator |
|---|---|
| fastapi | `http://10.0.2.2:8000` |
| django | `http://10.0.2.2:8001` |
| firebase | `http://10.0.2.2:5000` |
| supabase | `http://10.0.2.2:54321/functions/v1` |

Debug builds allow plain `http://` for these local backends; release builds don't.

## The API

Every backend serves these routes under its `API_URL`. Every response is JSON and allows any origin (CORS), because the web and Flutter apps run in a browser on a different port from the backend.

| Route | Response |
|---|---|
| `GET /api/health` | `{"status": "ok"}` |
| `GET /api/backend` | `{"backend": "fastapi"}` — or `django`, `supabase`, `firebase` |
| `GET /api/hello?name=Mike` | `{"message": "Hello Mike"}`; spaces around the name are trimmed |
| `GET /api/hello` with no name, or a blank one | `400 {"error": "Name is required"}` |

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
