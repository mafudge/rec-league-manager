# Concept Brief — `CP-M1`

## 1 · Working name

**Rec League Manager.** It may end up with a better name; this one at least says what it is.

## 2 · The pitch, in one sentence

A scheduling-and-standings tool for the volunteer who runs a rec league, so the schedule, the scores, the standings and who-has-paid live in one place instead of a spreadsheet, a group chat and a Venmo history.

## 3 · Who it's for — specifically

**Dana**, who runs the Tuesday-night cornhole league at a brewery. Twelve teams, eight-week season, twice a year. Dana is not a developer, does not want to be, and does this because nobody else would.

Where they are when they'd reach for this:

- **Sunday night, laptop.** Building next week's matchups, updating standings from the photos of scoresheets people texted, and messaging the three teams that haven't paid.
- **Tuesday night, phone, one hand holding a beer.** Someone asks "who do we play next?" or "are we still in third?" and Dana has to find the spreadsheet on a 6-inch screen.

The players are a second audience, but a thin one: they want to look at the schedule and the standings on their phone. They will never log in to anything.

The same person exists at the pickleball courts, the dart league at the VFW, the pitch tournament at the fire hall, and the volleyball league at the Y. Different sport, same job.

## 4 · The job it does

> When **I'm running a rec league for a group of friends and strangers**, I want to **keep the schedule, scores, standings and money straight without it being my whole week**, so I can **actually play and enjoy the league I organized and run multiple league easily.**

## 5 · What people do instead today

A Google Sheet for the schedule and standings (formulas that break when someone edits the wrong cell), a group chat for announcements and score reporting (which nobody scrolls back through), and Venmo for money (with no record of who paid for what). Some leagues use a paid platform built for youth sports or big amateur associations — too much setup, too expensive, and built for a paid administrator, not a volunteer.

Giving up is also common: the organizer stops updating standings around week five, and the last three weeks are played on vibes.

## 6 · Biggest unknown

**Whether the money part belongs in the product at all.** Collecting dues and paying out prizes is the part organizers complain about most — but it's also where the risk is (payment processing, holding other people's money, refunds). If it turns out the *tracking* of who paid is the real relief, and the actual transfer can stay on Venmo, the product gets much simpler. I need to find that out in the Week 3 interviews before I decide what's in scope.

## Optional — stack guess

Python + Flask + SQLite, because I can hold the whole thing in my head. I expect this to change after Week 7.

*(Postscript from `CP-M3`: it did change — into five implementations. See `docs/03-architecture.md`.)*
