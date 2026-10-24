#!/bin/sh
# Check a running backend against the REST contract (ADR 003).
# Usage: ./contract-test.sh <API_URL>
#   e.g. ./contract-test.sh http://localhost:8000
#        ./contract-test.sh http://localhost:54321/functions/v1
# A backend still being built can check just the sections it has: CONTRACT_UPTO=accounts|leagues|schedule|all (default all).
#   accounts = health/backend/hello + signup/login/refresh/me    leagues = leagues + entrants
#   schedule = schedule, games, scores, clear                    all = standings + public
API_URL=${1:?usage: $0 <API_URL>}
API_URL=${API_URL%/}
ORIGIN=http://localhost:3000
command -v jq >/dev/null 2>&1 || { echo "contract-test.sh needs jq"; exit 1; }
UPTO=${CONTRACT_UPTO:-all}
case "$UPTO" in accounts|leagues|schedule|all) ;; *) echo "CONTRACT_UPTO must be accounts, leagues, schedule or all (got $UPTO)"; exit 1 ;; esac
failures=0
headers=$(mktemp)
trap 'rm -f "$headers"' EXIT

check() { # check <description> <exit-code-of-the-condition>
  if [ "$2" -eq 0 ]; then echo "ok   $1"; else echo "FAIL $1"; failures=$((failures + 1)); fi
}

finish() { # finish [suffix]: summarize and exit
  if [ "$failures" -eq 0 ]; then echo "contract ok$1: $API_URL"; else echo "$failures check(s) failed: $API_URL"; exit 1; fi
  exit 0
}
stop_after() { [ "$UPTO" = "$1" ] && finish " (up to $1)"; true; } # stop_after <section>

same() { # same <expected-json>: does $body equal it as JSON? Spacing, key order and \u escapes don't matter.
  [ "$(printf '%s' "$body" | jq -S -c . 2>/dev/null)" = "$(printf '%s' "$1" | jq -S -c .)" ]
}

get() { # get <path>: body to stdout, headers to $headers, status to $status
  body=$(curl -sS --max-time 10 -D "$headers" -H "Origin: $ORIGIN" "$API_URL$1")
  status=$(head -n 1 "$headers" | cut -d' ' -f2)
}

send() { # send <METHOD> <path> [json-body] [token]: body to stdout, status to $status
  method=$1; req_path=$2; json=${3:-}; token=${4:-} # not $path: callers use that name for their own loops
  body=$(curl -sS --max-time 10 -D "$headers" -X "$method" -H "Origin: $ORIGIN" \
    ${json:+-H "Content-Type: application/json" --data "$json"} \
    ${token:+-H "Authorization: Bearer $token"} "$API_URL$req_path")
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
  [ "$status" = "$2" ] && same "$3"
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
[ "$status" = "409" ] && same '{"error":"An account with that email already exists"}'
check "signing up the same email again returns 409 (got ${status:-no answer} $body)" $?
upper=$(echo "$email" | tr 'a-z' 'A-Z')
post /api/auth/signup "{\"email\":\"  $upper  \",\"password\":\"cornhole1\"}"
[ "$status" = "409" ] && same '{"error":"An account with that email already exists"}'
check "the same email upper-cased and padded with spaces returns 409 (got ${status:-no answer} $body)" $?
post /api/auth/signup "{\"email\":\"short-$email\",\"password\":\"short\"}"
[ "$status" = "400" ] && same '{"error":"Password must be at least 8 characters"}'
check "a short password returns 400 (got ${status:-no answer} $body)" $?
post /api/auth/signup '{"email":"no-at-sign","password":"cornhole1"}'
[ "$status" = "400" ] && same '{"error":"Enter a valid email address"}'
check "an email without @ returns 400 (got ${status:-no answer} $body)" $?

for route in signup login refresh; do
  post "/api/auth/$route" '[]'
  [ "$status" = "400" ] && same '{"error":"Invalid request"}'
  check "POST /api/auth/$route with a body that is not a JSON object returns 400 Invalid request (got ${status:-no answer} $body)" $?
done

# --- US01 · sign in, refresh, the sign-in gate ---
post /api/auth/login "{\"email\":\"$email\",\"password\":\"cornhole1\"}"
[ "$status" = "200" ]; check "POST /api/auth/login returns 200 (got ${status:-no answer})" $?
echo "$body" | jq -e '(.token|type=="string" and length>0) and (.refresh_token|type=="string" and length>0)' >/dev/null
check "  body has token and refresh_token" $?
access=$(echo "$body" | jq -r '.token'); refresh=$(echo "$body" | jq -r '.refresh_token')
post /api/auth/login "{\"email\":\"$email\",\"password\":\"wrong-password\"}"
[ "$status" = "401" ] && same '{"error":"Email or password is incorrect"}'
check "a wrong password returns 401 (got ${status:-no answer} $body)" $?
post /api/auth/refresh "{\"refresh_token\":\"$refresh\"}"
[ "$status" = "200" ]; check "POST /api/auth/refresh returns 200 (got ${status:-no answer})" $?
echo "$body" | jq -e '(.token|type=="string" and length>0) and (.refresh_token|type=="string" and length>0)' >/dev/null
check "  body has a new token and refresh_token" $?
refresh=$(echo "$body" | jq -r '.refresh_token') # a refresh token is single-use on some backends: from here on use only the newest one
post /api/auth/refresh '{"refresh_token":"garbage"}'
[ "$status" = "401" ] && same '{"error":"Sign in required"}'
check "refreshing with garbage returns 401 (got ${status:-no answer} $body)" $?
get /api/auth/me
[ "$status" = "401" ] && same '{"error":"Sign in required"}'
check "GET /api/auth/me without a token returns 401 (got ${status:-no answer} $body)" $?
send GET /api/auth/me "" "$access"
[ "$status" = "200" ] && same "$(jq -cn --arg e "$(echo "$email" | tr 'A-Z' 'a-z')" '{email:$e}')"
check "GET /api/auth/me with the token returns 200 {email} (got ${status:-no answer} $body)" $?

# A stale or garbage token on a route that needs no sign-in is ignored, never a 401 (a client may send its expired token along).
send POST /api/auth/signup "{\"email\":\"stale-$email\",\"password\":\"cornhole1\"}" garbage
[ "$status" = "201" ]; check "POST /api/auth/signup ignores a garbage Authorization header (got ${status:-no answer})" $?
send POST /api/auth/login "{\"email\":\"$email\",\"password\":\"cornhole1\"}" garbage
[ "$status" = "200" ]; check "POST /api/auth/login ignores a garbage Authorization header (got ${status:-no answer})" $?
send POST /api/auth/refresh "{\"refresh_token\":\"$refresh\"}" garbage
[ "$status" = "200" ]; check "POST /api/auth/refresh ignores a garbage Authorization header (got ${status:-no answer})" $?
refresh=$(echo "$body" | jq -r '.refresh_token')
send GET /api/health "" garbage
[ "$status" = "200" ]; check "GET /api/health ignores a garbage Authorization header (got ${status:-no answer})" $?
send GET /api/auth/me "" garbage
[ "$status" = "401" ] && same '{"error":"Sign in required"}'
check "GET /api/auth/me with a garbage token returns 401 (got ${status:-no answer} $body)" $?

stop_after accounts

# --- US02 · create a league ---
league='{"name":"Tuesday Cornhole","location":"Joe'"'"'s Tavern","sport":"Cornhole","season":"Fall 2026","weeks":8}'
get /api/leagues
[ "$status" = "401" ] && same '{"error":"Sign in required"}'
check "GET /api/leagues without a token returns 401 (got ${status:-no answer} $body)" $?
post /api/leagues "$league" "$access"
[ "$status" = "201" ]; check "POST /api/leagues returns 201 (got ${status:-no answer} $body)" $?
echo "$body" | jq -e '.name=="Tuesday Cornhole" and .location=="Joe'"'"'s Tavern" and .sport=="Cornhole" and .season=="Fall 2026" and .weeks==8 and .allow_ties==false and (.id|type=="string") and (.slug|test("^[abcdefghjkmnpqrstuvwxyz23456789]{6}$"))' >/dev/null
check "  body is a League with a string id, a 6-character slug and allow_ties false" $?
LEAGUE_ID=$(echo "$body" | jq -r '.id'); LEAGUE_SLUG=$(echo "$body" | jq -r '.slug')
send GET /api/leagues "" "$access"
[ "$status" = "200" ] && echo "$body" | jq -e --arg id "$LEAGUE_ID" 'map(.id) == [$id]' >/dev/null
check "GET /api/leagues lists only my league (got ${status:-no answer} $body)" $?
send GET "/api/leagues/$LEAGUE_ID" "" "$access"
[ "$status" = "200" ] && echo "$body" | jq -e --arg id "$LEAGUE_ID" '.id==$id' >/dev/null
check "GET /api/leagues/{id} returns 200 (got ${status:-no answer})" $?
post /api/leagues '{"name":"A","location":"B","weeks":3,"allow_ties":true}' "$access"
[ "$status" = "201" ] && echo "$body" | jq -e '.allow_ties==true and .sport=="" and .season==""' >/dev/null
check "allow_ties true is kept and sport/season default to empty (got ${status:-no answer} $body)" $?
post /api/leagues '{"name":"  ","location":"B","weeks":3}' "$access"
[ "$status" = "400" ] && same '{"error":"Name is required"}'
check "a blank name returns 400 (got ${status:-no answer} $body)" $?
post /api/leagues '{"name":"A","location":"  ","weeks":3}' "$access"
[ "$status" = "400" ] && same '{"error":"Location is required"}'
check "a blank location returns 400 (got ${status:-no answer} $body)" $?
post /api/leagues '[]' "$access"
[ "$status" = "400" ] && same '{"error":"Invalid request"}'
check "POST /api/leagues with a body that is not a JSON object returns 400 Invalid request (got ${status:-no answer} $body)" $?
send GET /api/leagues/nope "" "$access"
[ "$status" = "404" ] && same '{"error":"League not found"}'
check "GET /api/leagues/nope returns 404 League not found (got ${status:-no answer} $body)" $?
for w in 0 -1 '"eight"' 2.5 null; do
  post /api/leagues "{\"name\":\"A\",\"location\":\"B\",\"weeks\":$w}" "$access"
  [ "$status" = "400" ] && same '{"error":"Weeks must be at least 1"}'
  check "weeks $w returns 400 (got ${status:-no answer} $body)" $?
done
for w in 53 3000000000; do
  post /api/leagues "{\"name\":\"A\",\"location\":\"B\",\"weeks\":$w}" "$access"
  [ "$status" = "400" ] && same '{"error":"Weeks must be between 1 and 52"}'
  check "weeks $w returns 400 Weeks must be between 1 and 52 (got ${status:-no answer} $body)" $?
done
post /api/leagues "$(jq -cn --arg n "$(printf 'a%.0s' $(seq 101))" '{name:$n,location:"B",weeks:3}')" "$access"
[ "$status" = "400" ] && same '{"error":"Name must be 100 characters or fewer"}'
check "a 101-character league name returns 400 (got ${status:-no answer} $body)" $?
post /api/leagues '{"name":"A","location":"B","weeks":3,"allow_ties":"yes"}' "$access"
[ "$status" = "400" ] && same '{"error":"Invalid request"}'
check "allow_ties \"yes\" returns 400 Invalid request (got ${status:-no answer} $body)" $?
post /api/leagues '{"name":"A","location":"B","weeks":true}' "$access"
[ "$status" = "400" ] && same '{"error":"Weeks must be at least 1"}'
check "weeks true returns 400 (got ${status:-no answer} $body)" $?
post /api/leagues '{"name":"A","location":"B"}' "$access"
[ "$status" = "400" ] && same '{"error":"Weeks must be at least 1"}'
check "missing weeks returns 400 (got ${status:-no answer} $body)" $?
other="other-$email"
post /api/auth/signup "{\"email\":\"$other\",\"password\":\"cornhole1\"}"
[ "$status" = "201" ]; check "a second organizer signs up (got ${status:-no answer})" $?
other_access=$(echo "$body" | jq -r '.token')
send GET /api/leagues "" "$other_access"
[ "$status" = "200" ] && same "[]"; check "a second organizer's league list is empty (got ${status:-no answer} $body)" $?
send GET "/api/leagues/$LEAGUE_ID" "" "$other_access"
[ "$status" = "404" ] && same '{"error":"League not found"}'
check "a second organizer opening my league gets 404 (got ${status:-no answer} $body)" $?

# --- US03 · add entrants ---
get "/api/leagues/$LEAGUE_ID/entrants"
[ "$status" = "401" ] && same '{"error":"Sign in required"}'
check "GET entrants without a token returns 401 (got ${status:-no answer} $body)" $?
send GET "/api/leagues/$LEAGUE_ID/entrants" "" "$access"
[ "$status" = "200" ] && same "[]"; check "a new league has no entrants (got ${status:-no answer} $body)" $?
ENTRANT_NAMES="Bag Ladies|Corn Stars|Hole Patrol|Sack Attack|Board Certified|Toss Bosses"
ENTRANT_IDS=""
for n in "Bag Ladies" "Corn Stars" "Hole Patrol" "Sack Attack" "Board Certified" "Toss Bosses"; do
  post "/api/leagues/$LEAGUE_ID/entrants" "$(jq -cn --arg n "$n" '{name:$n}')" "$access"
  [ "$status" = "201" ] && echo "$body" | jq -e --arg n "$n" '.name==$n and (.id|type=="string") and (keys|length==2)' >/dev/null
  check "POST entrant $n returns 201 {id, name} (got ${status:-no answer} $body)" $?
  ENTRANT_IDS="$ENTRANT_IDS $(echo "$body" | jq -r '.id')"
done
send GET "/api/leagues/$LEAGUE_ID/entrants" "" "$access"
[ "$status" = "200" ] && echo "$body" | jq -e --arg names "$ENTRANT_NAMES" 'map(.name) == ($names | split("|"))' >/dev/null
check "entrants are listed in the order added (got ${status:-no answer} $body)" $?
for dup in "Bag Ladies" " bag ladies "; do
  post "/api/leagues/$LEAGUE_ID/entrants" "$(jq -cn --arg n "$dup" '{name:$n}')" "$access"
  [ "$status" = "409" ] && same '{"error":"An entrant with that name already exists in this league"}'
  check "adding \"$dup\" again returns 409 (got ${status:-no answer} $body)" $?
done
post "/api/leagues/$LEAGUE_ID/entrants" '[]' "$access"
[ "$status" = "400" ] && same '{"error":"Invalid request"}'
check "POST entrant with a body that is not a JSON object returns 400 Invalid request (got ${status:-no answer} $body)" $?
post "/api/leagues/$LEAGUE_ID/entrants" "$(jq -cn --arg n "$(printf 'a%.0s' $(seq 101))" '{name:$n}')" "$access"
[ "$status" = "400" ] && same '{"error":"Name must be 100 characters or fewer"}'
check "a 101-character entrant name returns 400 (got ${status:-no answer} $body)" $?
for blank in '""' '"   "' null 5; do
  post "/api/leagues/$LEAGUE_ID/entrants" "{\"name\":$blank}" "$access"
  [ "$status" = "400" ] && same '{"error":"Name is required"}'
  check "entrant name $blank returns 400 (got ${status:-no answer} $body)" $?
done
send GET "/api/leagues/$LEAGUE_ID/entrants" "" "$access"
[ "$(echo "$body" | jq length)" = "6" ]; check "the refused names added nothing (got $(echo "$body" | jq length) entrants)" $?
send GET "/api/leagues/$LEAGUE_ID/entrants" "" "$other_access"
[ "$status" = "404" ] && same '{"error":"League not found"}'
check "a second organizer listing my entrants gets 404 (got ${status:-no answer} $body)" $?
post "/api/leagues/$LEAGUE_ID/entrants" '{"name":"Intruders"}' "$other_access"
[ "$status" = "404" ] && same '{"error":"League not found"}'
check "a second organizer adding an entrant to my league gets 404 (got ${status:-no answer} $body)" $?

stop_after leagues

# --- US04 · generate a schedule, clear scores ---
post "/api/leagues/$LEAGUE_ID/schedule" "" "$other_access"
[ "$status" = "404" ] && same '{"error":"League not found"}'
check "a second organizer generating my schedule gets 404 (got ${status:-no answer} $body)" $?
send GET "/api/leagues/$LEAGUE_ID/games" "" "$access"
[ "$status" = "200" ] && same "[]"; check "a league with no schedule has no games (got ${status:-no answer} $body)" $?
post "/api/leagues/$LEAGUE_ID/schedule" "" "$access"
[ "$status" = "201" ] && same '{"weeks":5,"message":"This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8."}'
check "POST schedule on 6 entrants returns 201 weeks 5 and the weeks message (got ${status:-no answer} $body)" $?
send GET "/api/leagues/$LEAGUE_ID/games" "" "$access"
[ "$status" = "200" ] && echo "$body" | jq -e 'length==15 and (map(.week)|unique)==[1,2,3,4,5] and ([.[].week]==([.[].week]|sort)) and all(.[]; (keys|length==8) and (.id|type=="string") and .home_score==null and .away_score==null)' >/dev/null
check "GET games lists 15 games across weeks 1-5 in week order (got ${status:-no answer})" $?
post "/api/leagues/$LEAGUE_ID/schedule" "" "$access"
[ "$status" = "201" ] && same '{"weeks":5,"message":null}'
check "generating again returns 201 with message null (got ${status:-no answer} $body)" $?
post /api/leagues '{"name":"Pair","location":"B","weeks":8}' "$access"
PAIR_ID=$(echo "$body" | jq -r '.id')
post "/api/leagues/$PAIR_ID/entrants" '{"name":"One"}' "$access"
post "/api/leagues/$PAIR_ID/entrants" '{"name":"Two"}' "$access"
post "/api/leagues/$PAIR_ID/schedule" "" "$access"
[ "$status" = "201" ] && same '{"weeks":1,"message":"This schedule needs 1 week, so the league now runs 1 week instead of 8."}'
check "POST schedule on 2 entrants in an 8-week league says 1 week, not 1 weeks (got ${status:-no answer} $body)" $?
post /api/leagues '{"name":"Tiny","location":"B","weeks":3}' "$access"
TINY_ID=$(echo "$body" | jq -r '.id')
post "/api/leagues/$TINY_ID/entrants" '{"name":"Solo"}' "$access"
post "/api/leagues/$TINY_ID/schedule" "" "$access"
[ "$status" = "400" ] && same '{"error":"Add at least 2 entrants first"}'
check "generating with 1 entrant returns 400 (got ${status:-no answer} $body)" $?
delete "/api/leagues/$LEAGUE_ID/scores" "$access"
[ "$status" = "200" ] && same '{"cleared":0}'; check "DELETE scores with none recorded returns 200 cleared 0 (got ${status:-no answer} $body)" $?

# --- US05 · record a score ---
send GET "/api/leagues/$LEAGUE_ID/games" "" "$access"
GAME_ID=$(echo "$body" | jq -r '[.[]|select(.week==1 and .away_id!=null)][0].id')
put "/api/games/$GAME_ID/score" '{"home_score":21,"away_score":14}' "$access"
[ "$status" = "200" ] && echo "$body" | jq -e --arg id "$GAME_ID" '.id==$id and .home_score==21 and .away_score==14 and (keys|length==8)' >/dev/null
check "PUT score 21-14 returns 200 with both scores (got ${status:-no answer} $body)" $?
for bad in '{"home_score":-1,"away_score":14}' '{"home_score":21.5,"away_score":14}' '{"home_score":"21","away_score":14}' '{"home_score":true,"away_score":14}' '{"home_score":null,"away_score":14}'; do
  put "/api/games/$GAME_ID/score" "$bad" "$access"
  [ "$status" = "400" ] && same '{"error":"Scores must be whole numbers 0 or greater"}'
  check "score $bad returns 400 whole-numbers message (got ${status:-no answer} $body)" $?
done
put "/api/games/$GAME_ID/score" '{"home_score":15,"away_score":15}' "$access"
[ "$status" = "400" ] && same "{\"error\":\"This league doesn't allow ties\"}"
check "a tie in a no-ties league returns 400 (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":21.0,"away_score":14.0}' "$access"
[ "$status" = "200" ] && echo "$body" | jq -e '.home_score==21 and .away_score==14' >/dev/null
check "a literal 21.0 and 14.0 is accepted as 21 and 14 (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":1000000000000000000000000000000,"away_score":14}' "$access"
[ "$status" = "400" ] && same '{"error":"Scores must be whole numbers 0 or greater"}'
check "a score too large to store returns 400 (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":null,"away_score":null}' "$access"
[ "$status" = "200" ] && echo "$body" | jq -e --arg id "$GAME_ID" '.id==$id and .home_score==null and .away_score==null and (keys|length==8)' >/dev/null
check "PUT score null/null clears the game, returning 200 with both scores null (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":null,"away_score":null}' "$access"
[ "$status" = "200" ] && echo "$body" | jq -e '.home_score==null and .away_score==null' >/dev/null
check "clearing an unplayed game returns 200 with both scores null (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":null,"away_score":21}' "$access"
[ "$status" = "400" ] && same '{"error":"Scores must be whole numbers 0 or greater"}'
check "null + 21 returns 400 whole-numbers message (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":21,"away_score":14}' "$access"
[ "$status" = "200" ]; check "scoring the game 21-14 again after clearing returns 200 (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '[]' "$access"
[ "$status" = "400" ] && same '{"error":"Invalid request"}'
check "PUT score with a body that is not a JSON object returns 400 Invalid request (got ${status:-no answer} $body)" $?
put "/api/games/nope/score" '{"home_score":21,"away_score":14}' "$access"
[ "$status" = "404" ] && same '{"error":"Game not found"}'
check "an unknown game id returns 404 (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":21,"away_score":14}' "$other_access"
[ "$status" = "404" ] && same '{"error":"Game not found"}'
check "a second organizer scoring my game gets 404 (got ${status:-no answer} $body)" $?
post "/api/leagues/$LEAGUE_ID/schedule" "" "$access"
[ "$status" = "409" ] && same '{"error":"Scores already recorded — clear them first"}'
check "regenerating with a score returns 409 (got ${status:-no answer} $body)" $?
delete "/api/leagues/$LEAGUE_ID/scores" "$access"
[ "$status" = "200" ] && same '{"cleared":1}'; check "DELETE scores returns 200 cleared 1 (got ${status:-no answer} $body)" $?
post "/api/leagues/$LEAGUE_ID/schedule" "" "$access"
[ "$status" = "201" ]; check "regenerating after clearing returns 201 (got ${status:-no answer} $body)" $?
post /api/leagues '{"name":"Odd","location":"B","weeks":3}' "$access"
ODD_ID=$(echo "$body" | jq -r '.id')
for n in A B C; do post "/api/leagues/$ODD_ID/entrants" "{\"name\":\"$n\"}" "$access"; done
post "/api/leagues/$ODD_ID/schedule" "" "$access"
send GET "/api/leagues/$ODD_ID/games" "" "$access"
BYE_ID=$(echo "$body" | jq -r '[.[]|select(.away_id==null)][0].id')
for bye_body in '{"home_score":21,"away_score":14}' '{"home_score":null,"away_score":null}'; do
  put "/api/games/$BYE_ID/score" "$bye_body" "$access"
  [ "$status" = "400" ] && same '{"error":"A bye has no score"}'
  check "scoring a bye with $bye_body returns 400 (got ${status:-no answer} $body)" $?
done
send GET "/api/leagues/$LEAGUE_ID/games" "" "$access"
GAME_ID=$(echo "$body" | jq -r '[.[]|select(.week==1 and .away_id!=null)][0].id')
put "/api/games/$GAME_ID/score" '{"home_score":21,"away_score":14}' "$access"
[ "$status" = "200" ]; check "scoring a week-1 game 21-14 again returns 200 (left for the standings checks) (got ${status:-no answer} $body)" $?

stop_after schedule

# --- US06 · standings compute themselves ---
SORTED='Sorted by wins, then point difference, then points for.'
send GET "/api/leagues/$LEAGUE_ID/standings" "" "$access"
[ "$status" = "200" ] && echo "$body" | jq -e --arg t "$SORTED" '.played==1 and .tiebreak==$t and (.rows|length==6) and all(.rows[]; (keys|length)==8)' >/dev/null
check "GET standings returns 200 with played 1, 6 rows of 8 keys and the tiebreak sentence (got ${status:-no answer} $body)" $?
echo "$body" | jq -e '.rows[0]|.w==1 and .l==0 and .t==0 and .pf==21 and .pa==14 and .diff==7' >/dev/null
check "the 21-scorer is first with w 1, l 0, pf 21, pa 14, diff 7 (got $body)" $?
send GET "/api/leagues/$LEAGUE_ID/standings" "" "$other_access"
[ "$status" = "404" ] && same '{"error":"League not found"}'
check "a second organizer reading my standings gets 404 (got ${status:-no answer} $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":null,"away_score":null}' "$access"
send GET "/api/leagues/$LEAGUE_ID/standings" "" "$access"
echo "$body" | jq -e '.played==0' >/dev/null
check "a cleared game no longer counts in standings (got $body)" $?
put "/api/games/$GAME_ID/score" '{"home_score":21,"away_score":14}' "$access"
[ "$status" = "200" ]; check "scoring the game 21-14 again (left for the public-page checks) (got ${status:-no answer} $body)" $?

# --- US07 · public link: no token ---
send GET "/api/public/$LEAGUE_SLUG" "" ""
[ "$status" = "200" ] && echo "$body" | jq -e '(.league|has("id")|not) and .league.name=="Tuesday Cornhole" and (.league.location|length>0) and (.games|length==15) and .current_week==1 and .standings.played==1 and (.standings.rows|length==6)' >/dev/null
check "GET /public/{slug} with no token returns 200: league without id, 15 games, current_week 1, played 1 (got ${status:-no answer} $body)" $?
send GET "/api/public/zzzzzz" "" ""
[ "$status" = "404" ] && same '{"error":"League not found"}'
check "GET /public/zzzzzz returns 404 League not found (got ${status:-no answer} $body)" $?

finish
