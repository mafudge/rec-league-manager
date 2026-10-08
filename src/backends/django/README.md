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
../../contract-test.sh http://localhost:8001
```
`ALLOWED_HOSTS` accepts `localhost` and `10.0.2.2`, which is how the Android emulator reaches this machine. A phone on the LAN would need this machine's address added too.

## Test
```bash
python manage.py test
```

## TODO
- [ ] Models: league, entrant, game (migrations)
- [ ] Organizer sign-in with Django auth (US01)
- [ ] League, entrant, schedule, score and standings endpoints (US02–US07)
- [ ] Public read-only endpoints (US07)
- [ ] Move `SECRET_KEY`/`DEBUG` to environment variables before any deployment
- [x] The shared REST contract (ADR 003), with CORS for browser frontends (`django-cors-headers`); see [`src/README.md`](../../README.md)
