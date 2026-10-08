# Streamlit frontend (stub)

Python · Streamlit. The fastest path to a working screen; best for the organizer's side.

## Install
```bash
python3 -m venv .venv          # if this fails: sudo apt install python3-venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run
```bash
API_URL=http://localhost:8000 streamlit run app.py    # shows "Hello from <backend>" when it reaches one
```

## Test
```bash
python -m pytest
LIVE_API_URL=http://localhost:8000 LIVE_BACKEND=fastapi python -m pytest   # also calls a running backend
```

## TODO
- [ ] Organizer screens: sign-in, leagues, entrants, schedule, scores (US01–US05)
- [ ] Standings view (US06)
- [ ] Public read-only page and how it behaves on a phone (US07), the known weak spot
- [x] One API client for every backend (ADR 003); see [`src/README.md`](../../README.md) for all 12 pairings
