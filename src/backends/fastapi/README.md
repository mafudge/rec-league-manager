# FastAPI backend (stub)

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

## Test
```bash
python -m pytest
```

## TODO
- [ ] SQLAlchemy models and SQLite database (leagues, entrants, games)
- [ ] Organizer sign-in (US01)
- [ ] League, entrant, schedule, score and standings endpoints (US02–US07)
- [ ] Public read-only endpoints (US07)
- [x] The shared REST contract (ADR 003), with CORS for browser frontends; see [`src/README.md`](../../README.md)
