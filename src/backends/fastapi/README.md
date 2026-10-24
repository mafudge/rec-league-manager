# FastAPI backend

Python · FastAPI · SQLAlchemy · SQLite. The "build it yourself" baseline.

## Install
```bash
python3 -m venv .venv          # if this fails: sudo apt install python3-venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run
```bash
uvicorn app.main:app --reload
curl localhost:8000/api/backend   # {"backend":"fastapi"}
../../contract-test.sh http://localhost:8000
```

Set `JWT_SECRET` to a long random value anywhere but a local laptop; the built-in default is public.

## Test
```bash
python -m pytest
```

## TODO
- [x] SQLAlchemy models and SQLite database (`DATABASE_URL`, default `sqlite:///./rec_league.db`) and one error shape (US13)
- [x] Organizer sign-up: `POST /api/auth/signup` (US13)
- [x] Organizer sign-in and token refresh (US01)
- [x] League, entrant, schedule, score and standings endpoints (US02–US06)
- [x] Public read-only endpoint `GET /api/public/{slug}`, no token (US07); the v0.2.0 reference build is complete
- [x] The shared REST contract (ADR 003), with CORS for browser frontends; see [`src/README.md`](../../README.md)
