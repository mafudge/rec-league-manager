# Firebase backend, Emulator Suite (stub)

The Firebase Emulator Suite (Auth, Firestore, Hosting) run locally. **No Google account, Firebase project or API key is used**: the project id `demo-rec-league` is a `demo-` id, which the emulators treat as offline (see [ADR 001](../../../docs/decisions/001-self-hosted-supabase-and-firebase.md)). The emulators are for development, not production.

## Requirements
Node 18.18+ and Java 11+ (the Firestore emulator is a Java program). `firebase-functions` stays on v6 because v7 needs Node 20, so the emulator's "outdated firebase-functions" warning is expected. `firebase-tools` is pinned to v13 because v14+ needs Node 20; `package.json` has an `overrides` entry that fixes a Node 18 crash in a transitive dependency. Remove it once you are on Node 20+.

## Install
```bash
npm install            # also installs functions/
```

## Run
```bash
npm run emulators      # Hosting :5000, Functions :5001, Firestore :8080, Auth :9099, UI :4100 (all on 0.0.0.0, so a phone on the LAN can reach them)
```

**Our REST API** (ADR 003): `API_URL=http://localhost:5000`. It is the Cloud Function `api` in `functions/index.js`; Hosting forwards `/api/**` to it (`firebase.json`), and the emulator reloads it when you save.

```bash
```

## Test
```bash
./smoke.sh             # with the emulators running: prints "firestore ok", "auth ok", "hosting ok", "api ok"
../../contract-test.sh http://localhost:5000
```

## TODO
- [ ] `firestore.rules`: organizer writes, anyone reads the public schedule and standings (currently deny-all)
- [ ] Email + password sign-in against the Auth emulator (US01); no email links
- [ ] Data model: leagues, entrants, games, scores
- [ ] Standings: a Firestore document store has no joins, so decide where they are computed (client or a function) (US06)
- [ ] Seed data and persisted emulator state (`--import`/`--export-on-exit`)
- [x] Serve the shared REST contract from a Cloud Function (ADR 003); see [`src/README.md`](../../README.md)
