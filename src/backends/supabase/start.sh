#!/bin/sh
# Start the self-hosted Supabase stack from ./docker (no cloud account needed).
# First run: creates docker/.env, moves the API gateway to port 54321 (so it
# does not clash with FastAPI on 8000 or Django on 8001) and generates fresh secrets.
# Every run: turns email auto-confirm on (there is no mail server, so nobody could confirm
# a sign-up; works on an existing .env too) and applies migrations/*.sql in order.
set -e
cd "$(dirname "$0")/docker"
if [ ! -f .env ]; then
  cp .env.example .env
  sed -i 's#localhost:8000#localhost:54321#g; s#^API_GW_HTTP_PORT=8000#API_GW_HTTP_PORT=54321#; s#^KONG_HTTP_PORT=8000#KONG_HTTP_PORT=54321#' .env
  sh utils/generate-keys.sh --update-env >/dev/null
fi
sed -i 's/^ENABLE_EMAIL_AUTOCONFIRM=.*/ENABLE_EMAIL_AUTOCONFIRM=true/' .env
docker compose up -d

# Wait for Postgres, then apply each migration (they are written to be re-run safely).
until docker exec supabase-db pg_isready -U postgres -q 2>/dev/null; do sleep 1; done
for f in ../migrations/*.sql; do
  [ -e "$f" ] || continue
  echo "migrate $(basename "$f")"
  docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <"$f"
done
