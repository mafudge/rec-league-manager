# Change Log: A history of what was done

## v0.1.0 Scaffolding

- **SCAF-01** FastAPI backend stub (`src/backends/fastapi/`) — #1. `/api/health` runs, pytest passes.
- **SCAF-02** Django backend stub (`src/backends/django/`) — #2.
- **SCAF-03** Next.js web frontend stub (`src/frontends/web/`) — #3.
- **SCAF-04** Streamlit frontend stub (`src/frontends/streamlit/`) — #4.
- **SCAF-05** Supabase self-hosted backend stub (`src/backends/supabase/`) — #5.
- **SCAF-06** Firebase Emulator backend stub (`src/backends/firebase/`) — #6.
- **SCAF-07** Flutter frontend stub (`src/frontends/flutter/`) — #7.
- **SCAF-08** Any frontend works with any backend (`src/README.md`) — #8. One REST contract (ADR 003): `GET /api/health`, `GET /api/backend`. `src/contract-test.sh` passes on all four backends; all 12 pairings verified live.
- **SCAF-10** Every backend has its own port — #9. FastAPI 8000, Django 8001, Firebase 5000, Supabase 54321; all four ran at once and passed `contract-test.sh`.
- **SCAF-11** Flutter runs in the Android emulator — #10. Host backends at `10.0.2.2`; debug builds allow cleartext, release builds don't; Django's `ALLOWED_HOSTS` accepts `10.0.2.2`. All four backends verified in the emulator.
- **SCAF-12** Every backend says hello to a name — #11. `GET /api/hello?name=Mike` → `Hello Mike`; blank name → 400. `contract-test.sh` passes on all four.
- **SCAF-13** Flutter asks the backend to say hello — #12. Name box + Say hello button; shows the backend's reply or its refusal. Verified in the Android emulator on all four backends and in Chrome.
- **SCAF-14** Web and Streamlit ask the backend to say hello — #13. Same name box + Say hello as Flutter; all three frontends now do it on all four backends.
- **SCAF-15** Flutter is web-only — #16. Reverses SCAF-11: the Android emulator cost more RAM and disk than the example was worth. `android/` and its manifest test deleted; emulator and `10.0.2.2` instructions gone from the docs; Django no longer accepts Host `10.0.2.2`. Verified in headless Chrome against FastAPI.

## v0.2.0 MVP

- **US06 (calculation)** FastAPI computes standings from games — #14. `app/standings.py` `compute_standings(entrants, games)`: W, L, PF, PA, Diff; sorted W → Diff → PF (then name); byes and unplayed games contribute nothing. One test per AC, 14/14 pass. The endpoint, the page (tiebreak text, "No games played yet") and the other three backends are still to do.
