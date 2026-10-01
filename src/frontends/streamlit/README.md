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
API_URL=http://localhost:8000 streamlit run app.py    # shows "Backend: ok" when a backend is up
```

## Test
```bash
python -m pytest
```

## TODO
- [ ] Organizer screens: sign-in, leagues, entrants, schedule, scores (US01–US05)
- [ ] Standings view (US06)
- [ ] Public read-only page and how it behaves on a phone (US07), the known weak spot
- [ ] Talk to the Supabase/Firebase backends, not just FastAPI/Django
