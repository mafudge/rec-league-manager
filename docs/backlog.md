# Backlog: Still to do

Stories, acceptance criteria, MoSCoW, MVP slice. This is what the agent builds against from Week 9. Keep it current, not historical.

**Evidence key.** `I1-#n` = `docs/research/interview-01.md`, row *n* · `I2-#n` = `docs/research/interview-02.md`, row *n* · `CB` = concept brief.

---

## Stories

### US13 · Organizer signs up

**Story.** As a new organizer, I want to create my own account with an email and a password so that I can start running my league without anyone setting it up for me.

**Acceptance criteria**
- Given I am on the sign-up page, when I enter an email that isn't registered and a password of at least 8 characters, then my account is created, I am signed in, and I land on my league list, which says "No leagues yet — create one."
- Given the email is already registered, when I sign up with it, then no account is created and I see "An account with that email already exists". *(negative)*
- Given a password shorter than 8 characters, when I submit, then no account is created and I see "Password must be at least 8 characters". *(negative)*
- Given an email without an "@", when I submit, then no account is created and I see "Enter a valid email address". *(negative)*
- Given two organizers who each created a league, when either signs in, then their league list shows only their own leagues, and they cannot change the other's league. *(negative)*
- Given I am on the sign-in page, then there is a link to sign up, and the sign-up page links back to sign in.

**Evidence.** Gap found planning v0.2.0: US01 signs in an organizer, but nothing creates one. PRD §7: an organizer owns leagues; a league belongs to one organizer. Not a co-organizer feature: each organizer sees only their own leagues (PRD §3).

### US13-01 · Passwords are at most 72 characters

**Found porting to Supabase.** Supabase's sign-in service refuses passwords over 72 characters, FastAPI's bcrypt silently uses only the first 72, and Django accepts any length, so the backends disagreed. **Decided 2026-10-24: cap it in v0.2.0, on every backend.** **Done in v0.2.0 (#39):** signup refuses a password over 72 bytes on every backend.

**Acceptance criteria**
- Given a password longer than 72 bytes in UTF-8 (72 plain letters; accented letters and emoji count more, because bcrypt limits bytes), when I sign up, then no account is created and I see "Password must be 72 characters or fewer". *(negative)*
- Given a password of exactly 72 bytes, when I sign up, then the account is created and I can sign in with it.

### US01 · Organizer signs in

**Story.** As the organizer, I want to sign in with an email and password so that only I can change the league.

**Acceptance criteria**
- Given I am on the sign-in page, when I enter a registered email and the correct password, then I land on my league list.
- Given I enter a registered email and the wrong password, when I submit, then I stay on the sign-in page, see "Email or password is incorrect", and no league is shown. *(negative)*
- Given I am not signed in, when I open any page that changes data (create league, add team, enter score), then I am redirected to sign in.

**Evidence.** I1-#12 "I don't want to make everyone sign up for something" — one writer, everyone else reads. I2-#9.

### US02 · Create a league

**Story.** As the organizer, I want to create a league with a name, a location, a sport, a season label, a number of weeks and whether games can end in a tie, so that everything for that season lives in one place.

**Acceptance criteria**
- Given I am signed in, when I submit name "Tuesday Cornhole", location "Joe's Tavern", sport "Cornhole", season "Fall 2026" and 8 weeks, then the league appears in my list with those values.
- Given I leave the location blank, when I submit, then the league is not created and the form shows "Location is required". Location is free text (e.g. "Joe's Tavern", "Syracuse DPW"). *(negative)*
- Given I leave the name blank, when I submit, then the league is not created and the form shows "Name is required". *(negative)*
- Given I enter 0 or a negative number of weeks, when I submit, then the league is not created and the form shows "Weeks must be at least 1". *(negative)*
- Given I am creating a league, then there is a "Games can end in a tie" setting, off unless I turn it on. Sport is free text, so the app can't know that darts never ties and soccer can; the organizer decides.

**Evidence.** I1-#1 (one sheet per season, tabs for schedule/standings/paid); CB §4.

### US03 · Add entrants (teams or individual players)

**Story.** As the organizer, I want to add a team — or a single player, for individual sports — to a league from my phone so that I can register someone in the parking lot.

**Acceptance criteria**
- Given a league exists, when I add entrant "Bag Ladies", then it appears in that league's entrant list.
- Given an entrant named "Bag Ladies" already exists in this league, when I add "Bag Ladies" again, then it is rejected with "An entrant with that name already exists in this league". *(negative)*
- Given I am on a 375-px-wide phone screen, when I open the add-entrant form, then the name field and the Add button are visible without horizontal scrolling.

**Evidence.** I2-#4 "add them on the spot, on my phone, in the parking lot"; I2-#10; I2-#1/#3 (some leagues are people, not teams).

### US04 · Generate a round-robin schedule

**Story.** As the organizer, I want to generate a schedule where every entrant plays every other entrant once so that I stop building matchups by hand and getting them wrong.

**Acceptance criteria**
- Given a league with 6 entrants, when I generate the schedule, then there are 5 weeks, each entrant appears exactly once per week, and every pair of entrants meets exactly once across the season.
- Given a league with 5 entrants (odd), when I generate the schedule, then each week exactly one entrant has a bye, and no entrant has a bye twice before every entrant has had one. *(edge)*
- Given a league with fewer than 2 entrants, when I try to generate, then no schedule is created and I see "Add at least 2 entrants first". *(negative)*
- Given a schedule already exists and no scores have been entered, when I generate again, then the old schedule is replaced. Given any score has been entered, when I try to generate, then I am refused with "Scores already recorded — clear them first". *(negative)*
- Given scores have been recorded, when I press "Clear all scores" on the schedule and confirm, then every game in the league is unplayed again, the schedule stays, and I can regenerate. Given I cancel the confirmation, then nothing changes. *(decided 2026-10-24: the refusal above pointed to a clear action that no story provided)*
- Given a league set to 6 weeks with 7 entrants (a full round-robin needs 7), when I generate the schedule, then all 7 weeks are generated, the league's weeks become 7, and I see "This schedule needs 7 weeks, so the league now runs 7 weeks instead of 6." The same applies when the league was set to more weeks than the schedule needs: weeks drop to match, with the same message. *(edge)*

**Evidence.** I1-#5 "two teams played each other twice"; I2-#8 "the thing I'd pay for is not having to build the pairings"; I2-#5/#11 (bye rotation).

### US05 · Record a score

**Story.** As the organizer, I want to enter the final score for a scheduled game so that standings come from the app and not from my Sunday-night data entry.

**Acceptance criteria**
- Given a scheduled game between A and B, when I enter 21–14, then the game shows as played with A 21, B 14.
- Given I enter a negative or blank score for either side, when I submit, then the score is not saved and I see "Scores must be whole numbers 0 or greater". *(negative)*
- Given a game already has a score, when I enter a different score, then the new score replaces the old one (mistakes get fixed on Sunday).
- Given a league that allows ties, when I enter a tied score (15–15), then it is saved and the game shows as played.
- Given a league that doesn't allow ties, when I enter a tied score, then it is not saved and I see "This league doesn't allow ties". *(negative)*

**Evidence.** I1-#2 "Sunday I sit down and enter all of it"; I2-#2.

### US06 · Standings compute themselves

**Story.** As the organizer, I want standings to update the moment a score is saved so that the formulas can't break.

**Acceptance criteria**
- Given played games, when I view standings, then each entrant shows W, L, T (ties, only in leagues that allow them), PF (points for), PA (points against) and Diff (PF − PA), sorted by W descending, then Diff descending.
- Given two entrants with equal W and equal Diff, when I view standings, then they are ordered by PF descending, and the tiebreak order is stated on the page.
- Given no games have been played, when I view standings, then every entrant shows 0-0 and the page says "No games played yet". *(empty state)*
- Given a game is unplayed (no score), when I view standings, then it contributes nothing to any row. *(negative)*

**Evidence.** I1-#11 (columns W, L, PF, PA, diff; tiebreak by differential); I1-#1 "every season somebody breaks [the formulas]".

- Given a league that allows ties and a game that ended tied (say 15–15), when I view standings, then each side gets a T, neither gets a W or an L, and the points count toward PF and PA. Ties don't change the sort order (W → Diff → PF); entrants equal on all three are listed by name.

**Decided 2026-10-24 (found building #14):** whether games can end tied is a per-league setting (US02). Leagues that allow ties show a T column; leagues that don't, don't show it.

### US06-01 · Standings refuse games that don't match the entrants

**Found while reviewing** #14. `compute_standings` raises a bare `KeyError` when a played game names an entrant who isn't in the entrant list (say, one removed mid-season), and counts a game where an entrant plays itself as both a W and an L for that entrant. Decision: bad game data is a clear error, not silently skipped.

**Acceptance criteria**
- Given a game whose home or away entrant is not in the entrant list, when standings are computed, then a `ValueError` is raised naming the week and the unknown entrant id. *(negative)*
- Given a game where home and away are the same entrant, when standings are computed, then a `ValueError` is raised naming the week and that entrant. *(negative)*
- Given a bye (`away_id` is `None`), when standings are computed, then no error is raised and it still contributes nothing.

### US05-01 · Clear one game's score

**Found in** the v0.2.0 review (#25 review, I4). A score saved on the wrong game could only be undone with "Clear all scores", which clears the whole season. **Decided 2026-10-24: fix in v0.2.0.**

**Acceptance criteria**
- Given a played game, when I press "Clear" on that game, then it shows as unplayed again, its score no longer counts in standings, and every other game keeps its score.
- Given the API, when `PUT /api/games/{id}/score` is sent with both scores `null`, then the game is cleared (200, both scores `null`). One `null` and one number is still refused with "Scores must be whole numbers 0 or greater". *(negative)*
- Given a bye, when both scores are `null`, then it is still refused with "A bye has no score". *(negative)*

### US02-01 · Names and weeks have limits

**Found in** the v0.2.0 review. Nothing capped a name's length or a league's weeks. **Decided 2026-10-24: fix in v0.2.0.**

**Acceptance criteria**
- Given a league name or an entrant name longer than 100 characters (after trimming), when I submit, then it is refused with "Name must be 100 characters or fewer". *(negative)*
- Given weeks above 52, when I create a league, then it is refused with "Weeks must be between 1 and 52". Weeks of 0 or less still get "Weeks must be at least 1" (US02). *(negative)*
- Given a league already has 52 entrants, when I add another, then it is refused with "A league can have at most 52 entrants", because 53 entrants need a 53-week schedule. *(negative)*

### US04-01 · Schedule fairness and freshness

**Found in** the v0.2.0 build. Entrants added after the schedule was generated got no games, silently; and the first entrant was the home side every week. **Decided 2026-10-24: fix both in v0.2.0.**

**Acceptance criteria**
- Given a schedule exists, when an entrant has no games in it (added after generating), then the Schedule tab says "Regenerate the schedule to include new entrants."
- Given any number of entrants from 2 to 52, when the schedule is generated, then each entrant's home games and away games differ by at most one (byes don't count).
- Given a league that ends up with 1 week, when the schedule is generated and the weeks change, then the message says "1 week", not "1 weeks".

### SCAF-16 · The hello demo reports server errors honestly

**Found in** US01 (#18). The home page's "Hello from …" greeting and Say hello box still said "Can't reach the backend at …" for a server error. **Decided 2026-10-24: fix in v0.2.0.**

**Acceptance criteria**
- Given the backend answers 500, when the home page loads or I press Say hello, then it says "The backend had a problem (500)". "Can't reach the backend at …" is only for a backend that doesn't answer.

### US07 · Public link to schedule and standings

**Story.** As a player, I want to open a link on my phone and see this week's games and the standings so that I stop asking the organizer "who do we play next week."

**Acceptance criteria**
- Given a league's public link, when I open it signed out, then I see the schedule by week and the standings, with no sign-in prompt.
- Given the public link, when I open it, then the league's location is shown under its name, so players know where to show up.
- Given the public link, when I open it, then there is no control that creates, edits or deletes anything. *(negative)*
- Given the public link on a 375-px-wide screen, when I open it, then the current week's games are visible above the fold without horizontal scrolling.
- Given a league that does not exist, when I open its link, then I see "League not found", not an error page. *(negative)*

**Evidence.** I1-#4 "'who do we play next week.' Every single week."; I1-#12; I2-#9 (no accounts, no download); I2-#10.

### US08 · Track who has paid

**Story.** As the organizer, I want to mark each entrant as paid or unpaid, and see who still owes, so that I know who to chase without the app ever touching the money.

**Acceptance criteria**
- Given a league with dues of $40 per entrant, when I mark "Bag Ladies" as paid, then the entrant list shows them as Paid and the unpaid count drops by one.
- Given three entrants are unpaid, when I view the league, then I see "3 of 12 unpaid" and the names of the three.
- Given an entrant is marked paid, when I unmark them (I made a mistake), then they return to Unpaid. *(negative / undo)*
- There is no control anywhere that initiates a payment. *(negative — deliberate)*

**Evidence.** I1-#6 "Money is the worst part."; **I1-#8 "I don't want to be a bank. I just want to know who paid."**; I2-#6.

### US09 · Playoff bracket

**Story.** As the organizer, I want to generate a single-elimination bracket from the top N of the standings so that I don't figure it out on the night.

**Acceptance criteria**
- Given final standings and N = 4, when I generate the bracket, then seed 1 plays seed 4 and seed 2 plays seed 3.
- Given fewer than N entrants have played a game, when I try to generate, then I am refused with a message naming how many are eligible. *(negative)*

**Evidence.** I1-#9 "I have to figure out the bracket on the night."

### US10 · Rotating-partner pairings for individual leagues

**Story.** As the organizer of an individual-player league, I want weekly doubles pairings that rotate partners so that nobody plays together twice before everyone has played together once.

**Acceptance criteria**
- Given 8 players, when I generate week 1 through week 7 pairings, then no two players are partners twice until every player has partnered with every other.
- Given an odd number of players, when I generate a week, then the player who sits is one who has sat the fewest times so far. *(edge)*
- Given fewer than 4 players, when I try to generate doubles, then I am refused with "Doubles needs at least 4 players". *(negative)*

**Evidence.** I2-#1, I2-#3, I2-#11 (the definition of "wrong").

### US11 · Record prizes

**Story.** As the organizer, I want to record what prize each finishing position received so that there is a record of where the pot went.

**Acceptance criteria**
- Given final standings, when I record "1st — $200, 2nd — $80, last — a round", then the league's summary page lists them.
- Given I enter a prize for a position that does not exist (e.g. 13th of 12), when I submit, then it is rejected. *(negative)*

**Evidence.** I1-#7; I2-#7.

### US12 · Organize a league event

**Story.** As the organizer, I want to post a one-off event (cookout, end-of-season party) with a date and place so that it isn't lost in the group chat.

**Acceptance criteria**
- Given a league, when I add an event with a title, date and place, then it appears on the public page.
- Given the date is in the past, when I submit, then I am warned before it saves. *(negative)*

**Evidence.** I1-#10 — "That's just a group chat thing."

### US14 · Organizer resets a forgotten password

**Story.** As an organizer who has forgotten my password, I want to reset it from the sign-in page so that I'm not locked out of my league.

**Not in v0.2.0.** Found planning US13: self sign-up with no email confirmation means a forgotten password locks the organizer out for good. A reset needs the app to send email, which PRD §3 rules out this semester (notifications), so it waits for a later release. Acceptance criteria to be written when it's scheduled. Until then, a developer can reset a password from the command line.

---

## Scaffolding (v0.1.0)

Not product stories: runnable stubs so each platform can be built on later (ADR 002). Each stub runs, has one smoke test, and a README with a `TODO:` list of what is not built yet. The backend/frontend pairing is by a shared API contract, defined in a later item.

### SCAF-01 · FastAPI backend stub

**Folder.** `src/backends/fastapi/`

**Scope.** FastAPI + SQLAlchemy (SQLite). `GET /api/health` returns `{"status":"ok"}`. pytest smoke test.

**Acceptance criteria**
- Given a clean clone, when I follow the folder's README, then it installs and starts without error.
- Given it is running, when I run the smoke test, then it passes.
- The README lists what is still `TODO`.

### SCAF-02 · Django backend stub

**Folder.** `src/backends/django/`

**Scope.** Django + Django REST Framework (SQLite). `GET /api/health/` returns `{"status":"ok"}`. `manage.py test` smoke test.

**Acceptance criteria**
- Given a clean clone, when I follow the folder's README, then it installs and starts without error.
- Given it is running, when I run the smoke test, then it passes.
- The README lists what is still `TODO`.

### SCAF-03 · Next.js web frontend stub

**Folder.** `src/frontends/web/`

**Scope.** Next.js (React, TypeScript). Home page shows "Rec League Manager" and the backend health from `NEXT_PUBLIC_API_URL`. Smoke test.

**Acceptance criteria**
- Given a clean clone, when I follow the folder's README, then it installs and starts without error.
- Given it is running, when I run the smoke test, then it passes.
- The README lists what is still `TODO`.

### SCAF-04 · Streamlit frontend stub

**Folder.** `src/frontends/streamlit/`

**Scope.** Streamlit app showing the same placeholder and backend health. `AppTest` smoke test.

**Acceptance criteria**
- Given a clean clone, when I follow the folder's README, then it installs and starts without error.
- Given it is running, when I run the smoke test, then it passes.
- The README lists what is still `TODO`.

### SCAF-05 · Supabase self-hosted backend stub

**Folder.** `src/backends/supabase/`

**Scope.** Docker Compose for the open-source Supabase stack (ADR 001), `.env.example` with dummy keys only, empty `migrations/`. No cloud account.

**Acceptance criteria**
- Given a clean clone, when I follow the folder's README, then it installs and starts without error.
- Given it is running, when I run the smoke test, then it passes.
- The README lists what is still `TODO`.

### SCAF-06 · Firebase Emulator backend stub

**Folder.** `src/backends/firebase/`

**Scope.** `firebase.json` for the Auth, Firestore and Hosting emulators, deny-all `firestore.rules`. Emulator only (ADR 001).

**Acceptance criteria**
- Given a clean clone, when I follow the folder's README, then it installs and starts without error.
- Given it is running, when I run the smoke test, then it passes.
- The README lists what is still `TODO`.

### SCAF-07 · Flutter frontend stub

**Folder.** `src/frontends/flutter/`

**Scope.** Flutter (web + mobile) placeholder screen showing backend health. Widget smoke test.

**Acceptance criteria**
- Given a clean clone, when I follow the folder's README, then it installs and starts without error.
- Given it is running, when I run the smoke test, then it passes.
- The README lists what is still `TODO`.

### SCAF-08 · Any frontend works with any backend

**Folder.** `src/` (all seven stubs) and `src/README.md`.

**Scope.** One REST contract that every backend serves (ADR 003): `GET {API_URL}/api/health` returns `{"status":"ok"}` and `GET {API_URL}/api/backend` returns `{"backend":"<name>"}` (fastapi, django, supabase or firebase), both allowing cross-origin requests. Supabase serves them from an Edge Function, Firebase from a Cloud Function. Each frontend says "Hello from <backend>". `src/README.md` has the 4 × 3 table of combinations and how to start each half.

**Acceptance criteria**
- Given any of the four backends is running, when I run `src/contract-test.sh <API_URL>`, then it passes.
- Given any backend and any frontend from the table are running, when I open the frontend, then it shows "Hello from <backend name>".
- Given a frontend running in a browser (web, Flutter), when it calls a backend on another port, then the call is not blocked by CORS.
- Given `src/README.md`, when I read it, then it has a 4 × 3 table with the `API_URL` for every pairing and the commands to start each backend and frontend.

### SCAF-09 · FastAPI tests warn that `httpx` with Starlette's TestClient is deprecated

**Found while doing** SCAF-08. `pytest` in `src/backends/fastapi` prints `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead`. Tests pass; this is a pin to revisit before the warning becomes an error.

**Acceptance criteria**
- Given a fresh install from `requirements.txt`, when I run `.venv/bin/python -m pytest`, then it passes with no deprecation warning.

### SCAF-10 · Every backend has its own port

**Folder.** `src/backends/django/` and the docs that list ports.

**Scope.** FastAPI and Django both default to port 8000, so only one can run at a time. Move Django's default to 8001 so all four backends can run side by side: FastAPI 8000, Django 8001, Firebase 5000, Supabase 54321. Frontends keep defaulting to FastAPI on 8000.

**Acceptance criteria**
- Given a clean clone, when I run `.venv/bin/python manage.py runserver` in `src/backends/django`, then it listens on 8001 without my passing a port.
- Given all four backends are running at once, when I run `src/contract-test.sh` against each one's `API_URL`, then all four pass.
- Given `src/README.md`, `CLAUDE.md`, ADR 003 and the Django README, when I read them, then they give Django's `API_URL` as `http://localhost:8001` and no longer say to run one Python backend at a time.

### SCAF-11 · Flutter runs in the Android emulator

**Folder.** `src/frontends/flutter/` and `src/README.md`.

**Scope.** The Flutter stub runs on an Android emulator against any of the four backends. Inside the emulator `localhost` is the emulator itself, so the host's backends are at `10.0.2.2` (e.g. Django is `http://10.0.2.2:8001`). Android blocks plain `http://` by default, so the debug build allows it; release builds don't. The release manifest gets the `INTERNET` permission, which only the debug manifest has today.

**Acceptance criteria**
- Given the Android emulator is running and a backend is up, when I run `flutter run --dart-define=API_URL=http://10.0.2.2:<port>` from `src/frontends/flutter`, then the app opens in the emulator and says "Hello from <backend>".
- Given each of the four backends in turn, when I point the emulator app at it, then it says hello from that backend.
- Given a release build, when I inspect its manifest, then it requests `INTERNET` and does not allow cleartext traffic. *(negative)*
- Given `src/README.md`, when I read the Flutter section, then it says how to start the emulator and which `API_URL` to use for each backend from the emulator.

### SCAF-12 · Every backend says hello to a name

**Folder.** `src/backends/*` and `src/contract-test.sh`.

**Scope.** A second contract route (ADR 003) that takes input: `GET {API_URL}/api/hello?name=<name>` returns `{"message":"Hello <name>"}`. A missing or blank name is refused with `400 {"error":"Name is required"}`. Surrounding spaces are trimmed. Backends only; no frontend screen yet.

**Acceptance criteria**
- Given any backend is running, when I open `/api/hello?name=Mike`, then I get `200 {"message":"Hello Mike"}`.
- Given a name with spaces or accents (`Ada Lovelace`, `José`), when I ask, then the reply has the name exactly as sent.
- Given no `name`, or a blank one, when I ask, then I get `400 {"error":"Name is required"}`. *(negative)*
- Given any backend, when I run `src/contract-test.sh <API_URL>`, then it checks all of the above and passes.

### SCAF-13 · Flutter asks the backend to say hello

**Folder.** `src/frontends/flutter/`.

**Scope.** Under "Hello from <backend>", a text box labelled "Your name" and a "Say hello" button. Pressing the button (or Enter) calls `GET /api/hello?name=` (SCAF-12) on whichever backend `API_URL` points at and shows the reply. The app does not validate the name itself; it shows whatever the backend says.

**Acceptance criteria**
- Given I type "Mike" and press Say hello, then the screen shows "Hello Mike", as returned by the backend.
- Given I leave the box blank and press Say hello, then the screen shows "Name is required", from the backend. *(negative)*
- Given the backend is unreachable, when I press Say hello, then the screen says "Can't reach the backend at <API_URL>". *(negative)*
- Given any of the four backends, in Chrome or the Android emulator, when I do the above, then it works the same.

### SCAF-14 · Web and Streamlit ask the backend to say hello

**Folder.** `src/frontends/web/`, `src/frontends/streamlit/`.

**Scope.** The same feature as SCAF-13 in the other two frontends: under "Hello from <backend>", a "Your name" box and a "Say hello" button (Enter does the same) that call `GET /api/hello?name=` and show the reply. The frontend sends the name as typed and shows whatever the backend says.

**Acceptance criteria**
- Given I type "Mike" and press Say hello, then the screen shows "Hello Mike", as returned by the backend.
- Given I leave the box blank and press Say hello, then the screen shows "Name is required", from the backend. *(negative)*
- Given the backend is unreachable, when I press Say hello, then the screen says "Can't reach the backend at <API_URL>". *(negative)*
- Given either frontend and any of the four backends, when I do the above, then it works the same.

### SCAF-15 · Flutter is web-only

**Folder.** `src/frontends/flutter/`, `src/backends/django/`, `src/README.md`, `CLAUDE.md`, `docs/03-architecture.md`.

**Scope.** Reverses SCAF-11. The Android emulator needs nested virtualization and several GB of RAM and disk, more than a student laptop or this VM can spare alongside the backends. Flutter's point here (one codebase, a different toolchain) is still made in Chrome. Delete the `android/` platform folder and `test/android_manifest_test.dart`; remove the emulator and `10.0.2.2` instructions from the docs; drop `10.0.2.2` from Django's `ALLOWED_HOSTS`, which was there only for the emulator. Android can come back later with `flutter create --platforms=android .`.

**Acceptance criteria**
- Given a clean clone, when I run `flutter run -d chrome --dart-define=API_URL=http://localhost:8000` in `src/frontends/flutter`, then the app opens in Chrome and says "Hello from fastapi".
- Given `src/frontends/flutter`, when I list it, then there is no `android/` folder, and `flutter analyze && flutter test` pass.
- Given `src/README.md`, `CLAUDE.md`, the Flutter README and `docs/03-architecture.md`, when I read them, then none tells me to start an Android emulator or use `10.0.2.2`. *(negative)*
- Given Django is running, when a request arrives with `Host: 10.0.2.2:8001`, then it is refused with 400. *(negative)*

---

## Polish found building v0.2.0 (not scheduled)

Minor findings from the per-story and whole-branch reviews of the FastAPI + web reference build. None breaks an acceptance criterion; each is a candidate for a later release. Label `polish` when one is scheduled.

### POL-01 · Backend hardening (FastAPI)
- Warn at startup when `JWT_SECRET` is unset (belongs with REL-01 deploys).
- An email of just `@` passes the "has an @" rule.
- Login still accepts a password over 72 bytes on FastAPI (bcrypt truncates it) and Supabase (GoTrue truncates it), while Django refuses it; refuse it with `401 Email or password is incorrect` on all three (the signup half is done, US13-01).
- Login answers faster for an unknown email than a wrong password (bcrypt skipped), which reveals whether an account exists.
- On FastAPI, Django and Supabase the entrant duplicate check isn't enforced by the database, so two simultaneous adds could both pass. (Firebase does the check and the insert in one Firestore transaction, so it is not affected.)
- A slug collision that survives every retry answers 409 "Could not create the league, try again", which isn't in the contract.
- `DATABASE_URL`'s default is relative to the working directory.
- The public and standings routes repeat the same load-and-compute block.
- FastAPI and Django both accept the non-JSON constants `NaN`/`Infinity` in a body (Python's `json` allows them); the JS backends refuse them as `400 Invalid request`. Both Python backends should refuse them too.
- Supabase's sign-in service refuses some addresses that contain an `@` (such as `a@`), answering "Enter a valid email address" where FastAPI and Django accept them.
- Firebase's Auth emulator, like Supabase's, refuses some addresses that contain an `@` (such as `a@b`).
- Django stores the email in `User.username` (150 characters); longer emails would fail on a database that enforces it (SQLite does not; FastAPI allows 320).
- Django answers an unknown URL outside `/api/` with its HTML 404 page.
- The Supabase email check uses JavaScript `trim()`, FastAPI and Django use Python `strip()`; they differ on U+FEFF (JS trims it, Python does not) and on `\x1c`-`\x1f` (Python strips them, JS does not).
- `src/backends/supabase/test.sh` puts `ANON_KEY` on the `docker run` command line, where `ps` and `docker inspect` show it; pass it through the environment or an env file.
- The live Supabase tests (`live_test.ts`) leave their users, leagues and games behind in the local database.
- The live tests' check that the anon key is refused asserts a loose status range, not the exact status.
- GoTrue rate-limiting (429) on signup or login is answered as 500 "The backend had a problem"; it should be a 4xx the frontends can show.
- Signup on a Supabase stack with email auto-confirm turned off answers 500, because GoTrue returns no session.
- On Supabase, the 409 "scores are recorded" guard on schedule replace is checked in a separate request from the replace, so a score saved in between slips through; move the guard into `replace_schedule`.
- Supabase reads that need two requests (a league, then its entrants or games) can see two different moments; fold them into one query or one function. Firebase has the same shape: `allowTies` is read outside the score transaction, and the list, standings and public routes read the league, entrants and schedule non-transactionally (harmless today: nothing changes `allowTies` and entrants are append-only).
- Firebase: calls to the Auth emulator have no timeout; a hung emulator holds the request until the function's 60 s limit.
- A deleted user's Supabase access token still works until it expires (up to an hour); decide whether that is acceptable or whether the function should check the user exists.
- Firebase: any body sent as `application/json` that isn't a JSON object (malformed, or `5`, `"x"`, `null`, `true`) is refused by the Cloud Functions runtime's own body parser with an HTML 400 page without CORS headers before our code runs, so it is not `{"error": "Invalid request"}`; clients must send no body and no `Content-Type` on routes that take none. `contract-test.sh` sends only `[]` as non-object JSON, so it does not catch it. Needs a decision (a proxy in front, or accept and document).
- Supabase and Firebase standings sort ties by UTF-16 code units, FastAPI and Django by code points; they differ for names mixing characters above U+FFFF with U+E000-U+FFFF.

- Supabase: anyone holding a self-hosted install's anon key can sign up straight through GoTrue (`/auth/v1/signup`) with a 6-character password, skipping the contract's 8-character rule; set `GOTRUE_PASSWORD_MIN_LENGTH=8`.
- Supabase: the tables have no CHECK constraints, so an organizer's own token sent straight to PostgREST can write invalid rows (weeks 0, negative or half-entered scores, a game against itself); a self-play game makes that league's public page answer 500. Mirror the validation in `check` clauses.
- The contract doesn't fix the order of the body rule and the 401 check for a request that is both malformed and unauthenticated; backends differ.
- Supabase: Edge Function imports are unpinned (`npm:@supabase/supabase-js@2`, `jsr:@panva/jose@6`); pin exact versions.
- Supabase: `scheduleRoutes` lives in `scores.ts` while `schedule.ts` holds only the pure functions; the `standings.ts` comment says "code point order" but the code compares UTF-16 code units.

### POL-02 · Web screens
- The weeks-change message on the Schedule tab uses the error colour although it is information.
- No feedback after "Clear all scores" succeeds.
- The Standings tab is blank while it loads.
- An empty `<p>` renders on the league home when sport and season are both blank.
- The organizer header ignores a non-sign-in failure from `/auth/me`.
- The entrant form is still usable when the entrant list failed to load.
- The stale-schedule notice hides a failed entrants fetch silently.
- Save's accessible name ("Save A vs B") differs from its visible text.
- When browser storage is blocked, signing in bounces back to `/signin` with no message.
- The red message on the Schedule tab (for example a failed single-game save) stays on screen after a later single-game clear succeeds.
- Flutter: the league home's public link (`SelectableText`) isn't exposed to screen readers; once, a 409 refusal under Generate was missing from the accessibility tree although visible.
- Flutter: the game-line format ("A 21 – 14 B" / "A vs B" / "A — bye") is written twice (`public.dart` and `schedule.dart`).

### POL-03 · Tests
- No test that the league home redirects without a token; no web test of the T cell value with ties on; the public page's ties and blank sport/season branches are untested.
- A few weak assertions (the "no league content" check on sign-in, the one-row entrant layout check by class name).
- The contract test leaves extra "Tiny" and "Odd" leagues behind on the target backend.
- Firebase: the Firestore transactions (score and entrant writes) and the two-step slug lookup are only exercised live, not in unit tests (the in-memory store has no transactions); three FastAPI coverage cases have no JS counterpart, and the text rule is only tested through `name`.
- Flutter tests: the 375 px width assertions in the standings and public tests can't fail (they check against the parent's width); assert the table's own width or the scroll extent instead.

## Releases and delivery

Not features. These are how the project is shipped and shown.

### REL-01 · Every release is deployed so students can watch the app evolve

**Why.** This is a reference example. Students learn as much from seeing how the app changes between releases (v0.2.x, v0.3.x, …) as from the final version. Each release should stay viewable at its own address after the next one ships.

**Decided 2026-10-27 (ADR 005), scheduled for v0.2.1.**
- **Pairing:** FastAPI + web only. Supabase and Firebase stay local-only (ADR 001); the other pairings are a clone away.
- **Host:** free tiers, $0. Web on Vercel Hobby (always on). FastAPI on Render Free: it sleeps after 15 idle minutes, takes about 50 s to wake, and its disk is wiped whenever it sleeps or redeploys.
- **Addresses:** one pair per release, kept side by side, on the platforms' own free subdomains (`rlm-v0-2-1.vercel.app`, `rlm-api-v0-2-1.onrender.com`). sslip.io names were the first pick, but they need a server IP we control and PaaS gives none.
- **Data:** every start seeds a demo organizer and "Tuesday Cornhole"; sign-up stays open; a nightly redeploy resets everything. A student's own data also disappears after 15 idle minutes, and the README says so.

### REL-01a · The API can seed its own demo league — #55

**Acceptance criteria**
- Given `DEMO_SEED=1` and an empty database, when `python -m app.seed` runs, then `demo@recleague.example` can sign in and owns "Tuesday Cornhole" (Joe's Tavern, Cornhole, Fall 2026) with 6 teams, a generated schedule (5 weeks) and week 1 scored, and its public link is `/l/tuesdy`.
- Given any organizer already exists, when the seed runs again, then nothing changes. *(edge)*
- Given `DEMO_SEED` is not `1`, when the seed runs, then nothing is created. *(negative)*

### REL-01b · Deploy config, nightly reset and runbook — #56

**Acceptance criteria**
- Given `render.yaml` on a release branch, when it is applied as a Render Blueprint, then one free web service for that release builds FastAPI, seeds it and answers `/api/health`.
- Given the nightly-reset workflow, when it runs (on schedule or by hand), then every listed release's API redeploys and comes back with only the seed.
- Given `docs/deploy.md`, when someone follows it for a new release, then they can stand up that release's API and web app without touching older releases.

### REL-01c · v0.2.1 is live — #57

**Acceptance criteria**
- Given the live web URL on a 375-px phone, when the PRD demo runs (sign up, create a league, 6 teams, generate, score week 1, open the public link signed out), then it completes with no horizontal scroll.
- Given the live API, when `src/contract-test.sh` runs against it, then it prints `contract ok`.
- Given the root `README.md`, then it lists the live URL, the demo sign-in, the public link and the cold-start warning.

---

## Cut in the edit pass

| Was | Why it's gone |
|---|---|
| *Players create accounts and report their own scores* (drafted as Must) | Nobody said it. Both interviews said the **opposite** — I1-#12 "if I have to make everyone sign up for something", I2-#9 "wanted everybody to make an account… that was the end of that." Player accounts are now a **non-goal**, not a postponed feature. |
| *Collect dues in the app* (drafted as Must, with payment processing) | I1-#8 "God no. I don't want to be a bank. I just want to know who paid." Rewritten as **US08 · Track who has paid** and moved to Should. In-app payments go to Won't. |

---

## MoSCoW

| Must | Should | Could | Won't (and why) |
|---|---|---|---|
| US13 sign up | US08 track who paid | US11 prizes | **In-app payments / moving money.** Both organizers refused it (I1-#8). Holding other people's money adds processing fees, refunds and liability — for a volunteer's league. *Not this semester, and possibly never.* |
| US01 sign in | US09 playoff bracket | US12 events | **Player accounts.** Contradicted by every interview. Public read-only link is the whole design. |
| US02 create league | US10 rotating pairings | | **Notifications (email/SMS).** Nobody asked; the group chat already does this and does it fine. |
| US03 add entrants | | | **Multi-organizer / co-admins.** Every league interviewed has exactly one organizer. |
| US04 round-robin schedule | | | |
| US05 record score | | | |
| US06 standings | | | |
| US07 public link | | | |

**Why Should isn't Must.** US08 is the most-complained-about problem, but the league can run without it — Dana is already chasing people on Venmo, and a paid checkbox doesn't change the demo. US09 and US10 are real but they are each a second scheduling algorithm; the MVP proves one first.

## MVP slice

**US13 → US01 → US02 → US03 → US04 → US05 → US06 → US07.** Same as the Must column this time, and that's the ceiling — if Week 11 runs long, US03's phone-layout AC and US04's "regenerate" AC are the first things to drop, not a whole story.

The demo: sign up, sign in, create "Tuesday Cornhole", add 6 teams, generate the schedule, enter week 1 scores, open the public link on a phone and see standings. Nothing in that recording requires "imagine it saves."

## Break-test results (Lab 3 §5)

Partner ran the literal-reader attack on US04 and US06:

- **US04, original AC 1** said "every entrant plays every other entrant." A schedule with every pair meeting *twice* satisfied it. Fixed: "every pair of entrants meets **exactly once**."
- **US06, original AC 1** said "sorted by wins." Two entrants on 4–1 in arbitrary order satisfied it. Fixed: tiebreak order is now specified (W → Diff → PF) and must be printed on the page.
