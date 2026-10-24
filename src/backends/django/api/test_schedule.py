from api.models import Game
from api.standings import is_played, played_count
from api.test_auth import SIGN_IN_REQUIRED
from api.test_leagues import GOOD, NOT_FOUND, LeagueTestCase

LEAGUE = {"name": "Tuesday Cornhole", "location": "Joe's Tavern", "weeks": 8}


class ScheduleTestCase(LeagueTestCase):
    def make_league(self, h, n, weeks=8, **over):
        lid = self.post("/api/leagues", {**LEAGUE, "weeks": weeks, **over}, **h).json()["id"]
        for i in range(n):
            self.post(f"/api/leagues/{lid}/entrants", {"name": f"Team {i}"}, **h)
        return lid

    def generate(self, h, lid):
        return self.client.post(f"/api/leagues/{lid}/schedule", **h)

    def games(self, h, lid):
        return self.client.get(f"/api/leagues/{lid}/games", **h).json()


class ScheduleTests(ScheduleTestCase):
    def score_one(self, lid):
        g = Game.objects.filter(league_id=lid, away__isnull=False).order_by("week", "slot").first()
        g.home_score, g.away_score = 21, 14
        g.save()

    def test_fewer_than_two_entrants_refused_and_nothing_made(self):
        h = self.signed_in_as()
        for n in (0, 1):
            lid = self.make_league(h, n)
            self.check(self.generate(h, lid), 400, {"error": "Add at least 2 entrants first"})
            self.assertEqual(self.games(h, lid), [])

    def test_no_schedule_is_empty_list(self):
        h = self.signed_in_as()
        self.assertEqual(self.games(h, self.make_league(h, 4)), [])

    def test_six_entrants_in_eight_week_league_sets_weeks_to_five(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 6)
        self.check(
            self.generate(h, lid),
            201,
            {"weeks": 5, "message": "This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8."},
        )
        self.assertEqual(self.client.get(f"/api/leagues/{lid}", **h).json()["weeks"], 5)
        g = self.games(h, lid)
        self.assertEqual(len(g), 15)
        self.assertEqual(sorted({x["week"] for x in g}), [1, 2, 3, 4, 5])
        self.assertEqual(
            set(g[0]), {"id", "week", "home_id", "home_name", "away_id", "away_name", "home_score", "away_score"}
        )
        self.assertEqual([x["week"] for x in g], sorted(x["week"] for x in g))
        self.assertTrue(all(isinstance(x["id"], str) for x in g))

    def test_seven_entrants_in_six_week_league(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 7, weeks=6)
        self.assertEqual(
            self.generate(h, lid).json()["message"],
            "This schedule needs 7 weeks, so the league now runs 7 weeks instead of 6.",
        )

    def test_matching_weeks_has_no_message(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 6, weeks=5)
        self.check(self.generate(h, lid), 201, {"weeks": 5, "message": None})

    def test_one_week_schedule_says_week_not_weeks(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 2, weeks=8)
        self.assertEqual(
            self.generate(h, lid).json()["message"],
            "This schedule needs 1 week, so the league now runs 1 week instead of 8.",
        )

    def test_byes_have_null_away(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 5)
        self.generate(h, lid)
        byes = [x for x in self.games(h, lid) if x["away_id"] is None]
        self.assertEqual(len(byes), 5)
        self.assertTrue(all(b["away_name"] is None and b["home_score"] is None and b["away_score"] is None for b in byes))

    def test_games_follow_round_robin_in_entrant_order(self):
        from api.schedule import round_robin

        h = self.signed_in_as()
        lid = self.make_league(h, 5)
        order = [e["id"] for e in self.client.get(f"/api/leagues/{lid}/entrants", **h).json()]
        self.generate(h, lid)
        got = [(g["home_id"], g["away_id"]) for g in self.games(h, lid)]
        self.assertEqual(got, [pair for week in round_robin(order) for pair in week])

    def test_trailing_slash_accepted(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 4)
        self.assertEqual(self.client.post(f"/api/leagues/{lid}/schedule/", **h).status_code, 201)
        self.assertEqual(self.client.get(f"/api/leagues/{lid}/games/", **h).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/leagues/{lid}/scores/", **h).status_code, 200)

    def test_regenerating_without_scores_replaces_games(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 6)
        self.generate(h, lid)
        old = {x["id"] for x in self.games(h, lid)}
        r = self.generate(h, lid)
        self.assertEqual((r.status_code, r.json()["message"]), (201, None))
        new = {x["id"] for x in self.games(h, lid)}
        self.assertEqual(len(new), 15)
        self.assertFalse(old & new)

    def test_regenerating_with_a_score_is_refused(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 6)
        self.generate(h, lid)
        before = self.games(h, lid)
        self.score_one(lid)
        self.check(self.generate(h, lid), 409, {"error": "Scores already recorded — clear them first"})
        self.assertEqual({x["id"] for x in self.games(h, lid)}, {x["id"] for x in before})

    def test_clear_scores_then_regenerate(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 6)
        self.generate(h, lid)
        ids = [x["id"] for x in self.games(h, lid)]
        self.score_one(lid)
        self.check(self.client.delete(f"/api/leagues/{lid}/scores", **h), 200, {"cleared": 1})
        after = self.games(h, lid)
        self.assertEqual([x["id"] for x in after], ids)
        self.assertTrue(all(x["home_score"] is None and x["away_score"] is None for x in after))
        self.assertEqual(self.generate(h, lid).status_code, 201)

    def test_clear_with_no_scores_and_byes_untouched(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 5)
        self.generate(h, lid)
        self.check(self.client.delete(f"/api/leagues/{lid}/scores", **h), 200, {"cleared": 0})
        self.assertEqual(len(self.games(h, lid)), 15)

    def test_other_organizer_gets_404_and_signed_out_401(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 4)
        o = self.signed_in_as("other@example.com")
        for method, path in [("post", "schedule"), ("get", "games"), ("delete", "scores")]:
            self.check(getattr(self.client, method)(f"/api/leagues/{lid}/{path}", **o), 404, NOT_FOUND)
            self.check(getattr(self.client, method)(f"/api/leagues/{lid}/{path}"), 401, SIGN_IN_REQUIRED)
        self.assertEqual(self.games(h, lid), [])


class PlayedTests(ScheduleTestCase):
    def test_is_played_and_played_count(self):
        h = self.signed_in_as()
        lid = self.make_league(h, 5)
        self.generate(h, lid)
        rows = list(Game.objects.filter(league_id=lid))
        self.assertEqual(played_count(rows), 0)
        real = [g for g in rows if g.away_id][:2]
        real[0].home_score, real[0].away_score = 1, 0
        real[1].home_score = 3  # half a score is not played
        bye = next(g for g in rows if g.away_id is None)
        bye.home_score, bye.away_score = 1, 0  # a bye never counts
        self.assertEqual([is_played(g) for g in (real[0], real[1], bye)], [True, False, False])
        self.assertEqual(played_count(rows), 1)
