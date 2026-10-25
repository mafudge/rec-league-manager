import pytest

from tests.conftest import signed_in

LEAGUE = {"name": "Tuesday Cornhole", "location": "Joe's Tavern", "weeks": 8}
DUP = {"error": "An entrant with that name already exists in this league"}


def league(client, h):
    return client.post("/api/leagues", json=LEAGUE, headers=h).json()["id"]


def add(client, h, lid, name):
    return client.post(f"/api/leagues/{lid}/entrants", json={"name": name}, headers=h)


def test_add_returns_entrant_and_lists_it(client):
    h = signed_in(client)
    lid = league(client, h)
    r = add(client, h, lid, "Bag Ladies")
    assert r.status_code == 201
    e = r.json()
    assert set(e) == {"id", "name"} and isinstance(e["id"], str) and e["name"] == "Bag Ladies"
    assert client.get(f"/api/leagues/{lid}/entrants", headers=h).json() == [e]


def test_list_is_order_added(client):
    h = signed_in(client)
    lid = league(client, h)
    names = ["Zed", "Alpha", "Mid", "Beta"]
    for n in names:
        add(client, h, lid, n)
    assert [e["name"] for e in client.get(f"/api/leagues/{lid}/entrants", headers=h).json()] == names


def test_name_is_trimmed_as_typed(client):
    h = signed_in(client)
    lid = league(client, h)
    assert add(client, h, lid, "  Corn Stars ").json()["name"] == "Corn Stars"


@pytest.mark.parametrize("again", ["Bag Ladies", " bag ladies ", "BAG LADIES"])
def test_duplicate_is_refused_however_typed(client, again):
    h = signed_in(client)
    lid = league(client, h)
    add(client, h, lid, "Bag Ladies")
    r = add(client, h, lid, again)
    assert (r.status_code, r.json()) == (409, DUP)
    assert len(client.get(f"/api/leagues/{lid}/entrants", headers=h).json()) == 1


@pytest.mark.parametrize("bad", ["", "   ", None, 5, True, ["x"]])
def test_blank_or_non_string_name(client, bad):
    h = signed_in(client)
    lid = league(client, h)
    r = client.post(f"/api/leagues/{lid}/entrants", json={"name": bad}, headers=h)
    assert (r.status_code, r.json()) == (400, {"error": "Name is required"})


def test_missing_name_and_non_object_body(client):
    h = signed_in(client)
    lid = league(client, h)
    r = client.post(f"/api/leagues/{lid}/entrants", json={}, headers=h)
    assert (r.status_code, r.json()) == (400, {"error": "Name is required"})
    for body in ([], "x", 5, None):
        r = client.post(f"/api/leagues/{lid}/entrants", json=body, headers=h)
        assert (r.status_code, r.json()) == (400, {"error": "Invalid request"})


def test_same_name_in_another_league_is_fine(client):
    h = signed_in(client)
    a, b = league(client, h), league(client, h)
    assert add(client, h, a, "Bag Ladies").status_code == 201
    assert add(client, h, b, "Bag Ladies").status_code == 201


def test_positions_are_per_league(client):
    h = signed_in(client)
    a, b = league(client, h), league(client, h)
    add(client, h, a, "One")
    add(client, h, b, "Two")
    add(client, h, b, "Three")
    assert [e["name"] for e in client.get(f"/api/leagues/{b}/entrants", headers=h).json()] == ["Two", "Three"]


def test_other_organizers_league_is_404(client):
    mine = signed_in(client)
    theirs = signed_in(client, "sam@example.com")
    lid = league(client, mine)
    for r in (add(client, theirs, lid, "X"), client.get(f"/api/leagues/{lid}/entrants", headers=theirs)):
        assert (r.status_code, r.json()) == (404, {"error": "League not found"})
    assert client.get(f"/api/leagues/{lid}/entrants", headers=mine).json() == []


def test_unknown_league_is_404_and_token_required(client):
    h = signed_in(client)
    assert client.get("/api/leagues/nope/entrants", headers=h).status_code == 404
    assert add(client, h, "nope", "X").status_code == 404
    r = client.get("/api/leagues/nope/entrants")
    assert (r.status_code, r.json()) == (401, {"error": "Sign in required"})
    assert client.post("/api/leagues/nope/entrants", json={"name": "X"}).status_code == 401


def test_duplicate_is_compared_trimmed_and_lower_cased(client):
    h = signed_in(client)
    lid = league(client, h)
    assert add(client, h, lid, "Bag Ladies").status_code == 201
    assert add(client, h, lid, " bag ladies ").status_code == 409


def test_duplicate_uses_lower_not_casefold(client):
    # JS toLowerCase() and Postgres lower() keep these apart, so every backend must.
    h = signed_in(client)
    lid = league(client, h)
    assert add(client, h, lid, "Straße").status_code == 201
    assert add(client, h, lid, "STRASSE").status_code == 201


def test_name_of_100_characters_is_kept_and_101_refused(client):
    h = signed_in(client)
    lid = league(client, h)
    assert add(client, h, lid, "a" * 100).status_code == 201
    r = add(client, h, lid, "b" * 101)
    assert (r.status_code, r.json()) == (400, {"error": "Name must be 100 characters or fewer"})
    assert add(client, h, lid, "  " + "c" * 100 + "  ").status_code == 201


def test_53rd_entrant_is_refused_and_not_stored(client):
    h = signed_in(client)
    lid = league(client, h)
    for i in range(52):
        assert add(client, h, lid, f"Team {i}").status_code == 201
    r = add(client, h, lid, "One too many")
    assert (r.status_code, r.json()) == (400, {"error": "A league can have at most 52 entrants"})
    assert len(client.get(f"/api/leagues/{lid}/entrants", headers=h).json()) == 52


def test_full_league_still_reports_a_duplicate_as_409(client):
    h = signed_in(client)
    lid = league(client, h)
    for i in range(52):
        add(client, h, lid, f"Team {i}")
    assert add(client, h, lid, "team 3").status_code == 409
    assert add(client, h, lid, " ").json() == {"error": "Name is required"}
    assert add(client, h, lid, "x" * 101).json() == {"error": "Name must be 100 characters or fewer"}
