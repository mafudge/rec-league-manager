# Task 2 report: Firebase leagues and entrants (#42)

Status: DONE. Branch dev/42-firebase-leagues.

Built: functions/leagues.js (validators, ownedLeague, routes' logic), slugs.js, firestore-store.js (Firestore transactions), routes.js/index.js wiring, test/leagues.test.js.
- ownedLeague: /^[0-9a-f]{32}$/ first (no store call otherwise), then existence, then organizerId === uid; all 404 "League not found".
- Slug claimed in the same transaction as the league (slugs/{slug}); 5 retries then 409 as FastAPI.
- Entrant duplicate check, 52 cap and position are decided inside the transaction with the insert.
- createdAt is a ms number; list sorted in memory by createdAt then id (no composite index).
- Tests: npm test 22 pass (RED first: module missing). Includes id-shape guard (.., x, %2F, 31/33 hex, uppercase, non-hex) with store.calls empty, two-organizer 404 on every route, 401 on every route.
- Contract: Firebase CONTRACT_UPTO=leagues ok; FastAPI, Django, Supabase full ok.
- Live web check at 375px (signup, create league, add entrants, duplicate refused, no horizontal overflow) passed. Emulators, web, Chrome, FastAPI, Django stopped; Supabase left running.
- Carried: (1) contract-test.sh's send() already sent Content-Type on every JSON request and malformed-body checks have no raw curl, so no change needed; (2) added refresh-token-as-bearer 401 check; (3) test script glob; (4) two POL-01 lines added to backlog.

Concerns: Django db.sqlite3 already existed and now holds contract-run rows (ignored by git). The live-check scripts are in the scratchpad, not committed.
