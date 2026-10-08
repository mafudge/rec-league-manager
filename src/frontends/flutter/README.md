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

**Android emulator.** In the emulator the host machine is `10.0.2.2`, not `localhost`:
```bash
flutter emulators --launch rec_league_pixel
flutter run -d emulator-5554 --dart-define=API_URL=http://10.0.2.2:8001    # Django; see src/README.md for the others
```
Only debug builds allow plain `http://` (`android/app/src/debug/AndroidManifest.xml`); `test/android_manifest_test.dart` keeps it that way.

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
