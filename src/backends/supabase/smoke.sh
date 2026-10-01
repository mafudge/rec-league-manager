#!/bin/sh
# Pass when the REST API and Auth answer through the gateway.
set -e
cd "$(dirname "$0")/docker"
ANON_KEY=$(grep '^ANON_KEY=' .env | cut -d= -f2-)
SERVICE_KEY=$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)
BASE=http://localhost:54321
# the REST root lists the schema, which only the service role may read
curl -fsS "$BASE/rest/v1/" -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" -o /dev/null && echo "rest ok"
curl -fsS "$BASE/auth/v1/health" -H "apikey: $ANON_KEY" -o /dev/null && echo "auth ok"
