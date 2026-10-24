from api.test_schedule import ScheduleTestCase
from api.test_scores import ScoreHelpers

TIEBREAK = "Sorted by wins, then point difference, then points for."
KEYS = {"entrant_id", "name", "w", "l", "t", "pf", "pa", "diff"}


class StandingsRouteTests(ScoreHelpers, ScheduleTestCase):
    def standings(self, h, lid):
        return self.client.get(f"/api/leagues/{lid}/standings", **h)

    def test_no_scores_every_entrant_listed_with_zeros(self):
        h, lid = self.setup_league(n=6)
        r = self.standings(h, lid)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual((body["played"], body["tiebreak"]), (0, TIEBREAK))
        self.assertEqual(len(body["rows"]), 6)
        for x in body["rows"]:
            self.assertEqual(set(x), KEYS)
            self.assertTrue(all(x[k] == 0 for k in KEYS - {"entrant_id", "name"}))

    def test_trailing_slash_accepted(self):
        h, lid = self.setup_league()
        self.assertEqual(self.client.get(f"/api/leagues/{lid}/standings/", **h).status_code, 200)

    def test_after_two_scores_rows_are_computed_and_ordered(self):
        h, lid = self.setup_league(n=6)
        g1, g2 = [g for g in self.games(h, lid) if g["away_id"]][:2]
        self.put(h, g1["id"], {"home_score": 21, "away_score": 14})
        self.put(h, g2["id"], {"home_score": 10, "away_score": 15})
        body = self.standings(h, lid).json()
        self.assertEqual(body["played"], 2)
        top = body["rows"][0]
        self.assertEqual(top["entrant_id"], g1["home_id"])
        self.assertEqual((top["w"], top["l"], top["pf"], top["pa"], top["diff"]), (1, 0, 21, 14, 7))
        by = {x["entrant_id"]: x for x in body["rows"]}
        self.assertEqual((by[g2["away_id"]]["w"], by[g2["away_id"]]["diff"]), (1, 5))
        self.assertEqual((by[g2["home_id"]]["l"], by[g2["home_id"]]["diff"]), (1, -5))
        self.assertEqual([x["w"] for x in body["rows"]], [1, 1, 0, 0, 0, 0])

    def test_ties_give_each_side_a_t(self):
        h, lid = self.setup_league(n=4, ties=True)
        g = self.played(h, lid)
        self.put(h, g["id"], {"home_score": 5, "away_score": 5})
        by = {x["entrant_id"]: x for x in self.standings(h, lid).json()["rows"]}
        self.assertEqual((by[g["home_id"]]["t"], by[g["away_id"]]["t"]), (1, 1))
        self.assertEqual((by[g["home_id"]]["w"], by[g["home_id"]]["l"]), (0, 0))

    def test_clearing_scores_resets_standings(self):
        h, lid = self.setup_league()
        g = self.played(h, lid)
        self.put(h, g["id"], {"home_score": 2, "away_score": 1})
        self.client.delete(f"/api/leagues/{lid}/scores", **h)
        self.assertEqual(self.standings(h, lid).json()["played"], 0)

    def test_another_organizer_gets_404(self):
        h, lid = self.setup_league()
        other = self.signed_in_as("other@example.com")
        self.check(self.standings(other, lid), 404, {"error": "League not found"})

    def test_requires_sign_in(self):
        h, lid = self.setup_league()
        self.assertEqual(self.client.get(f"/api/leagues/{lid}/standings").status_code, 401)
