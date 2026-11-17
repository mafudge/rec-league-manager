import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import seed
from app.models import Game, League, Organizer


@pytest.fixture
def run(client, monkeypatch):
    """Run `python -m app.seed` against the test database with the given DEMO_SEED."""
    monkeypatch.setattr(seed, "engine", client.engine)
    monkeypatch.setattr(seed, "create_tables", lambda: None)  # the fixture already made them

    def go(flag):
        if flag is None:
            monkeypatch.delenv("DEMO_SEED", raising=False)
        else:
            monkeypatch.setenv("DEMO_SEED", flag)
        seed.main()

    return go


def count(client, model):
    with Session(client.engine) as session:
        return session.scalar(select(func.count()).select_from(model))


def test_empty_database_gets_the_demo_league(client, run):
    run("1")
    r = client.post("/api/auth/login", json={"email": seed.EMAIL, "password": seed.PASSWORD})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    [league] = client.get("/api/leagues", headers=h).json()
    assert league["name"] == "Tuesday Cornhole" and league["location"] == "Joe's Tavern"
    assert league["sport"] == "Cornhole" and league["season"] == "Fall 2026"
    assert league["weeks"] == 5 and league["slug"] == seed.SLUG == "tuesdy"

    body = client.get(f"/api/public/{seed.SLUG}").json()
    assert len(body["standings"]["rows"]) == 6
    assert {g["week"] for g in body["games"]} == {1, 2, 3, 4, 5}
    week1 = [g for g in body["games"] if g["week"] == 1]
    assert week1 and all(g["home_score"] is not None and g["away_score"] is not None for g in week1)
    assert all(g["home_score"] is None for g in body["games"] if g["week"] > 1)
    assert body["current_week"] == 2


def test_seed_leaves_a_used_database_alone(client, run):
    run("1")
    before = (count(client, Organizer), count(client, League), count(client, Game))
    run("1")
    assert (count(client, Organizer), count(client, League), count(client, Game)) == before


def test_seed_skips_when_anyone_has_signed_up(client, run):
    client.post("/api/auth/signup", json={"email": "dana@example.com", "password": "cornhole1"})
    run("1")
    assert count(client, Organizer) == 1 and count(client, League) == 0


@pytest.mark.parametrize("flag", [None, "", "0", "true"])
def test_seed_does_nothing_unless_demo_seed_is_1(client, run, flag):
    run(flag)
    assert count(client, Organizer) == 0
