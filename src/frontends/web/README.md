# Next.js web frontend (stub)

Next.js 15 · React · TypeScript (App Router). Needs Node 18.18+ (Next 16 needs 20, so stay on 15 here).

## Install
```bash
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL to your backend
```

## Run
```bash
npm run dev     # http://localhost:3000, shows "Backend: ok" when a backend is up
```

## Test
```bash
npm test
```

## TODO
- [ ] Public league page: schedule and standings, phone-first at 375 px (US07)
- [ ] Organizer sign-in and league screens (US01–US06)
- [ ] API client that works against FastAPI/Django, and adapters for Supabase and Firebase
- [ ] Replace the default create-next-app styles
