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
python manage.py runserver
curl localhost:8000/api/health/   # {"status":"ok"}
```

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
- [ ] Shared API contract with the frontends
