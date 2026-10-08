#!/bin/sh
# Start the self-hosted Supabase stack from ./docker (no cloud account needed).
# First run: creates docker/.env, moves the API gateway to port 54321 (so it
# does not clash with FastAPI on 8000 or Django on 8001) and generates fresh secrets.
set -e
cd "$(dirname "$0")/docker"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's#localhost:8000#localhost:54321#g; s#^API_GW_HTTP_PORT=8000#API_GW_HTTP_PORT=54321#; s#^KONG_HTTP_PORT=8000#KONG_HTTP_PORT=54321#' .env
  sh utils/generate-keys.sh --update-env >/dev/null
fi
docker compose up -d
