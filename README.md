# Rec League Manager

**Rec League Manager** lets league organizers manage the people, games, schedules and standings for recreational leagues — pitch, pickleball, darts, cornhole, volleyball, parcheesi and more. It offers easy ways to collect money, distribute prizes, and organize events.

> **This is the reference implementation for IST300 — Prompts to Products.** It is laid out the way the course asks you to lay out your own capstone repository: the thinking in `docs/`, the code in `src/` (from Week 9), the tests in `tests/` (from Week 13), and a commit history that shows the decisions. Read it as a model, not as a template to copy.

## Who it's for

The volunteer who runs a rec league — the person who made the spreadsheet, started the group chat, and is now chasing eight people for $20 the night before the season starts. They are not a developer. They do this on a phone between games and on a laptop on Sunday night.

## One product, several platforms

Your capstone is built once, on one stack. This one is different: because it's the reference implementation, the **same product** — same concept brief, same interviews, same backlog, same PRD — will be built on each of the back-end options the course puts in front of you in Week 7. The `docs/` are shared, because the product doesn't change. Only the *how* changes, and that's the point: you can open two folders side by side and see what a stack decision actually costs and buys.

Implementations live under `src/` in two families — **backends** and **frontends** (see [`docs/decisions/002`](docs/decisions/002-backends-and-frontends-structure.md)). Each folder runs on its own with only its own README; a frontend needs a backend to talk to. **Any frontend works with any backend**: every backend serves the same REST API ([`docs/decisions/003`](docs/decisions/003-one-rest-contract-for-every-backend.md)), and [`src/README.md`](src/README.md) shows how to start all 12 pairings.

### Backends

| Folder | Stack | Where the data lives | How the organizer signs in | What it's here to show |
|---|---|---|---|---|
| `src/backends/fastapi/` | Python · FastAPI · SQLAlchemy | SQLite file | Hashed password you manage yourself | The "build it yourself" baseline. Every piece is visible. The most to learn, and the most to get wrong. |
| `src/backends/django/` | Python · Django · Django REST Framework | SQLite (Postgres with one setting) | Django's built-in auth | Batteries included: auth, migrations and admin arrive for free; the cost is Django's way of doing things. |
| `src/backends/supabase/` | **Self-hosted Supabase** (open-source stack, Docker) | Postgres with row-level security | Supabase Auth (GoTrue) | A managed-style back end, run on your machine, not Supabase's cloud. The API is a thin Edge Function over Postgres. |
| `src/backends/firebase/` | **Firebase Emulator Suite** (local only, no Google project) | Firestore (document database) | Auth emulator | The same managed shape with a document store: the API is a Cloud Function over Firestore, and a different answer to "how do I compute standings?" |

### Frontends

| Folder | Stack | What it's here to show |
|---|---|---|
| `src/frontends/web/` | Next.js · React · TypeScript | The mainstream phone-first web UI. |
| `src/frontends/flutter/` | Flutter (web + mobile) | One codebase for web and native; a different toolchain from the web. |
| `src/frontends/streamlit/` | Python · Streamlit | The fastest path to a working screen. Great for the organizer's side; awkward for a public, mobile, read-only page — which is the trade-off to see. |

**Both managed-style back ends are fully self-hosted.** `src/backends/supabase/` runs the open-source Supabase stack locally, and `src/backends/firebase/` runs the Firebase Emulator Suite (Firestore, Auth, Hosting). Neither may depend on a hosted Supabase or Firebase account, API keys or cloud project, and each README must explain how to download and start its local stack.

Only stubs exist so far (backlog group *Scaffolding*, v0.1.0). They are recorded here so the stack decision in `CP-M3` has something concrete to argue against.

## Status

Through **`CP-M2`** (Sep 27). Concept brief, interview notes, edited backlog, and the PRD are in. Next: Lab 4 architecture map (Oct 1) and `CP-M3` (Oct 11).

| Milestone | File | State |
|---|---|---|
| `CP-M1` | [`docs/01-concept-brief.md`](docs/01-concept-brief.md) | done |
| W03 | [`docs/research/`](docs/research/) | done |
| Lab 3 | [`docs/backlog.md`](docs/backlog.md) | done |
| `CP-M2` | [`docs/02-prd.md`](docs/02-prd.md) | done |
| `CP-M3` | `docs/03-architecture.md` | not started |
| `CP-M4` | `src/`, `tests/`, `docs/test-plan.md` | not started |

## Live URL

_Not yet — that arrives with the final submission in Week 14._

## How to run it

_Nothing to run yet. Code arrives in Week 9._

## Repository map

```text
rec-league-manager/
├── README.md                 what it is, who it's for, live URL, how to run it
├── CLAUDE.md                 standing context for the agent
└── docs/
    ├── 01-concept-brief.md   CP-M1
    ├── 02-prd.md             CP-M2
    ├── backlog.md            Lab 3 — stories, AC, MoSCoW, MVP slice
    ├── todo.md               what we are doing NOW
    ├── xchangelog.md         what was done
    ├── research/             interview notes — Week 3
    ├── design/               ui notes, wireframes
    └── decisions/            one short file per decision that could have gone the other way
```
