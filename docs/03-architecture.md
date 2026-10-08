# Architecture — `CP-M3`

**Product.** Rec League Manager · **Author.** Michael Fudge · **Version.** 1.0 draft, 2026-10-08 · **Status.** Draft — stubs exist and talk to each other; no product stories are built yet.

**Inputs.** [`02-prd.md`](02-prd.md) (§5 constraints, §7 data shape, §8 open questions) · [`backlog.md`](backlog.md) · ADRs [001](decisions/001-self-hosted-supabase-and-firebase.md), [002](decisions/002-backends-and-frontends-structure.md), [003](decisions/003-one-rest-contract-for-every-backend.md) · [`src/README.md`](../src/README.md) (how to run every pairing).

Like the PRD, every section opens with the question it decides.

---

## 0 · Read this first: this is not a typical architecture document

*Decides: what kind of document is this, and how should a reader use it?*

A capstone's architecture document normally answers one question: **which stack, and why?** It names one frontend, one backend, one database and one host, shows how they connect, and defends the choice against the alternatives that lost.

This repository is the course's **reference implementation**, so it answers a different question: **what does each stack choice cost and buy, side by side?** It builds the same product on four backends and three frontends, held together by one API contract, so any frontend runs against any backend.

| | A typical `03-architecture.md` | This one |
|---|---|---|
| Stacks | One, chosen | Four backends × three frontends = 12 pairings, all working |
| Central claim | "This stack fits this product because…" | "Here is what each stack makes easy or hard, on identical requirements" |
| Rejected alternatives | Listed, with reasons | Built anyway, so the comparison is real |
| API | Whatever the one backend exposes | A contract every backend must pass (ADR 003) |
| Deployed | One live URL | One pairing will be deployed (§10); the rest run locally |

**If you are writing your own capstone, model your document on §1, not on the rest.** §2 onward is what happens when the point of the project is the comparison.

## 1 · What a typical architecture document contains

*Decides: what would this file look like if the project had one stack?*

A one-stack document decides these things, usually in this order. The last column is a worked example of how this project would have filled it in had it picked one pairing: Next.js on FastAPI, the most conventional of the twelve.

| Section | What it decides | Worked example (one-stack version) |
|---|---|---|
| **Components** | The boxes and the arrows between them | Phone browser → Next.js web app → FastAPI JSON API → SQLite file |
| **Stack and versions** | Each layer's technology, pinned | Next.js 15 · React 19 · TypeScript 5 / FastAPI 0.142 · SQLAlchemy 2.1 · Python 3.12 / SQLite |
| **Data model → storage** | How PRD §7's things become tables or documents | Tables `organizer`, `league`, `entrant`, `game`; standings is a query, not a table |
| **API** | Routes, request and response shapes, error format | `GET /api/leagues/{slug}`, `POST /api/leagues/{id}/schedule`, … errors as `{"error": "…"}` |
| **Auth** | Who signs in, how, what a session is | Organizer email + hashed password; a signed token; players never sign in |
| **Hosting** | Where it runs and how it gets there | One host for the API and database, one for the web app; the live URL in the README |
| **Constraints** | How each PRD §5 constraint is met | Phone-first layout, no write controls on the public page, standings computed per request, … |
| **Alternatives rejected** | What else was considered and why it lost | "Django: more built in than we need" · "Firebase: standings need joins" |
| **Risks** | What could sink it, and the plan | "Round-robin bugs" → unit tests for even, odd, 2 and fewer-than-2 entrants |

A good one-stack document is short. It names the choice, shows it meets the PRD, and says what was traded away.

## 2 · Why this project builds several stacks

*Decides: why not just pick one?*

- **It's a teaching reference.** Students choose among these stacks in Week 7. A side-by-side build on the same requirements shows what a choice actually costs (ADR 002), which a paragraph of pros and cons can't.
- **The product doesn't change, only the how.** The concept brief, interviews, backlog and PRD are shared. Every implementation must satisfy the same PRD (§5: "This document has to be true for every implementation under `src/`").
- **No accounts, no cost.** Supabase and Firebase run fully self-hosted (ADR 001), so anyone can clone and run all twelve pairings offline.

The concept brief guessed "Python + Flask + SQLite". That guess became this matrix.

## 3 · The shape

*Decides: what are the parts, and how do they connect?*

```text
   frontends (src/frontends)                     backends (src/backends)
 ┌──────────────────────────┐                  ┌──────────────────────────────────────┐
 │ web        Next.js       │                  │ fastapi   FastAPI ─────────► SQLite   │
 │ streamlit  Streamlit     │  GET {API_URL}   │ django    Django + DRF ────► SQLite   │
 │ flutter    Chrome or     │ ───/api/...────► │ supabase  Edge Function ───► Postgres │
 │            Android       │ ◄───── JSON ──── │ firebase  Cloud Function ──► Firestore│
 └──────────────────────────┘                  └──────────────────────────────────────┘
        knows only API_URL                       every one passes src/contract-test.sh
```

The single rule that makes the matrix work: **a frontend knows only `API_URL`.** It never knows, or branches on, which backend answers. Swapping backends is a change of one environment variable.

## 4 · The contract between frontends and backends

*Decides: what exactly does every backend promise?* (ADR 003)

| Route | Response |
|---|---|
| `GET /api/health` | `200 {"status": "ok"}` |
| `GET /api/backend` | `200 {"backend": "fastapi"}` — or `django`, `supabase`, `firebase` |
| `GET /api/hello?name=Mike` | `200 {"message": "Hello Mike"}` (name trimmed) |
| `GET /api/hello` with no or blank name | `400 {"error": "Name is required"}` |

Rules that apply to every route, present and future:

- **JSON in, JSON out.** Errors are `{"error": "<message for a person>"}` with a 4xx status, and every backend uses the same status and message for the same mistake. Frontends show the backend's message rather than writing their own.
- **Cross-origin is allowed** (CORS, any origin), because the web and Flutter apps run in a browser on a different port from the backend.
- **No trailing-slash surprises.** Django, whose convention is a trailing slash, accepts both forms without redirecting.
- **`src/contract-test.sh <API_URL>` is the definition of "conforms".** A new route goes into the table above (kept in `src/README.md`), into all four backends, and into the contract test, in the same change.

Product routes (leagues, entrants, schedule, scores, standings) will be added to this contract story by story.

## 5 · Backends

*Decides: what is each backend built from, and what is it here to show?*

| | **fastapi** | **django** | **supabase** | **firebase** |
|---|---|---|---|---|
| Language | Python 3.12 | Python 3.12 | TypeScript (Deno) for the API; SQL for data | JavaScript (Node 18) |
| Framework | FastAPI 0.142, Uvicorn 0.54 | Django 5.2, DRF 3.18 | Supabase self-hosted: Edge Runtime 1.76, Postgres 17.6, GoTrue 2.196, PostgREST 14.17, Envoy gateway | Firebase Emulator Suite (firebase-tools 13.35): Functions (firebase-functions 6.6), Firestore, Auth, Hosting |
| Where data will live | SQLite file via SQLAlchemy 2.1 | SQLite via the Django ORM (Postgres is one setting) | Postgres, with row-level security | Firestore (documents, no joins) |
| How it serves the contract | FastAPI routes | DRF views | One Edge Function, `api` | One Cloud Function, `api`, behind a Hosting rewrite of `/api/**` |
| Sign-in (US01, planned) | Hashed password + token we write | Django's built-in auth | Supabase Auth (GoTrue) | Auth emulator |
| Port / `API_URL` | 8000 / `http://localhost:8000` | 8001 / `http://localhost:8001` | 54321 / `http://localhost:54321/functions/v1` | 5000 / `http://localhost:5000` |
| Here to show | Building it yourself: every piece visible, most to get wrong | Batteries included: auth, migrations, admin for free, at the price of Django's way | A managed platform's shape on Postgres, run on your own machine | The same managed shape on a document store, and a different answer to "where are standings computed?" |

**What the contract cost Supabase and Firebase.** Both are designed for the browser to talk to the database directly through their client SDKs. Here they instead run a small server function that serves the shared API (ADR 003). That's what lets one client per frontend work, but it means writing server code on platforms marketed as "no server", and it makes row-level security and `firestore.rules` a second line of defence rather than the only one.

**What each backend will repeat.** The round-robin scheduler and the standings calculation will exist four times: twice in Python, once in TypeScript and once in JavaScript. Shared logic (`src/core/`) is deferred (ADR 002); the contract test, plus each backend's unit tests for the PRD's scheduling cases, is what keeps the four honest. FastAPI and Django could later share one Python package.

## 6 · Frontends

*Decides: what is each frontend built from, and what is it here to show?*

| | **web** | **streamlit** | **flutter** |
|---|---|---|---|
| Stack | Next.js 15.5, React 19.1, TypeScript 5.9 | Streamlit 1.64, `requests` 2.34, Python 3.12 | Flutter 3.44 (Dart), `http` 1.6 |
| Runs in | A browser | A Python server that renders to a browser | A browser (Chrome) or Android (emulator, API 36) |
| Calls the backend from | The browser, so it needs CORS | The Streamlit server, so CORS doesn't apply | The browser or the phone |
| `API_URL` is set by | `NEXT_PUBLIC_API_URL`, baked in at build/dev start | `API_URL` env var at start | `--dart-define=API_URL=…` at build |
| Port | 3000 | 8501 | chosen by Flutter, or `--web-port` |
| Tests | Vitest + Testing Library | Streamlit `AppTest` + pytest | `flutter test` (widget + unit) |
| Here to show | The mainstream phone-first web UI | The fastest path to a working screen; awkward for a public, mobile, read-only page | One codebase for web and native; a different toolchain |

Each frontend has one small API client (`app/api.ts`, `api.py`, `lib/api.dart`) and nothing backend-specific. All three currently show "Hello from <backend>" and a name box whose **Say hello** button calls `/api/hello`.

**Android specifics.** Inside the emulator, `localhost` is the emulator itself; the host machine is `10.0.2.2`. Debug builds allow plain `http://` for local backends; release builds refuse it (a test guards this).

## 7 · Twelve pairings, and how we know they work

*Decides: what does "any frontend works with any backend" mean in practice, and how is it checked?*

Every cell in the 4 × 3 table in [`src/README.md`](../src/README.md) is a supported pairing, started with one backend command and one frontend command. "Works" is checked at three levels:

1. **The backend conforms:** `src/contract-test.sh <API_URL>` passes against each running backend.
2. **The client works against a live backend:** each frontend has an opt-in live test (`LIVE_API_URL=… LIVE_BACKEND=…`) that calls the real routes.
3. **The screen works:** the web and Flutter apps have been driven in headless Chrome and the Android emulator, and Streamlit's app run live, against every backend.

All four backends can run at once, each on its own port.

## 8 · How the PRD's constraints are met

*Decides: does every implementation honour PRD §5, and how?*

| PRD §5 constraint | How the architecture meets it | State |
|---|---|---|
| Phone-first, 375 px | Each frontend's job; Flutter also runs natively on Android | Not built (no product screens yet) |
| Public means public | Public routes need no token; the public page exposes no write route | Not built |
| Standings derived, never stored | Computed per request: in Python (FastAPI, Django), in a Postgres view or the Edge Function (Supabase), inside the Cloud Function (Firebase). No standings table or collection anywhere | Not built; the rule is fixed here |
| Schedule correctness tested | Each backend unit-tests its scheduler on the PRD's cases; the contract test checks the API shape | Not built |
| Empty and error states | Errors are defined in the contract and shown as the backend sends them | In place for the current routes |
| Runs from the repo | Every stub runs from its README; `src/README.md` covers all pairings | Done |
| Data survives restarts | SQLite files (FastAPI, Django) and the Postgres volume (Supabase) persist. **The Firestore emulator forgets everything on exit** unless started with `--import`/`--export-on-exit` | Gap for Firebase; on its README's TODO |

## 9 · Decisions the PRD handed to this document

*Decides: the open questions PRD §8 assigned to `CP-M3`.*

These follow the PRD's stated leans and are **proposed** until the next PRD revision accepts them.

| Question (PRD §8) | Proposed decision | Why |
|---|---|---|
| Is "sport" a controlled list or free text? | **Free text.** | Nothing in the architecture depends on the sport; no story has per-sport rules. |
| Does the public identifier need to be unguessable? | **A short random slug** (e.g. 8 characters), never the database id. | Works the same in SQL and Firestore; stops casual enumeration of leagues. |
| How is a bye stored? (PRD §7) | **A game with no away entrant.** | The schedule then lists byes explicitly ("Bag Ladies — bye"), and "no bye twice" is testable from the games alone. |
| Where does data persist? (PRD §5) | Per backend, as in §5's table. | The point of the matrix. |

## 10 · Still open

*Decides: what architecture questions remain, and when must they be answered?*

| Question | Why it matters | Resolve by |
|---|---|---|
| How does the organizer's sign-in work across the contract? | Each backend issues tokens differently; the contract must say what a frontend sends back (ADR 003). | Before US01 is built. |
| Which pairing is deployed for the live URL? | The final hand-in needs one live URL. The Firebase emulator is not a production host (ADR 001), so a deployed Firebase or Supabase would need a cloud account the course otherwise avoids. | Before `CP` (Dec 11). Lean: web on FastAPI or Django. |
| Node 18 | Out of support since April 2025; it pins Next.js to 15 and `firebase-tools` to 13. | Before deployment. Move to Node 22. |
| Shared logic (`src/core/`) | Four schedulers can drift. | Revisit after US04 exists in two backends. |

## 11 · Risks

*Decides: what could make the comparison fail, and what's the plan?*

| Risk | Plan |
|---|---|
| Twelve pairings multiply the work of every story | Build each story on one pairing first (web on FastAPI), then port; the contract test tells you when a port is done. |
| Backends drift apart | One contract, one contract test, run against all four before a story is called done. |
| The comparison becomes unfair (one backend gets more care) | Same routes, same tests, same error messages for every backend. |
| Local-only stacks hide deployment problems | §10's deployment decision is due well before the final week. |

---

## Change log

| Date | Change | Why |
|---|---|---|
| 2026-10-08 | v1.0 draft — typical vs this project's structure; contract, backends, frontends, constraints, PRD hand-offs | `CP-M3` |
