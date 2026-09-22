# Interview 01 — Dana, cornhole league organizer

**Date.** 2026-09-10 · **Where.** At the brewery, before league night · **Length.** ~25 min
**Who.** Runs a 12-team, 8-week cornhole league, two seasons a year, for about three years.

> **Note for readers of this example.** This is a composite written to illustrate the format. Yours must be a real conversation with a real person.

## What they said / did — verbatim where possible, no interpretation

| # | Said / did |
|---|---|
| 1 | "I've got a Google Sheet. It's got a tab for the schedule, a tab for standings, and a tab for who paid. The standings tab has formulas and every season somebody breaks them." |
| 2 | "People text me photos of the scoresheet. Or they text 'we won 21–14.' Then Sunday I sit down and enter all of it." |
| 3 | Pulled up the group chat to show me — 40+ messages from the previous Tuesday, four of which were scores. |
| 4 | "The question I get most is 'who do we play next week.' Every single week. It's *in the sheet*. Nobody opens the sheet on their phone." |
| 5 | "I do the schedule by hand. Twelve teams, I try to make sure everyone plays everyone once. Last season I messed it up and two teams played each other twice." |
| 6 | "Money is the worst part. It's $40 a team. I Venmo-request everyone week one and then I'm chasing three teams until week four." |
| 7 | "Prize money is just whatever's left after the brewery's tab. First place gets most of it, second gets some, and I usually buy the last-place team a round." |
| 8 | Asked whether they'd want the app to actually move money: "God no. I don't want to be a bank. I just want to know who paid." |
| 9 | "We do a playoff the last week. Top four. I have to figure out the bracket on the night." |
| 10 | "Once a season we do a cookout or something. That's just a group chat thing." |
| 11 | Showed me the standings tab: columns were W, L, PF, PA, and a "diff" column. "Ties are broken by point differential. Then head-to-head, but I've never actually had to do that." |
| 12 | Asked what would make them stop using a tool: "If it takes longer than the sheet. Or if I have to make everyone sign up for something." |

## My interpretation — kept separate on purpose

- The schedule is the source of most repeated pain (#4, #5). A generated round-robin plus a link players can open on a phone solves two complaints at once.
- Score entry happens in a burst on Sunday (#2), not live — so a form Dana fills in is fine; player self-reporting is not needed for v1.
- **Money: track it, don't move it** (#6, #8). This answers the concept brief's biggest unknown. A paid/unpaid checkbox per team is the feature; payment processing is a non-goal.
- Prizes (#7) and events (#10) are real but low-frequency and informal. Not MVP.
- Standings need W, L, PF, PA, differential, and a stated tiebreak order (#11). Head-to-head can be documented and skipped for v1 since it has never been used.
- Playoffs (#9) are a Should — the season has a real ending that the sheet handles badly.
- Hard constraint from #12: **players must never need an account.** Public read-only link.
