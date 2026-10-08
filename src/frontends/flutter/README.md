# Flutter frontend (stub)

Flutter (web + Android). One codebase for web and native.

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

## Test
```bash
flutter analyze && flutter test
LIVE_API_URL=http://localhost:8000 LIVE_BACKEND=fastapi flutter test   # also calls a running backend
```

## TODO
- [ ] Public league page: schedule and standings, phone-first at 375 px (US07)
- [ ] Organizer sign-in and league screens (US01–US06)
- [x] One API client for every backend (ADR 003); see [`src/README.md`](../../README.md) for all 12 pairings
- [ ] iOS/desktop platforms if wanted (only web and Android are generated)
- [ ] Replace the default app icon and the `com.example` package id
