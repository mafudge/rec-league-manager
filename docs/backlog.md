# Backlog — Lab 3

Stories, acceptance criteria, MoSCoW, MVP slice. This is what the agent builds against from Week 9. Keep it current, not historical.

**Evidence key.** `I1-#n` = `docs/research/interview-01.md`, row *n* · `I2-#n` = `docs/research/interview-02.md`, row *n* · `CB` = concept brief.

---

## Stories

### US01 · Organizer signs in

**Story.** As the organizer, I want to sign in with an email and password so that only I can change the league.

**Acceptance criteria**
- Given I am on the sign-in page, when I enter a registered email and the correct password, then I land on my league list.
- Given I enter a registered email and the wrong password, when I submit, then I stay on the sign-in page, see "Email or password is incorrect", and no league is shown. *(negative)*
- Given I am not signed in, when I open any page that changes data (create league, add team, enter score), then I am redirected to sign in.

**Evidence.** I1-#12 "I don't want to make everyone sign up for something" — one writer, everyone else reads. I2-#9.

### US02 · Create a league

**Story.** As the organizer, I want to create a league with a name, a sport, a season label and a number of weeks so that everything for that season lives in one place.

**Acceptance criteria**
- Given I am signed in, when I submit name "Tuesday Cornhole", sport "Cornhole", season "Fall 2026" and 8 weeks, then the league appears in my list with those values.
- Given I leave the name blank, when I submit, then the league is not created and the form shows "Name is required". *(negative)*
- Given I enter 0 or a negative number of weeks, when I submit, then the league is not created and the form shows "Weeks must be at least 1". *(negative)*

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

**Evidence.** I1-#5 "two teams played each other twice"; I2-#8 "the thing I'd pay for is not having to build the pairings"; I2-#5/#11 (bye rotation).

### US05 · Record a score

**Story.** As the organizer, I want to enter the final score for a scheduled game so that standings come from the app and not from my Sunday-night data entry.

**Acceptance criteria**
- Given a scheduled game between A and B, when I enter 21–14, then the game shows as played with A 21, B 14.
- Given I enter a negative or blank score for either side, when I submit, then the score is not saved and I see "Scores must be whole numbers 0 or greater". *(negative)*
- Given a game already has a score, when I enter a different score, then the new score replaces the old one (mistakes get fixed on Sunday).

**Evidence.** I1-#2 "Sunday I sit down and enter all of it"; I2-#2.

### US06 · Standings compute themselves

**Story.** As the organizer, I want standings to update the moment a score is saved so that the formulas can't break.

**Acceptance criteria**
- Given played games, when I view standings, then each entrant shows W, L, PF (points for), PA (points against) and Diff (PF − PA), sorted by W descending, then Diff descending.
- Given two entrants with equal W and equal Diff, when I view standings, then they are ordered by PF descending, and the tiebreak order is stated on the page.
- Given no games have been played, when I view standings, then every entrant shows 0-0 and the page says "No games played yet". *(empty state)*
- Given a game is unplayed (no score), when I view standings, then it contributes nothing to any row. *(negative)*

**Evidence.** I1-#11 (columns W, L, PF, PA, diff; tiebreak by differential); I1-#1 "every season somebody breaks [the formulas]".

### US07 · Public link to schedule and standings

**Story.** As a player, I want to open a link on my phone and see this week's games and the standings so that I stop asking the organizer "who do we play next week."

**Acceptance criteria**
- Given a league's public link, when I open it signed out, then I see the schedule by week and the standings, with no sign-in prompt.
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
| US01 sign in | US08 track who paid | US11 prizes | **In-app payments / moving money.** Both organizers refused it (I1-#8). Holding other people's money adds processing fees, refunds and liability — for a volunteer's league. *Not this semester, and possibly never.* |
| US02 create league | US09 playoff bracket | US12 events | **Player accounts.** Contradicted by every interview. Public read-only link is the whole design. |
| US03 add entrants | US10 rotating pairings | | **Notifications (email/SMS).** Nobody asked; the group chat already does this and does it fine. |
| US04 round-robin schedule | | | **Multi-organizer / co-admins.** Every league interviewed has exactly one organizer. |
| US05 record score | | | |
| US06 standings | | | |
| US07 public link | | | |

**Why Should isn't Must.** US08 is the most-complained-about problem, but the league can run without it — Dana is already chasing people on Venmo, and a paid checkbox doesn't change the demo. US09 and US10 are real but they are each a second scheduling algorithm; the MVP proves one first.

## MVP slice

**US01 → US02 → US03 → US04 → US05 → US06 → US07.** Same as the Must column this time, and that's the ceiling — if Week 11 runs long, US03's phone-layout AC and US04's "regenerate" AC are the first things to drop, not a whole story.

The demo: sign in, create "Tuesday Cornhole", add 6 teams, generate the schedule, enter week 1 scores, open the public link on a phone and see standings. Nothing in that recording requires "imagine it saves."

## Break-test results (Lab 3 §5)

Partner ran the literal-reader attack on US04 and US06:

- **US04, original AC 1** said "every entrant plays every other entrant." A schedule with every pair meeting *twice* satisfied it. Fixed: "every pair of entrants meets **exactly once**."
- **US06, original AC 1** said "sorted by wins." Two entrants on 4–1 in arbitrary order satisfied it. Fixed: tiebreak order is now specified (W → Diff → PF) and must be printed on the page.
