# Next.js web frontend (stub)

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

## Test
```bash
npm test
LIVE_API_URL=http://localhost:8000 LIVE_BACKEND=fastapi npm test   # also calls a running backend
```

## TODO
- [ ] Public league page: schedule and standings, phone-first at 375 px (US07)
- [ ] Organizer sign-in and league screens (US01–US06)
- [x] One API client for every backend (ADR 003); see [`src/README.md`](../../README.md) for all 12 pairings
- [ ] Replace the default create-next-app styles
