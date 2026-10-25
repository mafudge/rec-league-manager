# Next.js web frontend

Next.js 15 · React · TypeScript (App Router). Needs Node 18.18+ (Next 16 needs 20, so stay on 15 here).

## Install
```bash
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL to your backend
```

## Run
```bash
npm run dev     # http://localhost:3000, shows "Hello from <backend>" when it reaches one
```

## What it does
- **Home** (`/`) shows "Hello from <backend>" for whichever backend the API URL points at, plus Sign up and Sign in links. **Your name** + **Say hello** calls `GET /api/hello?name=` and shows the reply or the backend's own error.
- **Sign up** (`/signup`) and **Sign in** (`/signin`) send the email and password as typed and show the backend's own message verbatim. Success lands on **My leagues**. Signed in, the header shows the email and **Sign out**, which forgets the tokens (kept in browser storage).
- **My leagues** (`/leagues`) lists each league (click the name to open it), says so when empty, and links to **Create a league** (`/leagues/new`: Name, Location, Sport, Season, Weeks, "Games can end in a tie"; the backend's refusals are shown verbatim).
- **League home** (`/leagues/<id>`): name, location, "sport · season", the public link (copyable) and tabs **Entrants** (add by name, list in order), **Schedule** (generate, enter or clear scores, clear all scores) and **Standings** (W, L, T only when ties are allowed, PF, PA, Diff, and the backend's tiebreak sentence).
- **Public page** (`/l/<slug>`, US07): no sign-in and no token. League name, "This week", the full schedule by week and the standings, phone-first at 375 px; an unknown slug shows only "League not found". It has nothing that writes.

## Test
```bash
npm test
LIVE_API_URL=http://localhost:8000 LIVE_BACKEND=fastapi npm test   # also calls a running backend
```

## TODO
- [x] Public league page at `/l/[slug]`: schedule and standings, phone-first at 375 px (US07)
- [x] Organizer sign-up at `/signup` (US13)
- [x] Organizer sign-in and league screens (US01–US06); the v0.2.0 reference build is complete
- [x] One API client for every backend (ADR 003); see [`src/README.md`](../../README.md) for all 12 pairings
- [ ] Replace the default create-next-app styles
