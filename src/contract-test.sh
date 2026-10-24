#!/bin/sh
# Check a running backend against the REST contract (ADR 003).
# Usage: ./contract-test.sh <API_URL>
#   e.g. ./contract-test.sh http://localhost:8000
#        ./contract-test.sh http://localhost:54321/functions/v1
API_URL=${1:?usage: $0 <API_URL>}
API_URL=${API_URL%/}
ORIGIN=http://localhost:3000
command -v jq >/dev/null 2>&1 || { echo "contract-test.sh needs jq"; exit 1; }
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

send() { # send <METHOD> <path> [json-body] [token]: body to stdout, status to $status
  method=$1; path=$2; json=${3:-}; token=${4:-}
  body=$(curl -sS --max-time 10 -D "$headers" -X "$method" -H "Origin: $ORIGIN" \
    ${json:+-H "Content-Type: application/json" --data "$json"} \
    ${token:+-H "Authorization: Bearer $token"} "$API_URL$path")
  status=$(head -n 1 "$headers" | cut -d' ' -f2)
}
post() { send POST "$@"; }   # post <path> [json-body] [token]
put() { send PUT "$@"; }     # put <path> [json-body] [token]
delete() { send DELETE "$1" "" "${2:-}"; } # delete <path> [token]

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

hello() { # hello <query-string> <expected-status> <expected-body>
  get "/api/hello$1"
  [ "$status" = "$2" ] && [ "$body" = "$3" ]
  check "GET /api/hello$1 returns $2 $3 (got ${status:-no answer} $body)" $?
}
hello "?name=Mike" 200 '{"message":"Hello Mike"}'
hello "?name=Ada%20Lovelace" 200 '{"message":"Hello Ada Lovelace"}'
hello "?name=Jos%C3%A9" 200 '{"message":"Hello José"}'
hello "?name=%20Mike%20" 200 '{"message":"Hello Mike"}'
hello "" 400 '{"error":"Name is required"}'
hello "?name=%20" 400 '{"error":"Name is required"}'

# --- US13 · sign up ---
email="contract-$(date +%s)-$$@example.com"
post /api/auth/signup "{\"email\":\"$email\",\"password\":\"cornhole1\"}"
[ "$status" = "201" ]; check "POST /api/auth/signup returns 201 (got ${status:-no answer})" $?
echo "$body" | jq -e '(.token|type=="string" and length>0) and (.refresh_token|type=="string" and length>0)' >/dev/null
check "  body has token and refresh_token" $?
post /api/auth/signup "{\"email\":\"$email\",\"password\":\"cornhole1\"}"
[ "$status" = "409" ] && [ "$body" = '{"error":"An account with that email already exists"}' ]
check "signing up the same email again returns 409 (got ${status:-no answer} $body)" $?
post /api/auth/signup "{\"email\":\"short-$email\",\"password\":\"short\"}"
[ "$status" = "400" ] && [ "$body" = '{"error":"Password must be at least 8 characters"}' ]
check "a short password returns 400 (got ${status:-no answer} $body)" $?
post /api/auth/signup '{"email":"no-at-sign","password":"cornhole1"}'
[ "$status" = "400" ] && [ "$body" = '{"error":"Enter a valid email address"}' ]
check "an email without @ returns 400 (got ${status:-no answer} $body)" $?

if [ "$failures" -eq 0 ]; then echo "contract ok: $API_URL"; else echo "$failures check(s) failed: $API_URL"; exit 1; fi
