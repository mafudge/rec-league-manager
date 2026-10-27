# 005 · Each release is deployed on free tiers: FastAPI on Render, web on Vercel

**Status.** Accepted · 2026-10-27

## Decision

Every release puts one pairing online, **FastAPI + web**, at its own pair of free platform addresses:
- the API is a Render Free web service, built from the release branch's `render.yaml`
- the web app is a Vercel Hobby project, built from `src/frontends/web` on the same branch

Older releases stay up beside newer ones. Each API seeds the demo league on every start (`DEMO_SEED=1 python -m app.seed`), sign-up stays open, and a nightly GitHub Actions job redeploys every API to reset it. The runbook is [`docs/deploy.md`](../deploy.md).

## Why

- **$0, and nothing to look after.** No server, domain, card or database to keep up to date. A student can repeat it with their own capstone.
- **The reference pair is the easiest one to host.** FastAPI already reads `DATABASE_URL` and `JWT_SECRET` from the environment and allows any origin (ADR 003). The web app needs one build variable. The architecture doc already used this pair as its one-stack worked example (§1).
- **Supabase and Firebase stay local.** Deploying either would need a cloud account and project, which ADR 001 avoids. The Firebase emulators aren't a production host at all.
- **Free subdomains, not our own names.** sslip.io names were the first pick, but they need a server IP we control, and PaaS gives none. `*.onrender.com` and `*.vercel.app` cost nothing and come with HTTPS.

## Consequences

- **Cold starts.** Render Free sleeps after 15 idle minutes, and the first request then takes about 50 s. The README warns visitors.
- **Data doesn't last.** The free disk is wiped on every sleep and deploy, so a student's own league disappears after 15 quiet minutes as well as nightly. The seed makes that harmless for the demo. The README says so plainly.
- **Open sign-up on the public internet.** Anyone can create accounts and leagues. The nightly reset limits how much can build up.
- **Not a VPS.** A $5-a-month server would keep data and never sleep, but it needs a card, patching and HTTPS setup. Revisit if a release needs data that lasts.
- **Each release is set up by hand.** It takes a few minutes in two dashboards, per `docs/deploy.md`. It isn't scripted, because a release happens a handful of times a semester.
- **Node 22 on Vercel.** Vercel no longer builds on Node 18, so the deployed web app runs a newer Node than this machine (architecture §10).
- **Vercel Hobby is for non-commercial use.** That fits a course reference implementation.
