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
