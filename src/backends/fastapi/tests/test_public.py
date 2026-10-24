from tests.conftest import signed_in
from tests.test_schedule import LEAGUE, games
from tests.test_scores import put, setup


def public(client, slug, headers=None):
    return client.get(f"/api/public/{slug}", headers=headers or {})


def slug_of(client, h, lid):
    return client.get(f"/api/leagues/{lid}", headers=h).json()["slug"]


def score(client, h, lid, week=None):
    for g in games(client, h, lid):
        if g["away_id"] and (week is None or g["week"] == week):
            put(client, h, g["id"], {"home_score": 21, "away_score": 14})


def test_no_token_needed_and_league_has_no_id(client):
    h, lid = setup(client, n=6)
    r = public(client, slug_of(client, h, lid))
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"league", "current_week", "games", "standings"}
    assert "id" not in body["league"]
    assert body["league"]["name"] == "Tuesday Cornhole" and body["league"]["location"] == "Joe's Tavern"
    assert len(body["games"]) == 15 and body["standings"]["played"] == 0 and len(body["standings"]["rows"]) == 6


def test_a_bad_token_header_makes_no_difference(client):
    h, lid = setup(client)
    r = public(client, slug_of(client, h, lid), {"Authorization": "Bearer nonsense"})
    assert r.status_code == 200


def test_current_week_follows_the_scores(client):
    h, lid = setup(client, n=6)
    slug = slug_of(client, h, lid)
    assert public(client, slug).json()["current_week"] == 1
    score(client, h, lid, week=1)
    assert public(client, slug).json()["current_week"] == 2
    score(client, h, lid)
    body = public(client, slug).json()
    assert body["current_week"] == 5 and body["standings"]["played"] == 15


def test_a_bye_does_not_hold_the_week_open(client):
    h, lid = setup(client, n=3)  # one bye a week
    slug = slug_of(client, h, lid)
    score(client, h, lid, week=1)
    assert public(client, slug).json()["current_week"] == 2
    score(client, h, lid)
    assert public(client, slug).json()["current_week"] == 3


def test_no_schedule_means_null_current_week(client):
    h = signed_in(client)
    league = client.post("/api/leagues", json=LEAGUE, headers=h).json()
    body = public(client, league["slug"]).json()
    assert body["current_week"] is None and body["games"] == [] and body["standings"]["rows"] == []


def test_unknown_slug_is_404(client):
    r = public(client, "zzzzzz")
    assert r.status_code == 404 and r.json() == {"error": "League not found"}
