from api.models import Game
from api.standings import played_count
from api.test_schedule import ScheduleTestCase

WHOLE = {"error": "Scores must be whole numbers 0 or greater"}
INVALID = {"error": "Invalid request"}
JSON = "application/json"


class ScoreHelpers:
    """Setup shared with the standings and public-page tests (a mixin, so importing it adds no test cases)."""

    def setup_league(self, n=4, ties=False, email="dana@example.com"):
        h = self.signed_in_as(email)
        lid = self.make_league(h, n, allow_ties=ties)
        self.generate(h, lid)
        return h, lid

    def played(self, h, lid):
        return next(g for g in self.games(h, lid) if g["away_id"])

    def put(self, h, gid, body):
        return self.client.put(f"/api/games/{gid}/score", body, format="json", **h)

    def put_raw(self, h, gid, text):
        return self.client.put(f"/api/games/{gid}/score", data=text, content_type=JSON, **h)


class ScoreTests(ScoreHelpers, ScheduleTestCase):
    def test_score_saved_and_shown_on_the_game(self):
        h, lid = self.setup_league()
        g = self.played(h, lid)
        r = self.put(h, g["id"], {"home_score": 21, "away_score": 14})
        self.check(r, 200, {**g, "home_score": 21, "away_score": 14})
        self.assertEqual({x["id"]: x for x in self.games(h, lid)}[g["id"]]["home_score"], 21)
        self.assertEqual(self.client.put(f"/api/games/{g['id']}/score/", {"home_score": 1, "away_score": 0}, format="json", **h).status_code, 200)

    def test_second_put_replaces_the_score(self):
        h, lid = self.setup_league()
        gid = self.played(h, lid)["id"]
        self.put(h, gid, {"home_score": 21, "away_score": 14})
        r = self.put(h, gid, {"home_score": 3, "away_score": 0})
        self.assertEqual((r.status_code, r.json()["home_score"], r.json()["away_score"]), (200, 3, 0))

    def test_not_whole_numbers_refused_and_nothing_stored(self):
        bodies = [
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
        ]
        h, lid = self.setup_league()
        gid = self.played(h, lid)["id"]
        for body in bodies:
            self.check(self.put(h, gid, body), 400, WHOLE)
            after = next(g for g in self.games(h, lid) if g["id"] == gid)
            self.assertEqual((after["home_score"], after["away_score"]), (None, None), body)

    def test_nan_and_infinity_do_not_crash(self):
        h, lid = self.setup_league()
        gid = self.played(h, lid)["id"]
        for text in ('{"home_score": NaN, "away_score": 1}', '{"home_score": Infinity, "away_score": 1}'):
            r = self.put_raw(h, gid, text)
            self.assertIn(r.status_code, (200, 400))
            self.assertNotEqual(r.status_code, 500)
            self.assertEqual(r.status_code, 400)
            self.assertIn("error", r.json())

    def test_max_score_just_under_two_to_the_31_is_accepted(self):
        h, lid = self.setup_league(ties=True)
        r = self.put(h, self.played(h, lid)["id"], {"home_score": 2**31 - 1, "away_score": 0})
        self.assertEqual((r.status_code, r.json()["home_score"]), (200, 2**31 - 1))

    def test_non_object_body_is_400(self):
        h, lid = self.setup_league()
        gid = self.played(h, lid)["id"]
        for body in ([1, 2], "x", 5):
            self.check(self.put(h, gid, body), 400, INVALID)
        self.check(self.put_raw(h, gid, "nope"), 400, INVALID)
        self.check(self.client.put(f"/api/games/{gid}/score", content_type=JSON, **h), 400, INVALID)

    def test_tie_refused_when_league_has_no_ties(self):
        h, lid = self.setup_league()
        gid = self.played(h, lid)["id"]
        self.check(self.put(h, gid, {"home_score": 15, "away_score": 15}), 400, {"error": "This league doesn't allow ties"})
        self.assertIsNone(self.played(h, lid)["home_score"])

    def test_tie_allowed_when_league_allows_ties(self):
        h, lid = self.setup_league(ties=True)
        r = self.put(h, self.played(h, lid)["id"], {"home_score": 15, "away_score": 15})
        self.assertEqual((r.status_code, r.json()["away_score"]), (200, 15))

    def test_ties_are_per_league(self):
        h = self.signed_in_as()
        tied = self.make_league(h, 4, allow_ties=True)
        strict = self.make_league(h, 4)
        for lid in (tied, strict):
            self.generate(h, lid)
        body = {"home_score": 2, "away_score": 2}
        self.assertEqual(self.put(h, self.played(h, tied)["id"], body).status_code, 200)
        self.assertEqual(self.put(h, self.played(h, strict)["id"], body).status_code, 400)

    def test_zero_zero_is_a_score(self):
        h, lid = self.setup_league(ties=True)
        r = self.put(h, self.played(h, lid)["id"], {"home_score": 0, "away_score": 0})
        self.assertEqual((r.status_code, r.json()["home_score"]), (200, 0))

    def test_bye_has_no_score(self):
        h, lid = self.setup_league(n=5)
        bye = next(g for g in self.games(h, lid) if g["away_id"] is None)
        for body in ({"home_score": 21, "away_score": 14}, {"home_score": None, "away_score": None}, {}):
            self.check(self.put(h, bye["id"], body), 400, {"error": "A bye has no score"})

    def test_other_organizers_game_and_unknown_game_are_404(self):
        h, lid = self.setup_league()
        gid = self.played(h, lid)["id"]
        o = self.signed_in_as("other@example.com")
        for who, game_id in ((o, gid), (h, "nope")):
            self.check(self.put(who, game_id, {"home_score": 21, "away_score": 14}), 404, {"error": "Game not found"})
        self.assertIsNone(self.played(h, lid)["home_score"])

    def test_signed_out_is_401(self):
        h, lid = self.setup_league()
        r = self.client.put(f"/api/games/{self.played(h, lid)['id']}/score", {"home_score": 1, "away_score": 0}, format="json")
        self.check(r, 401, {"error": "Sign in required"})

    def test_integral_floats_are_accepted_as_ints(self):
        h, lid = self.setup_league()
        gid = self.played(h, lid)["id"]
        r = self.put_raw(h, gid, '{"home_score": 21.0, "away_score": 14.0}')
        self.assertEqual((r.status_code, r.json()["home_score"], r.json()["away_score"]), (200, 21, 14))
        self.assertIs(type(r.json()["home_score"]), int)

    def test_unreadable_body_is_refused_before_the_game_is_looked_up(self):
        h, _ = self.setup_league()
        self.check(self.put(h, "nope", [1]), 400, INVALID)

    def test_both_null_or_empty_clears_a_played_game_and_leaves_the_others(self):
        for body in ({"home_score": None, "away_score": None}, {}):
            h, lid = self.setup_league(email=f"c{len(body)}@example.com")
            first, second = [g for g in self.games(h, lid) if g["away_id"]][:2]
            self.put(h, first["id"], {"home_score": 21, "away_score": 14})
            self.put(h, second["id"], {"home_score": 3, "away_score": 1})
            self.assertEqual(played_count(Game.objects.filter(league_id=lid)), 2)
            self.check(self.put(h, first["id"], body), 200, {**first, "home_score": None, "away_score": None})
            by_id = {g["id"]: g for g in self.games(h, lid)}
            self.assertEqual((by_id[first["id"]]["home_score"], by_id[first["id"]]["away_score"]), (None, None))
            self.assertEqual((by_id[second["id"]]["home_score"], by_id[second["id"]]["away_score"]), (3, 1))
            self.assertEqual(played_count(Game.objects.filter(league_id=lid)), 1)

    def test_clearing_an_unplayed_game_is_a_no_op(self):
        h, lid = self.setup_league()
        g = self.played(h, lid)
        self.check(self.put(h, g["id"], {"home_score": None, "away_score": None}), 200, g)

    def test_one_null_and_one_number_is_refused_and_keeps_the_score(self):
        bodies = ({"home_score": None, "away_score": 21}, {"away_score": 21}, {"home_score": 21, "away_score": None})
        for i, body in enumerate(bodies):
            h, lid = self.setup_league(email=f"n{i}@example.com")
            gid = self.played(h, lid)["id"]
            self.put(h, gid, {"home_score": 5, "away_score": 2})
            self.check(self.put(h, gid, body), 400, WHOLE)
            after = next(g for g in self.games(h, lid) if g["id"] == gid)
            self.assertEqual((after["home_score"], after["away_score"]), (5, 2))
