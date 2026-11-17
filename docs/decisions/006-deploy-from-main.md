# 006 · The live site builds from `main`: one site for the newest release

**Status.** Accepted · 2026-11-16. Supersedes the "one address pair per release" part of [ADR 005](005-free-tier-deployment.md); the rest of 005 (FastAPI + web, Render Free + Vercel Hobby, seeded demo, nightly reset) still stands.

## Decision

One Render service and one Vercel project, both building from `main`:
- the API is the Render Free web service from `render.yaml` with `branch: main` (name kept as `rlm-api-v0-2-1` so the existing URL keeps working)
- the web app is a Vercel Hobby project whose Production Branch is `main`

Shipping a release is merging its release branch to `main`. The nightly reset redeploys the one API from the `RENDER_HOOK` secret. The runbook is [`docs/deploy.md`](../deploy.md).

## Why

- **It's how the site was actually set up.** The organizer connected both hosts to `main`, the repository's default branch and Vercel's default production branch.
- **Less to run.** No new Render service, Vercel project, secret and README row every release, and no growing list of sleeping services to reset.
- **`main` already means "released".** Under CLAUDE.md, a release branch reaches `main` only when all its issues are closed, so `main` is always the newest finished release.

## Consequences

- **Older releases are not online.** Students compare releases by checking out tags (`git checkout v0.2.0`) and running them locally, not by opening two URLs. This drops REL-01's original "each release stays viewable at its own address" goal.
- **A bad merge to `main` goes live.** The release check before merging is the guard; recovery is reverting the merge or rolling back in the hosts' dashboards.
- **The API's name says `v0-2-1` forever.** It's where the service started, not the version it runs. The runbook says so.
- **Vercel previews.** Vercel builds a preview for every other pushed branch. They're harmless and not the live site.
