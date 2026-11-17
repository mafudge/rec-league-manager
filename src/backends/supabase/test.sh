#!/bin/sh
# Unit tests for the Edge Function's modules, run with Deno in Docker (no host install).
# LIVE_SUPABASE=1 ./test.sh also runs live_test.ts (row-level security) against the running stack
# on localhost:54321, using the anon key from docker/.env; its sign-ups need the stack's sign-up password,
# passed from the environment: SIGNUP_PASSWORD=<the one in docker/.env> LIVE_SUPABASE=1 ./test.sh
set -e
cd "$(dirname "$0")"
LIVE=""
if [ "$LIVE_SUPABASE" = "1" ]; then
  [ -n "${SIGNUP_PASSWORD:-}" ] || { echo "Set SIGNUP_PASSWORD to the stack's sign-up password (docker/.env)"; exit 1; }
  ANON_KEY=$(grep '^ANON_KEY=' docker/.env | cut -d= -f2-)
  LIVE="--network host -e LIVE_SUPABASE=1 -e ANON_KEY=$ANON_KEY -e SIGNUP_PASSWORD"
fi
# shellcheck disable=SC2086
exec docker run --rm $LIVE -v rlm-deno-cache:/deno-dir -v "$PWD/docker/volumes/functions/api:/app" -w /app \
  denoland/deno:2.1.4 test --allow-env --allow-net "$@"
