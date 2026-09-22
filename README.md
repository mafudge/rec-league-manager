# Rec League Manager

**Rec League Manager** lets league organizers manage the people, games, schedules and standings for recreational leagues — pitch, pickleball, darts, cornhole, volleyball, and more. It offers easy ways to collect money, distribute prizes, and organize events.

> **This is the reference implementation for IST300 — Prompts to Products.** It is laid out the way the course asks you to lay out your own capstone repository: the thinking in `docs/`, the code in `src/` (from Week 9), the tests in `tests/` (from Week 13), and a commit history that shows the decisions. Read it as a model, not as a template to copy.

## Who it's for

The volunteer who runs a rec league — the person who made the spreadsheet, started the group chat, and is now chasing eight people for $20 the night before the season starts. They are not a developer. They do this on a phone between games and on a laptop on Sunday night.

## One product, several platforms

Your capstone is built once, on one stack. This one is different: because it's the reference implementation, the **same product** — same concept brief, same interviews, same backlog, same PRD — will be built on each of the back-end options the course puts in front of you in Week 7. The `docs/` are shared, because the product doesn't change. Only the *how* changes, and that's the point: you can open two folders side by side and see what a stack decision actually costs and buys.

Each implementation will live in its own folder under `src/`, and each one runs on its own with only its own README.

| Folder | Stack | Where the data lives | How the organizer signs in | What it's here to show |
|---|---|---|---|---|
| `src/flask/` | Python · Flask · SQLAlchemy · Jinja templates | SQLite file | Session cookie, hashed password you manage yourself | The "build it yourself" baseline. Every piece is visible — routing, templates, the database, auth. The most to learn, and the most to get wrong. |
| `src/django/` | Python · Django | SQLite (swaps to Postgres with one setting) | Django's built-in auth | The "batteries included" framework. Admin screens, auth, migrations and forms arrive for free; the cost is learning Django's way of doing things. |
| `src/streamlit/` | Python · Streamlit | SQLite file | A single organizer password in session state | The fastest path from nothing to a working screen. Great for the organizer's side; awkward for a public, mobile, read-only page — which is exactly the trade-off to see. |
| `src/supabase/` | HTML + JavaScript in the browser · Supabase | Postgres, hosted by Supabase, with row-level security | Supabase Auth (magic link) | A **managed back end**: no server code of your own. The database, auth and API are a service you configure rather than software you write. Security rules move into the database. |
| `src/firebase/` | HTML + JavaScript in the browser · Firebase | Firestore (document database) | Firebase Auth (email link) | The other managed back end, with a document store instead of tables. Same "no server" shape as Supabase, different data model — and a different answer to "how do I compute standings?" |

Three of these are Python with a server you run; two are static pages talking to a hosted service. Between them they cover the three debate rounds from Week 7: *managed service vs. build it yourself*, *boring and proven vs. new and capable*, and *what does the agent build best?*

The plan is to build **Flask first**, as the baseline the others are compared against, then the rest in the order above. Shared logic that doesn't depend on the stack — generating a round-robin schedule, computing standings and tiebreaks — will live in `src/core/` so the three Python apps don't each reinvent it. The JavaScript implementations will carry their own copy of that logic; that duplication is itself part of what's being shown.

None of this exists yet. It's recorded here now so the stack decision in `CP-M3` has something concrete to argue against.

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
    ├── research/             interview notes — Week 3
    ├── design/               ui notes, wireframes
    └── decisions/            one short file per decision that could have gone the other way
```
