"""Fill an empty database with the demo league (REL-01a): `DEMO_SEED=1 python -m app.seed`.

A deployed API starts on an empty disk, so the live site would have nothing to show. The seed
signs up a demo organizer and builds the PRD demo league through the real routes, so every
rule the app enforces also holds for the seed. It never touches a database someone has used.
"""

import os

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import create_tables, engine
from .main import app
from .models import League, Organizer

EMAIL = "demo@recleague.example"
PASSWORD = "cornhole-demo"
SLUG = "tuesdy"  # fixed, so the README's public link never changes; letters from slugs.ALPHABET
LEAGUE = {"name": "Tuesday Cornhole", "location": "Joe's Tavern", "sport": "Cornhole", "season": "Fall 2026", "weeks": 8}
TEAMS = ["Bag Ladies", "Corn Stars", "Hole in One", "Sack Attack", "Toss Bosses", "Board Meeting"]
WEEK1_SCORES = [(21, 15), (21, 18), (12, 21)]


def call(client: TestClient, method: str, path: str, **kwargs) -> dict:
    r = client.request(method, path, **kwargs)
    if r.status_code >= 400:
        # A broken seed must fail the deploy, not start an empty site.
        raise RuntimeError(f"Seed refused at {method} {path}: {r.status_code} {r.text}")
    return r.json()


def seed(client: TestClient) -> str:
    """Build the demo league through the API and return its id."""
    token = call(client, "POST", "/api/auth/signup", json={"email": EMAIL, "password": PASSWORD})["token"]
    h = {"Authorization": f"Bearer {token}"}
    lid = call(client, "POST", "/api/leagues", json=LEAGUE, headers=h)["id"]
    for name in TEAMS:
        call(client, "POST", f"/api/leagues/{lid}/entrants", json={"name": name}, headers=h)
    call(client, "POST", f"/api/leagues/{lid}/schedule", headers=h)
    week1 = [g for g in call(client, "GET", f"/api/leagues/{lid}/games", headers=h) if g["week"] == 1 and g["away_id"]]
    for g, (home, away) in zip(week1, WEEK1_SCORES):
        call(client, "PUT", f"/api/games/{g['id']}/score", json={"home_score": home, "away_score": away}, headers=h)
    return lid


def main() -> None:
    if os.environ.get("DEMO_SEED") != "1":
        print("Demo seed skipped (DEMO_SEED is not 1)")
        return
    create_tables()
    with Session(engine) as session:
        if session.scalar(select(Organizer.id).limit(1)) is not None:
            print("Demo seed skipped (the database already has organizers)")
            return
        lid = seed(TestClient(app))
        session.get(League, lid).slug = SLUG
        session.commit()
    print(f"Demo seed done: {EMAIL} / {PASSWORD}, public link /l/{SLUG}")


if __name__ == "__main__":
    main()
