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

- **Sign up** (`/signup`) and **Sign in** (`/signin`) send the email and password as typed to `POST /api/auth/signup` / `login` and show the backend's own message verbatim ("An account with that email already exists", "Email or password is incorrect", ...). Success lands on **My leagues** (`/leagues`). Each page links to the other; Home links to both.
- Signed in, the header shows the email from `GET /api/auth/me` and **Sign out**, which forgets the tokens (nothing is sent). Pages that change data send a signed-out visitor to Sign in.
- **My leagues** lists each league's name and location (click the name to open it), says "No leagues yet — create one." when empty, and links to **Create a league** (`/leagues-new`: Name, Location, Sport, Season, Weeks, "Games can end in a tie"; sent as typed, blank Weeks as `null`, the backend's refusal shown verbatim; success opens the league).
- **League home** (`/league`): name, location, "sport · season" (when set), the public link as copyable text, and tabs Entrants · Schedule · Standings (Standings is empty until its story lands). **Entrants** has a Name box + Add, the list in order, "No entrants yet — add the first one.", and the backend's refusals verbatim (a refused add keeps the typed text). An add or create is sent only on the run the click caused, so a later rerun never re-sends it.
- **Schedule** tab (US04, US05): **Generate schedule** (`POST …/schedule`, no body) shows the backend's weeks message when it sends one; games sit under "Week N" as "A vs B", byes as "A — bye", a played game as "A 21 – 14 B"; "No schedule yet — add entrants, then generate." when empty and "Regenerate the schedule to include new entrants." when an entrant is in no game. Each game has two number boxes labelled with the entrants (pre-filled with the saved score) and **Save** (a blank box goes as `""`, so the backend's whole-number message shows); **Clear** on played games sends both `null`. **Clear all scores** asks "Clear every score in this league?" with **Yes, clear every score** / **Cancel**, and only Yes sends `DELETE …/scores` (no body). Refusals are the backend's, shown next to the action that caused them, and the games reload after each action. Entrant names, the header email and every shown message are escaped so they appear as typed.
- `PUBLIC_BASE_URL` (default `http://localhost:8501`) is this app's own address; the public link is `<PUBLIC_BASE_URL>/?league=<slug>`.
- Tokens live in `st.session_state` (lost on reload, accepted). `api.py` is the one client: every call takes the session mapping; on a 401 it refreshes once with the newest refresh token and retries; a refresh refused with 400/401/403 forgets the tokens, any other refresh failure keeps them. No body and no `Content-Type` on routes that take none.
- Layout: `app.py` is the router (`st.navigation`, hidden; one file per page in `screens/`, logic in `views.py`). The public page will be chosen there from `?league=<slug>`, before any sign-in check.

## Test
```bash
python -m pytest
LIVE_API_URL=http://localhost:8000 LIVE_BACKEND=fastapi python -m pytest   # also calls a running backend
```

## TODO
- [x] Sign up, sign in, sign out (US01, US13)
- [x] Leagues and entrants (US02, US03)
- [x] Organizer screens: schedule, scores (US04, US05)
- [ ] Standings view (US06)
- [ ] Public read-only page and how it behaves on a phone (US07), the known weak spot
- [x] One API client for every backend (ADR 003); see [`src/README.md`](../../README.md) for all 12 pairings
