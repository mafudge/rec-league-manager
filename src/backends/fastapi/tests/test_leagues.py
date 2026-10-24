import pytest

from app.slugs import ALPHABET, new_slug
from tests.conftest import signed_in

GOOD = {"name": "Tuesday Cornhole", "location": "Joe's Tavern", "sport": "Cornhole", "season": "Fall 2026", "weeks": 8}


def make(client, h, **over):
    return client.post("/api/leagues", json={**GOOD, **over}, headers=h)


def test_create_returns_league_and_lists_it(client):
    h = signed_in(client)
    r = make(client, h)
    assert r.status_code == 201
    league = r.json()
    assert isinstance(league["id"], str)
    assert len(league["slug"]) == 6 and set(league["slug"]) <= set(ALPHABET)
    assert {k: league[k] for k in GOOD} == GOOD
    assert league["allow_ties"] is False
    assert set(league) == {"id", "slug", "name", "location", "sport", "season", "weeks", "allow_ties"}
    listed = client.get("/api/leagues", headers=h).json()
    assert listed == [league]
    assert client.get(f"/api/leagues/{league['id']}", headers=h).json() == league


def test_list_is_oldest_first(client):
    h = signed_in(client)
    ids = [make(client, h, name=f"L{i}").json()["id"] for i in range(4)]
    assert [x["id"] for x in client.get("/api/leagues", headers=h).json()] == ids


def test_allow_ties_true_is_kept(client):
    h = signed_in(client)
    assert make(client, h, allow_ties=True).json()["allow_ties"] is True


@pytest.mark.parametrize("bad", ["yes", 1, None, "true"])
def test_allow_ties_must_be_boolean(client, bad):
    r = make(client, signed_in(client), allow_ties=bad)
    assert (r.status_code, r.json()) == (400, {"error": "Invalid request"})


def test_sport_and_season_optional_and_trimmed(client):
    h = signed_in(client)
    body = {"name": "A", "location": "B", "weeks": 3}
    league = client.post("/api/leagues", json=body, headers=h).json()
    assert (league["sport"], league["season"]) == ("", "")
    league = make(client, h, sport="  Darts ", season="   ").json()
    assert (league["sport"], league["season"]) == ("Darts", "")


def test_name_and_location_trimmed(client):
    h = signed_in(client)
    league = make(client, h, name="  Pitch  ", location=" Bar ").json()
    assert (league["name"], league["location"]) == ("Pitch", "Bar")


@pytest.mark.parametrize("loc", ["", "   ", None, 5])
def test_blank_location(client, loc):
    r = make(client, signed_in(client), location=loc)
    assert (r.status_code, r.json()) == (400, {"error": "Location is required"})


@pytest.mark.parametrize("name", ["", "  ", None, 5])
def test_blank_name(client, name):
    r = make(client, signed_in(client), name=name)
    assert (r.status_code, r.json()) == (400, {"error": "Name is required"})


def test_name_checked_before_location_before_weeks(client):
    h = signed_in(client)
    r = client.post("/api/leagues", json={"name": "", "location": "", "weeks": 0}, headers=h)
    assert r.json() == {"error": "Name is required"}
    r = client.post("/api/leagues", json={"name": "A", "location": "", "weeks": 0}, headers=h)
    assert r.json() == {"error": "Location is required"}


@pytest.mark.parametrize("weeks", [0, -1, "eight", "8", 2.5, True, None])
def test_bad_weeks(client, weeks):
    r = make(client, signed_in(client), weeks=weeks)
    assert (r.status_code, r.json()) == (400, {"error": "Weeks must be at least 1"})


def test_missing_weeks(client):
    r = client.post("/api/leagues", json={"name": "A", "location": "B"}, headers=signed_in(client))
    assert (r.status_code, r.json()) == (400, {"error": "Weeks must be at least 1"})


def test_refused_league_is_not_stored(client):
    h = signed_in(client)
    make(client, h, weeks=0)
    assert client.get("/api/leagues", headers=h).json() == []


def test_non_object_body_is_refused_not_500(client):
    r = client.post("/api/leagues", json=[1], headers=signed_in(client))
    assert (r.status_code, r.json()) == (400, {"error": "Name is required"})


def test_other_organizer_cannot_see_it(client):
    mine = signed_in(client)
    theirs = signed_in(client, "other@example.com")
    league = make(client, mine).json()
    assert client.get("/api/leagues", headers=theirs).json() == []
    r = client.get(f"/api/leagues/{league['id']}", headers=theirs)
    assert (r.status_code, r.json()) == (404, {"error": "League not found"})
    r = client.get("/api/leagues/nope", headers=mine)
    assert (r.status_code, r.json()) == (404, {"error": "League not found"})


def test_no_token_is_401(client):
    for call in (lambda: client.get("/api/leagues"), lambda: client.post("/api/leagues", json=GOOD),
                 lambda: client.get("/api/leagues/abc")):
        r = call()
        assert (r.status_code, r.json()) == (401, {"error": "Sign in required"})


def test_new_slug_retries_until_free():
    seen = []

    def taken(s):
        seen.append(s)
        return len(seen) < 3

    slug = new_slug(taken)
    assert len(seen) == 3 and slug == seen[-1]
    assert len(slug) == 6 and set(slug) <= set(ALPHABET)
