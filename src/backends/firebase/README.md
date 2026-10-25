# Firebase backend, Emulator Suite

The Firebase Emulator Suite (Auth, Firestore, Hosting) run locally. **No Google account, Firebase project or API key is used**: the project id `demo-rec-league` is a `demo-` id, which the emulators treat as offline (see [ADR 001](../../../docs/decisions/001-self-hosted-supabase-and-firebase.md)). The emulators are for development, not production.

## Requirements
Node 18.18+ and Java 11+ (the Firestore emulator is a Java program). `firebase-functions` stays on v6 because v7 needs Node 20, so the emulator's "outdated firebase-functions" warning is expected. `firebase-tools` is pinned to v13 because v14+ needs Node 20; `package.json` has an `overrides` entry that fixes a Node 18 crash in a transitive dependency. Remove it once you are on Node 20+.

## Install
```bash
npm install            # also installs functions/
```

## Run
```bash
npm run emulators      # Hosting :5000, Functions :5001, Firestore :8080, Auth :9099, UI :4100 (only Hosting :5000, the API, is reachable from the LAN; the rest are 127.0.0.1 only)
```

**Our REST API** (ADR 003): `API_URL=http://localhost:5000`. It is the Cloud Function `api` in `functions/index.js`; Hosting forwards `/api/**` to it (`firebase.json`), and the emulator reloads it when you save.

The contract is complete: accounts, leagues and entrants, the schedule (one Firestore document per league, with generate and score as transactions on it), scores, standings (computed in the function on every request, `standings.js`) and the public page (`public.js`, found through `slugs/{slug}`).

Accounts (US01) use the Auth emulator through its REST API; `functions/auth.js` maps its errors to the contract's, and the function verifies access tokens with the Admin SDK. `firestore.rules` denies everything: clients never touch Firestore, and the function's Admin SDK bypasses rules, so ownership is checked in code.

**Data survives restarts.** `npm run emulators` imports `./emulator-data` on start and exports to it when you stop with Ctrl+C (SIGINT; a killed process loses the session). The folder is git-ignored and created on demand.

## Test
```bash
(cd functions && npm test)   # unit tests (node --test), no emulator needed
./smoke.sh             # with the emulators running: prints "firestore ok", "auth ok", "hosting ok", "api ok"
../../contract-test.sh http://localhost:5000   # all routes: prints "contract ok"
```

Known limit: the Functions runtime parses JSON bodies before our code, so a malformed body sent with `Content-Type: application/json` gets the runtime's HTML 400 instead of `{"error": "Invalid request"}` (backlog POL-01). The same goes for any body sent as `application/json` that is not a JSON object (`5`, `"x"`, `null`, `true`), and that 400 has no CORS headers. Clients therefore send no body and no `Content-Type` on routes that take none, and a JSON object otherwise.

**Development only, not a security boundary.** The emulators keep passwords in plaintext (Auth) and serve every document (Firestore), and under the Auth emulator the Admin SDK accepts unsigned tokens. Only Hosting (port 5000, the API) listens on all interfaces, so a phone on the LAN can reach the API. Auth 9099, Functions 5001, Firestore 8080, the Emulator UI 4100, the hub 4400 and logging 4500 are bound to `127.0.0.1`. `emulator-data/` also holds the plaintext passwords on disk (git-ignored). Sign-in checks the token is not revoked and the user still exists, so a deleted account is refused with 401 `Sign in required`.

## TODO
- [x] Email + password sign-in against the Auth emulator (US01); no email links
- [x] Data model: leagues, entrants (subcollection), the schedule and scores (one document), public slugs
- [x] Standings computed in the Cloud Function per request (US06)
- [x] Public page by slug, no token (US07)
- [x] `firestore.rules`: deny all; the function's Admin SDK is the only reader and writer, ownership is checked in code
- [x] Persisted emulator state (`--import`/`--export-on-exit`)
- [x] Serve the shared REST contract from a Cloud Function (ADR 003); see [`src/README.md`](../../README.md)
- [ ] Seed data (not scheduled)
