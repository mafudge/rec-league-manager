#!/bin/sh
# Check a running backend against the REST contract (ADR 003).
# Usage: ./contract-test.sh <API_URL>
#   e.g. ./contract-test.sh http://localhost:8000
#        ./contract-test.sh http://localhost:54321/functions/v1
API_URL=${1:?usage: $0 <API_URL>}
API_URL=${API_URL%/}
ORIGIN=http://localhost:3000
failures=0
headers=$(mktemp)
trap 'rm -f "$headers"' EXIT

check() { # check <description> <exit-code-of-the-condition>
  if [ "$2" -eq 0 ]; then echo "ok   $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}

get() { # get <path>: body to stdout, headers to $headers, status to $status
  body=$(curl -sS --max-time 10 -D "$headers" -H "Origin: $ORIGIN" "$API_URL$1")
  status=$(head -n 1 "$headers" | cut -d' ' -f2)
}

get /api/health
[ "$status" = "200" ]; check "GET /api/health returns 200 (got ${status:-no answer})" $?
echo "$body" | grep -q '"status" *: *"ok"'; check "  body is {\"status\": \"ok\"} ($body)" $?

get /api/backend
[ "$status" = "200" ]; check "GET /api/backend returns 200 (got ${status:-no answer})" $?
grep -qi '^content-type: application/json' "$headers"; check "  response is JSON" $?
echo "$body" | grep -Eq '"backend" *: *"(fastapi|django|supabase|firebase)"'; check "  body names the backend ($body)" $?
grep -Eqi "^access-control-allow-origin: (\*|$ORIGIN)" "$headers"; check "  a browser on another port may read it (CORS)" $?

preflight=$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -X OPTIONS \
  -H "Origin: $ORIGIN" -H "Access-Control-Request-Method: GET" "$API_URL/api/backend")
case "$preflight" in 200|204) true ;; *) false ;; esac; check "  CORS preflight succeeds (got $preflight)" $?

if [ "$failures" -eq 0 ]; then echo "contract ok: $API_URL"; else echo "$failures check(s) failed: $API_URL"; exit 1; fi
