# Django backend (stub)

Python · Django · Django REST Framework · SQLite. Batteries included.

## Install
```bash
python3 -m venv .venv          # if this fails: sudo apt install python3-venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
```

## Run
```bash
python manage.py runserver     # port 8001, so it can run alongside FastAPI on 8000
curl localhost:8001/api/backend   # {"backend":"django"}; a trailing slash works too
../../contract-test.sh http://localhost:8001   # while the port is unfinished: CONTRACT_UPTO=accounts (then leagues, schedule, all)
```
`ALLOWED_HOSTS` accepts only `localhost`. A phone on the LAN would need this machine's address added.

## Test
```bash
python manage.py test
```

## TODO
- [ ] Models: league, entrant, game (migrations)
- [x] Organizer sign-up and sign-in (US01, US13): Django's `User` (email is the username) with simplejwt behind the contract's `{token, refresh_token}`; every error is `{"error": …}` (`api/errors.py`). Only the 8-character password rule applies, not Django's validators. Set `JWT_SECRET` outside development (it falls back to `SECRET_KEY`)
- [ ] League, entrant, schedule, score and standings endpoints (US02–US07)
- [ ] Public read-only endpoints (US07)
- [ ] Move `SECRET_KEY`/`DEBUG` to environment variables before any deployment
- [x] The shared REST contract (ADR 003), with CORS for browser frontends (`django-cors-headers`); see [`src/README.md`](../../README.md)
