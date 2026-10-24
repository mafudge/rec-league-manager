from tests.conftest import signed_in
from tests.test_schedule import games
from tests.test_scores import put, setup

TIEBREAK = "Sorted by wins, then point difference, then points for."
KEYS = {"entrant_id", "name", "w", "l", "t", "pf", "pa", "diff"}


def standings(client, h, lid):
    return client.get(f"/api/leagues/{lid}/standings", headers=h)


def test_no_scores_every_entrant_listed_with_zeros(client):
    h, lid = setup(client, n=6)
    r = standings(client, h, lid)
    assert r.status_code == 200
    body = r.json()
    assert body["played"] == 0 and body["tiebreak"] == TIEBREAK
    assert len(body["rows"]) == 6
    assert all(set(x) == KEYS and all(x[k] == 0 for k in KEYS - {"entrant_id", "name"}) for x in body["rows"])


def test_after_two_scores_rows_are_computed_and_ordered(client):
    h, lid = setup(client, n=6)
    g1, g2 = [g for g in games(client, h, lid) if g["away_id"]][:2]
    put(client, h, g1["id"], {"home_score": 21, "away_score": 14})
    put(client, h, g2["id"], {"home_score": 10, "away_score": 15})
    body = standings(client, h, lid).json()
    assert body["played"] == 2
    top = body["rows"][0]
    assert top["entrant_id"] == g1["home_id"] and (top["w"], top["l"], top["pf"], top["pa"], top["diff"]) == (1, 0, 21, 14, 7)
    by = {x["entrant_id"]: x for x in body["rows"]}
    assert (by[g2["away_id"]]["w"], by[g2["away_id"]]["diff"]) == (1, 5)
    assert (by[g2["home_id"]]["l"], by[g2["home_id"]]["diff"]) == (1, -5)
    assert [x["w"] for x in body["rows"]] == [1, 1, 0, 0, 0, 0]


def test_ties_give_each_side_a_t(client):
    h, lid = setup(client, n=4, ties=True)
    g = next(g for g in games(client, h, lid) if g["away_id"])
    put(client, h, g["id"], {"home_score": 5, "away_score": 5})
    by = {x["entrant_id"]: x for x in standings(client, h, lid).json()["rows"]}
    assert by[g["home_id"]]["t"] == 1 and by[g["away_id"]]["t"] == 1
    assert by[g["home_id"]]["w"] == 0 and by[g["home_id"]]["l"] == 0


def test_clearing_scores_resets_standings(client):
    h, lid = setup(client)
    g = next(g for g in games(client, h, lid) if g["away_id"])
    put(client, h, g["id"], {"home_score": 2, "away_score": 1})
    client.delete(f"/api/leagues/{lid}/scores", headers=h)
    assert standings(client, h, lid).json()["played"] == 0


def test_another_organizer_gets_404(client):
    h, lid = setup(client)
    other = signed_in(client, "other@example.com")
    r = standings(client, other, lid)
    assert r.status_code == 404 and r.json() == {"error": "League not found"}


def test_requires_sign_in(client):
    h, lid = setup(client)
    assert client.get(f"/api/leagues/{lid}/standings").status_code == 401
