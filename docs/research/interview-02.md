# Interview 02 — Marcus, pickleball ladder organizer

**Date.** 2026-09-12 · **Where.** Phone call · **Length.** ~20 min
**Who.** Runs a Thursday-morning pickleball league at a town park. About 20 individual players, not fixed teams; pairs rotate each week. Also helped run a dart league at a VFW for two years.

> **Note for readers of this example.** Composite, written to illustrate the format.

## What they said / did — verbatim where possible, no interpretation

| # | Said / did |
|---|---|
| 1 | "Ours isn't teams. It's people. Every week I pair people up differently and we play a round robin of doubles." |
| 2 | "I keep it on paper on a clipboard, then I take a photo and put the results in a spreadsheet. Individual wins and losses, and points." |
| 3 | "The dart league was teams of two, fixed all season. Way easier. The pickleball one is the hard one because the pairings change." |
| 4 | "People show up who aren't signed up. I need to add them on the spot, on my phone, in the parking lot." |
| 5 | "Sometimes we have an odd number and somebody sits. I try to rotate who sits. I don't always remember who sat last week." |
| 6 | "Dues are $5 a week, cash in a coffee can. I honestly don't track it well." |
| 7 | Asked about prizes: "End of session, best record gets a gift card from the pro shop. It's not a big deal." |
| 8 | "The thing I'd pay for is not having to build the pairings. It takes me twenty minutes every Wednesday night and I still get it wrong." |
| 9 | "I tried an app once. It wanted everybody to make an account and download it. Half of them are over sixty. That was the end of that." |
| 10 | "I'd want to see it on my phone. I don't bring a laptop to the park." |
| 11 | Asked what 'wrong' means in #8: "Two people playing together twice before everyone's played together once. Or somebody sitting two weeks in a row." |

## My interpretation — kept separate on purpose

- Confirms the core job across sports (#2, #8): generating a fair schedule is the thing organizers can't do well by hand.
- **Individual-player leagues with rotating pairs are a different scheduling problem** than fixed teams (#1, #3, #11). Round-robin over fixed entrants covers cornhole, darts, volleyball and fixed-pair pickleball. Rotating doubles pairings is a harder algorithm — real, but not MVP. Logged in the backlog as a Should with the scheduling rules from #11 as its AC.
- Odd counts need a bye, and byes should rotate (#5). That's an MVP acceptance criterion, not a nice-to-have.
- Organizer must be able to add a person from a phone quickly (#4, #10) — mobile-first for the organizer too, not just players.
- No player accounts, again (#9). Two for two. This is now a non-goal in the PRD.
- Money tracking is wanted but poorly done today (#6) — supports "track, don't move."
- Prizes are informal everywhere (#7 here, #7 in interview 01). Could, not Should.
