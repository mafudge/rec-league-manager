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
flutter run -d chrome --dart-define=API_URL=http://localhost:8000    # shows "Backend: ok" when a backend is up
```
Needs a backend that allows CORS from the browser origin.

## Test
```bash
flutter analyze && flutter test
```

## TODO
- [ ] Public league page: schedule and standings, phone-first at 375 px (US07)
- [ ] Organizer sign-in and league screens (US01–US06)
- [ ] API client for FastAPI/Django, and adapters for Supabase and Firebase
- [ ] iOS/desktop platforms if wanted (only web and Android are generated)
- [ ] Replace the default app icon and the `com.example` package id
