from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Game
from tests.conftest import signed_in

LEAGUE = {"name": "Tuesday Cornhole", "location": "Joe's Tavern", "weeks": 8}


def make(client, h, n, weeks=8):
    lid = client.post("/api/leagues", json={**LEAGUE, "weeks": weeks}, headers=h).json()["id"]
    for i in range(n):
        client.post(f"/api/leagues/{lid}/entrants", json={"name": f"Team {i}"}, headers=h)
    return lid


def generate(client, h, lid):
    return client.post(f"/api/leagues/{lid}/schedule", headers=h)


def games(client, h, lid):
    return client.get(f"/api/leagues/{lid}/games", headers=h).json()


def score_one(client, lid):
    with Session(client.engine) as s:
        g = s.scalars(select(Game).where(Game.league_id == lid, Game.away_id.is_not(None))).first()
        g.home_score, g.away_score = 21, 14
        s.commit()


def test_fewer_than_two_entrants_refused_and_nothing_made(client):
    h = signed_in(client)
    for n in (0, 1):
        lid = make(client, h, n)
        r = generate(client, h, lid)
        assert r.status_code == 400 and r.json() == {"error": "Add at least 2 entrants first"}
        assert games(client, h, lid) == []


def test_no_schedule_is_empty_list(client):
    h = signed_in(client)
    assert games(client, h, make(client, h, 4)) == []


def test_six_entrants_in_eight_week_league_sets_weeks_to_five(client):
    h = signed_in(client)
    lid = make(client, h, 6)
    r = generate(client, h, lid)
    assert r.status_code == 201
    assert r.json() == {
        "weeks": 5,
        "message": "This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8.",
    }
    assert client.get(f"/api/leagues/{lid}", headers=h).json()["weeks"] == 5
    g = games(client, h, lid)
    assert len(g) == 15 and sorted({x["week"] for x in g}) == [1, 2, 3, 4, 5]
    assert set(g[0]) == {"id", "week", "home_id", "home_name", "away_id", "away_name", "home_score", "away_score"}
    assert [x["week"] for x in g] == sorted(x["week"] for x in g)


def test_seven_entrants_in_six_week_league(client):
    h = signed_in(client)
    lid = make(client, h, 7, weeks=6)
    r = generate(client, h, lid)
    assert r.json()["message"] == "This schedule needs 7 weeks, so the league now runs 7 weeks instead of 6."


def test_matching_weeks_has_no_message(client):
    h = signed_in(client)
    lid = make(client, h, 6, weeks=5)
    assert generate(client, h, lid).json() == {"weeks": 5, "message": None}


def test_byes_have_null_away(client):
    h = signed_in(client)
    lid = make(client, h, 5)
    generate(client, h, lid)
    byes = [x for x in games(client, h, lid) if x["away_id"] is None]
    assert len(byes) == 5
    assert all(b["away_name"] is None and b["home_score"] is None and b["away_score"] is None for b in byes)


def test_regenerating_without_scores_replaces_games(client):
    h = signed_in(client)
    lid = make(client, h, 6)
    generate(client, h, lid)
    old = {x["id"] for x in games(client, h, lid)}
    r = generate(client, h, lid)
    assert r.status_code == 201 and r.json()["message"] is None
    new = {x["id"] for x in games(client, h, lid)}
    assert len(new) == 15 and not (old & new)


def test_regenerating_with_a_score_is_refused(client):
    h = signed_in(client)
    lid = make(client, h, 6)
    generate(client, h, lid)
    before = games(client, h, lid)
    score_one(client, lid)
    r = generate(client, h, lid)
    assert r.status_code == 409 and r.json() == {"error": "Scores already recorded — clear them first"}
    assert {x["id"] for x in games(client, h, lid)} == {x["id"] for x in before}


def test_clear_scores_then_regenerate(client):
    h = signed_in(client)
    lid = make(client, h, 6)
    generate(client, h, lid)
    ids = [x["id"] for x in games(client, h, lid)]
    score_one(client, lid)
    r = client.delete(f"/api/leagues/{lid}/scores", headers=h)
    assert r.status_code == 200 and r.json() == {"cleared": 1}
    after = games(client, h, lid)
    assert [x["id"] for x in after] == ids
    assert all(x["home_score"] is None and x["away_score"] is None for x in after)
    assert generate(client, h, lid).status_code == 201


def test_clear_with_no_scores_and_byes_untouched(client):
    h = signed_in(client)
    lid = make(client, h, 5)
    generate(client, h, lid)
    assert client.delete(f"/api/leagues/{lid}/scores", headers=h).json() == {"cleared": 0}
    assert len(games(client, h, lid)) == 15


def test_other_organizer_gets_404_and_signed_out_401(client):
    h = signed_in(client)
    lid = make(client, h, 4)
    o = signed_in(client, "other@example.com")
    calls = [("post", "schedule"), ("get", "games"), ("delete", "scores")]
    for method, path in calls:
        r = getattr(client, method)(f"/api/leagues/{lid}/{path}", headers=o)
        assert r.status_code == 404 and r.json() == {"error": "League not found"}
        r = getattr(client, method)(f"/api/leagues/{lid}/{path}")
        assert r.status_code == 401
