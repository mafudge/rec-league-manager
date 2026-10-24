# Flutter frontend (stub)

Flutter (web). Runs in Chrome; the same codebase could target phones and desktops later.

## Requirements
Flutter 3.44+. If `flutter` is not found, add it to `PATH` (here: `export PATH=$PATH:$HOME/.local/flutter/bin`).

## Install
```bash
flutter pub get
```

## Run
```bash
flutter run -d chrome --dart-define=API_URL=http://localhost:8000    # shows "Hello from <backend>" when it reaches one
```
Every backend in `src/backends` allows CORS, so any of them works; see [`src/README.md`](../../README.md) for each `API_URL`.

## What it does
- Shows "Hello from <backend>" for whichever backend `API_URL` points at.
- **Accounts** (US01, US13): routes use the hash URL strategy (`/#/signup`, `/#/signin`, `/#/leagues`; deep links work on any static server). **Sign up** and **Sign in** send the email and password as typed and show the backend's own message verbatim ("An account with that email already exists", "Email or password is incorrect", ...); success lands on **My leagues** (a placeholder heading until the league list is ported). Each form links to the other; Home links to both. Organizer screens show the signed-in email (`GET /api/auth/me`) and **Sign out** (forgets the tokens, sends nothing, goes to Sign in); a signed-out visit goes to Sign in.
- **One client** (`lib/api.dart`, class `Api`): tokens live in memory (lost on reload); `request(method, path, {body, auth})` sends no body and no `Content-Type` when `body` is null; on a 401 from a signed-in call it refreshes once with the newest refresh token and retries once (refresh answered 400/401/403: tokens forgotten, back to Sign in; any other refresh failure keeps them and shows "The backend had a problem (<status>)"); no answer shows "Can't reach the backend at <API_URL>".
- **Your name** + **Say hello** (or Enter) calls `GET /api/hello?name=` and shows the reply: "Hello Mike", or the backend's own error, such as "Name is required" for a blank name. The app doesn't check the name itself.

## Test
```bash
flutter analyze && flutter test
LIVE_API_URL=http://localhost:8000 LIVE_BACKEND=fastapi flutter test   # also calls a running backend
```

## TODO
- [ ] Public league page: schedule and standings, phone-first at 375 px (US07)
- [x] Organizer sign up, sign in, sign out (US01, US13)
- [ ] Organizer league screens (US02–US06)
- [x] One API client for every backend (ADR 003); see [`src/README.md`](../../README.md) for all 12 pairings
- [ ] Android/iOS/desktop platforms if wanted (only web is generated; Android was dropped in SCAF-15 to save RAM and disk: `flutter create --platforms=android .` brings it back)
- [ ] Replace the default app icon and the `com.example` package id
