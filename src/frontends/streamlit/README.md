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

## What it does
- Shows "Hello from <backend>" for whichever backend the API URL points at.
- **Your name** + **Say hello** (or Enter) calls `GET /api/hello?name=` and shows the reply: "Hello Mike", or the backend's own error, such as "Name is required" for a blank name. The app doesn't check the name itself.

- **Sign up** (`/signup`) and **Sign in** (`/signin`) send the email and password as typed to `POST /api/auth/signup` / `login` and show the backend's own message verbatim ("An account with that email already exists", "Email or password is incorrect", ...). Success lands on **Your leagues** (`/leagues`, a heading until US02 lands). Each page links to the other; Home links to both.
- Signed in, the header shows the email from `GET /api/auth/me` and **Sign out**, which forgets the tokens (nothing is sent). Pages that change data send a signed-out visitor to Sign in.
- Tokens live in `st.session_state` (lost on reload, accepted). `api.py` is the one client: every call takes the session mapping; on a 401 it refreshes once with the newest refresh token and retries; a refresh refused with 400/401/403 forgets the tokens, any other refresh failure keeps them. No body and no `Content-Type` on routes that take none.
- Layout: `app.py` is the router (`st.navigation`, hidden; one file per page in `screens/`, logic in `views.py`). The public page will be chosen there from `?league=<slug>`, before any sign-in check.

## Test
```bash
python -m pytest
LIVE_API_URL=http://localhost:8000 LIVE_BACKEND=fastapi python -m pytest   # also calls a running backend
```

## TODO
- [x] Sign up, sign in, sign out (US01, US13)
- [ ] Organizer screens: leagues, entrants, schedule, scores (US01–US05)
- [ ] Standings view (US06)
- [ ] Public read-only page and how it behaves on a phone (US07), the known weak spot
- [x] One API client for every backend (ADR 003); see [`src/README.md`](../../README.md) for all 12 pairings
