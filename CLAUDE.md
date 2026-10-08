# CLAUDE.md

## What this is
Rec League Manager — a tool for the volunteer who runs a recreational league (cornhole, pickleball, darts, pitch, volleyball) to manage people, schedules, scores and standings. Worked example capstone for IST300.

## Who uses it
- **The organizer** — one person, not technical, on a laptop Sunday night and a phone during league night.
- **Players** — they want to see the schedule and standings on a phone. They should never have to log in.

## Conventions
- Requirements live in `docs/`. If a request contradicts them, say so rather than guessing.
- Commit messages say what was decided, not just what changed. "Update file" is never acceptable.

## Instructions for Claude

1. Project planning goes on the backlog in `docs/backlog.md`. These should be grouped logically by user story or feature. New issues and bugs start here.
2. `docs/todo.md` Contains items moved from `docs/backlog.md` that we are working on NOW. We should complete the todo's before working on the next backlog item. 
3. We don't write code unless there is a GitHub issue for it.
4. Each todo should land in Github as an issue to be coded, issues numbers tracking back to the item.
5. All GitHub issues should be well-defined so a programmer of moderate ability can complete the task trivially.
6. All GitHub issues should have acceptance criteria and definition of done sections, suitable for a product manager.
7. Track the Github issue back to the backlog version number with labels ex: v1.10.0, US01, etc.
8. Do not wander off task. If you encounter a bug, feature or enhancement idea while working, add it to the backlog and label it. 
9. Always code in a `dev/branch` for the Github issue and when done, push to `main`. 
10. We test the code we write. Unit and integration tests.
11. An issue is not done until tests pass, the server runs and the app runs without error.
12. As you close Github issues review `docs/todo.md` and move completed items into `docs/xchangelog.md`
13. start coding on `main` with a clean working directory before you start work on the next issue

## Running the stubs
Everything lives under `src/`; each folder's `README.md` is the full reference. Run from the repo root. Default ports are chosen so a backend and a frontend can run together. Any frontend works with any backend (ADR 003): [`src/README.md`](src/README.md) has the 4 × 3 table of pairings and each backend's `API_URL`; `src/contract-test.sh <API_URL>` checks a running backend.

| Folder | Install (once) | Start | Test | Port |
|---|---|---|---|---|
| `src/backends/fastapi` | `cd src/backends/fastapi && . .venv/bin/activate && pip install -r requirements.txt` | `.venv/bin/uvicorn app.main:app --reload` | `.venv/bin/python -m pytest` | 8000 (`/api/health`) |
| `src/backends/django` | `pip install -r requirements.txt` in its `.venv`, then `.venv/bin/python manage.py migrate` | `.venv/bin/python manage.py runserver` | `.venv/bin/python manage.py test` | 8001 (`/api/health`) |
| `src/backends/supabase` | Docker only | `./start.sh` (first run generates `docker/.env`) | `./smoke.sh` | 54321 (`API_URL` = `/functions/v1`) |
| `src/backends/firebase` | `npm install` (also installs `functions/`) | `npm run emulators` | `./smoke.sh` | 5000 Hosting = `API_URL`, 5001 Functions, 8080 Firestore, 9099 Auth, 4100 UI |
| `src/frontends/web` | `npm install`, `cp .env.example .env.local` | `npm run dev` | `npm test` | 3000 |
| `src/frontends/streamlit` | `pip install -r requirements.txt` in its `.venv` | `API_URL=http://localhost:8000 .venv/bin/streamlit run app.py` | `.venv/bin/python -m pytest` | 8501 |
| `src/frontends/flutter` | `flutter pub get` | `flutter run -d chrome --dart-define=API_URL=http://localhost:8000` | `flutter analyze && flutter test` | chosen by Flutter |

Gotchas on this machine:
- `python3 -m venv` fails (no `python3-venv`). Use `python3 -m venv --without-pip .venv`, then `.venv/bin/python get-pip.py` (download from `https://bootstrap.pypa.io/get-pip.py`).
- Node is 18.19: keep Next.js on 15 and `firebase-tools` on 13. The Firestore emulator needs Java (installed).
- Flutter is not on `PATH`: `export PATH=$PATH:/home/ubuntu/.local/flutter/bin`.
- Android: the SDK is in `~/Android/Sdk` and the emulator is `rec_league_pixel` (Android 36, x86_64). This machine is a Hyper-V VM; the emulator needs nested virtualization on (`/dev/kvm` must exist). From the emulator, host backends are at `10.0.2.2`, not `localhost`.
- Every backend has its own port (FastAPI 8000, Django 8001, Firebase 5000, Supabase 54321), so all four can run at once. Django's default comes from `api/management/commands/runserver.py`.
- Stop what you start: don't leave servers, emulators or the Supabase containers (`cd src/backends/supabase/docker && docker compose down`) running when you finish.
- Never commit `.env`, `docker/.env` or `.venv`; they are git-ignored.
