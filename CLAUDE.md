# CLAUDE.md

## What this is
Rec League Manager — a tool for the volunteer who runs a recreational league (cornhole, pickleball, darts, pitch, volleyball) to manage people, schedules, scores and standings. Worked example capstone for IST300.

## Who uses it
- **The organizer** — one person, not technical, on a laptop Sunday night and a phone during league night.
- **Players** — they want to see the schedule and standings on a phone. They should never have to log in.

## Conventions
- Requirements live in `docs/`. If a request contradicts them, say so rather than guessing.
- Commit messages say what was decided, not just what changed. "Update file" is never acceptable.

## Instructions for Claude

1. Project planning goes on the backlog in `docs/backlog.md`. These should be grouped logically by user story or feature. New issues and bugs start here.
2. `docs/todo.md` Contains items moved from `docs/backlog.md` that we are working on NOW. We should complete the todo's before working on the next backlog item. 
3. We don't write code unless there is a GitHub issue for it.
4. Each todo should land in Github as an issue to be coded, issues numbers tracking back to the item.
5. All GitHub issues should be well-defined so a programmer of moderate ability can complete the task trivially.
6. All GitHub issues should have acceptance criteria and definition of done sections, suitable for a product manager.
7. Track the Github issue back to the backlog version number with labels ex: v1.10.0, US01, etc.
8. Do not wander off task. If you encounter a bug, feature or enhancement idea while working, add it to the backlog and label it. 
9. Always code in a `dev/branch` for the Github issue and when done, push to `main`. 
10. We test the code we write. Unit and integration tests.
11. An issue is not done until tests pass, the server runs and the app runs without error.
12. As you close Github issues review `docs/todo.md` and move completed items into `docs/xchangelog.md`
13. start coding on `main` with a clean working directory before you start work on the next issue
