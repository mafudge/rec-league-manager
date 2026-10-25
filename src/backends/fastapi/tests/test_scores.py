import pytest

from tests.conftest import signed_in
from tests.test_schedule import LEAGUE, games, generate, make

WHOLE = {"error": "Scores must be whole numbers 0 or greater"}


def setup(client, n=4, ties=False):
    h = signed_in(client)
    lid = client.post("/api/leagues", json={**LEAGUE, "allow_ties": ties}, headers=h).json()["id"]
    for i in range(n):
        client.post(f"/api/leagues/{lid}/entrants", json={"name": f"Team {i}"}, headers=h)
    generate(client, h, lid)
    return h, lid


def played(client, h, lid):
    return next(g for g in games(client, h, lid) if g["away_id"])


def put(client, h, gid, body):
    return client.put(f"/api/games/{gid}/score", json=body, headers=h)


def test_score_saved_and_shown_on_the_game(client):
    h, lid = setup(client)
    g = played(client, h, lid)
    r = put(client, h, g["id"], {"home_score": 21, "away_score": 14})
    assert r.status_code == 200
    assert r.json() == {**g, "home_score": 21, "away_score": 14}
    assert {x["id"]: x for x in games(client, h, lid)}[g["id"]]["home_score"] == 21


def test_second_put_replaces_the_score(client):
    h, lid = setup(client)
    gid = played(client, h, lid)["id"]
    put(client, h, gid, {"home_score": 21, "away_score": 14})
    r = put(client, h, gid, {"home_score": 3, "away_score": 0})
    assert r.status_code == 200 and (r.json()["home_score"], r.json()["away_score"]) == (3, 0)


@pytest.mark.parametrize(
    "body",
    [
        {"home_score": -1, "away_score": 14},
        {"home_score": None, "away_score": 14},
        {"away_score": 14},
        {"home_score": 21.5, "away_score": 14},
        {"home_score": 21, "away_score": 14.5},
        {"home_score": "21", "away_score": 14},
        {"home_score": True, "away_score": 14},
        {"home_score": 21, "away_score": False},
        {"home_score": 10**30, "away_score": 14},
        {"home_score": 21, "away_score": 2**31},
    ],
)
def test_not_whole_numbers_refused_and_nothing_stored(client, body):
    h, lid = setup(client)
    gid = played(client, h, lid)["id"]
    r = put(client, h, gid, body)
    assert r.status_code == 400 and r.json() == WHOLE
    after = next(g for g in games(client, h, lid) if g["id"] == gid)
    assert after["home_score"] is None and after["away_score"] is None


def test_non_object_body_is_400(client):
    h, lid = setup(client)
    gid = played(client, h, lid)["id"]
    for body in ([1, 2], "x", 5):
        r = put(client, h, gid, body)
        assert (r.status_code, r.json()) == (400, {"error": "Invalid request"})
    broken = client.put(f"/api/games/{gid}/score", content="nope", headers={**h, "Content-Type": "application/json"})
    assert (broken.status_code, broken.json()) == (400, {"error": "Invalid request"})


def test_tie_refused_when_league_has_no_ties(client):
    h, lid = setup(client)
    gid = played(client, h, lid)["id"]
    r = put(client, h, gid, {"home_score": 15, "away_score": 15})
    assert r.status_code == 400 and r.json() == {"error": "This league doesn't allow ties"}
    assert played(client, h, lid)["home_score"] is None


def test_tie_allowed_when_league_allows_ties(client):
    h, lid = setup(client, ties=True)
    r = put(client, h, played(client, h, lid)["id"], {"home_score": 15, "away_score": 15})
    assert r.status_code == 200 and r.json()["away_score"] == 15


def test_zero_zero_is_a_score(client):
    h, lid = setup(client, ties=True)
    r = put(client, h, played(client, h, lid)["id"], {"home_score": 0, "away_score": 0})
    assert r.status_code == 200 and r.json()["home_score"] == 0


def test_bye_has_no_score(client):
    h, lid = setup(client, n=5)
    bye = next(g for g in games(client, h, lid) if g["away_id"] is None)
    r = put(client, h, bye["id"], {"home_score": 21, "away_score": 14})
    assert r.status_code == 400 and r.json() == {"error": "A bye has no score"}
    for body in ({"home_score": None, "away_score": None}, {}):
        r = put(client, h, bye["id"], body)
        assert r.status_code == 400 and r.json() == {"error": "A bye has no score"}


def test_other_organizers_game_and_unknown_game_are_404(client):
    h, lid = setup(client)
    gid = played(client, h, lid)["id"]
    o = signed_in(client, "other@example.com")
    for who, game_id in ((o, gid), (h, "nope")):
        r = put(client, who, game_id, {"home_score": 21, "away_score": 14})
        assert r.status_code == 404 and r.json() == {"error": "Game not found"}
    assert played(client, h, lid)["home_score"] is None


def test_signed_out_is_401(client):
    h, lid = setup(client)
    r = client.put(f"/api/games/{played(client, h, lid)['id']}/score", json={"home_score": 1, "away_score": 0})
    assert r.status_code == 401


def test_integral_floats_are_accepted_as_ints(client):
    h, lid = setup(client)
    gid = played(client, h, lid)["id"]
    r = client.put(f"/api/games/{gid}/score", content='{"home_score": 21.0, "away_score": 14.0}',
                   headers={**h, "Content-Type": "application/json"})
    assert r.status_code == 200
    assert r.json()["home_score"] == 21 and r.json()["away_score"] == 14
    assert type(r.json()["home_score"]) is int


def test_unreadable_body_is_refused_before_the_game_is_looked_up(client):
    h, _ = setup(client)
    r = client.put("/api/games/nope/score", json=[1], headers=h)
    assert (r.status_code, r.json()) == (400, {"error": "Invalid request"})


def standings_played(client, h, lid):
    return client.get(f"/api/leagues/{lid}/standings", headers=h).json()["played"]


@pytest.mark.parametrize("body", [{"home_score": None, "away_score": None}, {}])
def test_both_null_clears_a_played_game_and_leaves_the_others(client, body):
    h, lid = setup(client)
    first, second = [g for g in games(client, h, lid) if g["away_id"]][:2]
    put(client, h, first["id"], {"home_score": 21, "away_score": 14})
    put(client, h, second["id"], {"home_score": 3, "away_score": 1})
    assert standings_played(client, h, lid) == 2
    r = put(client, h, first["id"], body)
    assert r.status_code == 200 and r.json() == {**first, "home_score": None, "away_score": None}
    by_id = {g["id"]: g for g in games(client, h, lid)}
    assert by_id[first["id"]]["home_score"] is None and by_id[first["id"]]["away_score"] is None
    assert (by_id[second["id"]]["home_score"], by_id[second["id"]]["away_score"]) == (3, 1)
    assert standings_played(client, h, lid) == 1


def test_clearing_an_unplayed_game_is_a_no_op(client):
    h, lid = setup(client)
    g = played(client, h, lid)
    r = put(client, h, g["id"], {"home_score": None, "away_score": None})
    assert r.status_code == 200 and r.json() == g


@pytest.mark.parametrize("body", [{"home_score": None, "away_score": 21}, {"away_score": 21}, {"home_score": 21, "away_score": None}])
def test_one_null_and_one_number_is_refused_and_keeps_the_score(client, body):
    h, lid = setup(client)
    gid = played(client, h, lid)["id"]
    put(client, h, gid, {"home_score": 5, "away_score": 2})
    r = put(client, h, gid, body)
    assert r.status_code == 400 and r.json() == WHOLE
    after = next(g for g in games(client, h, lid) if g["id"] == gid)
    assert (after["home_score"], after["away_score"]) == (5, 2)
