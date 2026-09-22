# Product Requirements Document — `CP-M2`

**Product.** Rec League Manager · **Author.** Michael Fudge · **Version.** 1.0, 2026-09-27 · **Status.** Living — revised as the build teaches us things (see change log at the end).

**Inputs.** [`01-concept-brief.md`](01-concept-brief.md) · [`research/interview-01.md`](research/interview-01.md), [`research/interview-02.md`](research/interview-02.md) · [`backlog.md`](backlog.md) (stories US01–US12, MoSCoW, MVP slice).

Every section below opens with the question it decides. A section that decides nothing isn't here.

---

## 1 · Problem and user

*Decides: who is this for, and what job are they hiring it to do?*

**The user is the organizer** — one volunteer who runs a recreational league because nobody else would. Dana runs a 12-team, 8-week cornhole league at a brewery (I1). Marcus runs a ~20-player Thursday-morning pickleball league at a park and used to run a two-person-team dart league at a VFW (I2). Different sport, same person: not a developer, doing this on a laptop Sunday night and a phone on league night, and doing it for free.

**The job.** When I'm running a rec league, I want to keep the schedule, scores, standings and who-has-paid straight without it being my whole week, so I can actually play in the league I organized.

**What they do today.** A spreadsheet with formulas that break every season (I1-#1), a group chat where scores are buried under forty other messages (I1-#3), a clipboard and a photo (I2-#2), and Venmo or a coffee can for money (I1-#6, I2-#6). The single most repeated pain is building the schedule by hand and getting it wrong (I1-#5, I2-#8, I2-#11). The single most repeated question is "who do we play next week?" (I1-#4).

**Players are a second audience with one need:** open a link on a phone and see the schedule and standings. Both interviews were emphatic that players will not create accounts (I1-#12, I2-#9). This shapes the whole product — see Non-goals.

## 2 · Goals and success measures

*Decides: how will we know, in December, whether it worked?*

| # | Goal | Measure — observable in the `DD` demo or the live app |
|---|---|---|
| G1 | The organizer never builds a schedule by hand again | Given 5–16 entrants, the app generates a full round-robin in one click with zero repeated pairings and rotating byes. Verified by test, not by eye. |
| G2 | Standings are always right | Every standings row is computed from recorded scores at request time; there is no stored standings table to drift. A deliberately wrong score, corrected, changes standings immediately. |
| G3 | Players stop asking "who do we play?" | The public page shows the current week's games above the fold on a 375-px phone, with no sign-in. Proxy for the real measure (fewer group-chat questions), which we can't observe this semester. |
| G4 | The organizer can run a whole season in it | The `DD` recording walks a season end to end — create, add entrants, schedule, enter scores for at least two weeks, view standings — with no step narrated as "imagine this saves." |
| G5 | It's faster than the spreadsheet | Entering one week of scores for 6 games takes under 2 minutes in the demo. (I1-#12: "if it takes longer than the sheet" is the stated reason to quit.) |

The `DD` defense sentence: *"It worked because a real organizer's season — schedule, scores, standings, public link — ran end to end without a spreadsheet, and the schedule was provably correct."*

## 3 · Non-goals

*Decides: what are we refusing to build, and what does each refusal protect?*

| Non-goal | What it protects |
|---|---|
| **Moving money.** No payments, no Stripe, no Venmo integration. The app records *who has paid*, never *pays*. | Both organizers refused it outright ("I don't want to be a bank," I1-#8). Protects the organizer from fees, refunds and liability, and protects the semester from a payment-processor integration. |
| **Player accounts.** Nobody but the organizer ever signs in. | "That was the end of that" (I2-#9). Protects the one property that makes players actually open the link. |
| **Notifications** — email, SMS, push. | Nobody asked. The group chat already does this. Protects scope. |
| **Multiple organizers or roles.** One organizer per league. | Every league interviewed has exactly one. Protects the auth model from becoming a permissions system. |
| **Live or player-entered scores.** Scores are entered by the organizer, after the fact. | Score entry happens Sunday night in a batch (I1-#2). Protects us from building real-time anything. |
| **Rotating-partner pairings, playoffs, prizes, events** — Should/Could in the backlog. | Real, evidenced, and *not in the MVP slice*. Protects the one scheduling algorithm we must get right (G1) from being one of three. |

These are refusals for this semester, not features on a waiting list. Anything moved back into scope gets a decision record in `docs/decisions/` and a line in the change log.

## 4 · Requirements

*Decides: what must it do? Which of those must it do first?*

Requirements are the stories in [`backlog.md`](backlog.md); this section does not restate their acceptance criteria. It fixes priority and names the slice.

**The MVP slice — build these, in this order, and nothing else until they all work:**

| Story | Requirement | Why this order |
|---|---|---|
| US01 | Organizer signs in | Everything else writes data; writes need a gate. Lab 5 builds this first anyway. |
| US02 | Create a league (name, sport, season, weeks) | The container for everything. |
| US03 | Add entrants — a team or an individual — from a phone | Must exist before scheduling. Phone layout AC is the first thing to drop if time runs out. |
| US04 | Generate a round-robin schedule with rotating byes | **The core of the product.** G1 lives here. |
| US05 | Record a score; re-entering replaces | Input to standings. |
| US06 | Standings computed from scores: W, L, PF, PA, Diff; tiebreak W → Diff → PF, printed on the page | G2 lives here. |
| US07 | Public read-only link, phone-first, no sign-in | G3 lives here. The only screen players see. |

**Should — after the slice is demonstrable end to end, in this order:** US08 (track who paid), US09 (playoff bracket), US10 (rotating-partner doubles).

**Could:** US11 (record prizes), US12 (events). Built only if the Shoulds are done and tested.

**Won't:** in-app payments, player accounts, notifications, co-organizers — see §3.

**Acceptance criteria are the ones in the backlog, verbatim.** The agent builds from those; the test plan (`CP-M4`) maps to them by story and AC number. Two were rewritten after the Lab 3 break-test (US04 "exactly once"; US06 tiebreak order) and that is the level of literalness every AC is held to.

## 5 · Constraints on how it works

*Decides: what must be true of the product regardless of which stories are built?*

| Constraint | Requirement | Traces to |
|---|---|---|
| **Phone-first for both audiences** | Every organizer screen in the MVP slice, and the public page, is usable at 375 px wide with no horizontal scrolling. Desktop is a wider phone, not a different layout. | I2-#4, I2-#10, I1-#4 |
| **Public means public** | The public page needs no sign-in, no cookie, no app install, and exposes no control that writes. | I1-#12, I2-#9 |
| **Standings are derived, never stored** | Standings are computed from game records on every request. No "recalculate" button, no cached table. | I1-#1 (broken formulas), G2 |
| **Schedule correctness is tested, not eyeballed** | Round-robin generation has unit tests for even counts, odd counts (bye rotation), 2 entrants, and the < 2 refusal. | G1, US04 AC |
| **Empty and error states everywhere** | Every screen has a defined empty state ("No games played yet") and every form has a defined error message. Listed per story in the backlog. | Course convention; `CLAUDE.md` |
| **Runs from the repo** | Someone else can clone the repo and run it from the README in under ten minutes. | `CP-M4` definition of "working" |
| **Data survives restarts** | Leagues, entrants, games and scores persist across app restarts. (Where they persist is a `CP-M3` decision, not a PRD one.) | US05, G4 |

Deliberately *not* constrained here: which language, framework, database or host. Those are architecture decisions and belong in [`03-architecture.md`](03-architecture.md). This document has to be true for every implementation under `src/`.

## 6 · The organizer's path through the MVP

*Decides: what does the person actually do, in what order, and what do they see?*

1. **Sign in.** Email + password. Wrong password → same page, one message, nothing leaked. *(US01)*
2. **League list.** Empty state: "No leagues yet — create one." One button. *(US02)*
3. **Create league.** Four fields: name, sport (free text — we don't gate on a sport list), season label, weeks. Validation errors inline. *(US02)*
4. **League home.** Three tabs or sections: **Entrants · Schedule · Standings**, plus a visible "Public link" to copy. *(US03–US07)*
5. **Entrants.** Add by name. Duplicate name in this league → refused with the exact message in US03. Works on a phone in a parking lot. *(US03)*
6. **Schedule.** One button: *Generate schedule*. Fewer than 2 entrants → refused. Existing schedule with no scores → replaced. Any score recorded → refused; the organizer must clear scores first. Result: week-by-week list, byes shown explicitly ("Bag Ladies — bye"). *(US04)*
7. **Enter scores.** Per game, two whole-number fields, Save. Re-save replaces. *(US05)*
8. **Standings.** Table: Entrant · W · L · PF · PA · Diff, sorted W desc, Diff desc, PF desc; the tiebreak order printed under the table. Empty state before any game. *(US06)*
9. **Public page** (no sign-in): this week's games first, then the full schedule, then standings. On a phone, this week's games are above the fold. Unknown league → "League not found." *(US07)*

Wireframes for 4, 6, 8 and 9 land in `docs/design/wireframes/` by Lab 6.

## 7 · What the product must remember

*Decides: what are the things, and how do they relate?* (Shape only — the storage technology is a `CP-M3` decision.)

- **Organizer** — email, password (hashed, never stored plain). Owns leagues.
- **League** — name, sport, season label, number of weeks, a public identifier that is safe to put in a URL. Belongs to one organizer.
- **Entrant** — name; belongs to one league; name unique within the league. A "team" and an "individual" are the same thing to the product — an entrant. (Decided: no separate Player model in the MVP. Rotating-partner doubles, US10, is the first thing that would need one, and it's a Should.)
- **Game** — league, week number, home entrant, away entrant, home score, away score (both empty until played). A bye is a game with no away entrant, or is simply the absence of a game for that entrant that week — the architecture doc picks one.
- **Standings** — *not stored.* Computed from Games.

Later stories add: Entrant.paid (US08), Bracket (US09), Pairing (US10), Prize (US11), Event (US12). None of them change the five above.

## 8 · Open questions

*Decides: what don't we know, who answers it, and by when?*

| Question | Why it matters | Resolve by |
|---|---|---|
| Does "sport" need to be a controlled list (for future per-sport scoring rules) or is free text fine? | Free text is the MVP answer; a list would be needed only if scoring rules ever differ by sport. | `CP-M3` — decide free text unless architecture finds a reason. |
| When the schedule is longer than the league's `weeks` (7 entrants → 7 rounds, league set to 6 weeks), truncate, extend, or refuse? | Affects US04's AC. Current lean: generate the full round-robin and *set weeks to match*, warning the organizer. | Before Lab 5. Add an AC to US04 either way. |
| Does the public identifier need to be unguessable? | Standings are not secret, but an organizer might not want *every* league on the site enumerable. | `CP-M3`. Lean: short random slug, not an integer. |
| Doubles pairings (US10): is this a second scheduling algorithm or a variant of the first? | Determines whether US10 is a week of work or a day. | Not before `CP-M4`. It's a Should. |

## 9 · What "done" means

*Decides: what is being handed in, when?*

- **`CP-M4` (Sun Nov 22).** The seven MVP stories work end to end from a fresh clone, every MVP acceptance criterion has a test or a written reason it doesn't, the suite has been shown to go red when a covered path is broken, and `docs/test-plan.md` says which is which.
- **`CP` + `DD` (Fri Dec 11).** The same, deployed at a live URL, with a 5–8 minute recording that walks §6 start to finish on the live site, and a written defense that names what was cut (§3) and why.

Shoulds and Coulds shipped by Dec 11 are a bonus. A Should that half-works costs more than one that was never started.

---

## Change log

| Date | Change | Why |
|---|---|---|
| 2026-09-27 | v1.0 — first complete draft after Workshop 2 peer review | `CP-M2` |
