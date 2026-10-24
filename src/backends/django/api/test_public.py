from api.test_leagues import LeagueTestCase
from api.test_schedule import LEAGUE, ScheduleTestCase
from api.test_scores import ScoreHelpers


class PublicTests(ScoreHelpers, ScheduleTestCase):
    def public(self, slug, **headers):
        return self.client.get(f"/api/public/{slug}", **headers)

    def slug_of(self, h, lid):
        return self.client.get(f"/api/leagues/{lid}", **h).json()["slug"]

    def score(self, h, lid, week=None):
        for g in self.games(h, lid):
            if g["away_id"] and (week is None or g["week"] == week):
                self.put(h, g["id"], {"home_score": 21, "away_score": 14})

    def test_no_token_needed_and_league_has_no_id(self):
        h, lid = self.setup_league(n=6)
        r = self.public(self.slug_of(h, lid))
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(set(body), {"league", "current_week", "games", "standings"})
        self.assertNotIn("id", body["league"])
        self.assertEqual((body["league"]["name"], body["league"]["location"]), ("Tuesday Cornhole", "Joe's Tavern"))
        self.assertEqual(len(body["games"]), 15)
        self.assertEqual(body["standings"]["played"], 0)
        self.assertEqual(len(body["standings"]["rows"]), 6)

    def test_trailing_slash_accepted(self):
        h, lid = self.setup_league()
        self.assertEqual(self.public(self.slug_of(h, lid) + "/").status_code, 200)

    def test_a_bad_token_header_makes_no_difference(self):
        h, lid = self.setup_league()
        r = self.public(self.slug_of(h, lid), HTTP_AUTHORIZATION="Bearer nonsense")
        self.assertEqual(r.status_code, 200)

    def test_current_week_follows_the_scores(self):
        h, lid = self.setup_league(n=6)
        slug = self.slug_of(h, lid)
        self.assertEqual(self.public(slug).json()["current_week"], 1)
        self.score(h, lid, week=1)
        self.assertEqual(self.public(slug).json()["current_week"], 2)
        self.score(h, lid)
        body = self.public(slug).json()
        self.assertEqual((body["current_week"], body["standings"]["played"]), (5, 15))

    def test_a_bye_does_not_hold_the_week_open(self):
        h, lid = self.setup_league(n=3)  # one bye a week
        slug = self.slug_of(h, lid)
        self.score(h, lid, week=1)
        self.assertEqual(self.public(slug).json()["current_week"], 2)
        self.score(h, lid)
        self.assertEqual(self.public(slug).json()["current_week"], 3)

    def test_no_schedule_means_null_current_week(self):
        h = self.signed_in_as()
        league = self.client.post("/api/leagues", LEAGUE, format="json", **h).json()
        body = self.public(league["slug"]).json()
        self.assertIsNone(body["current_week"])
        self.assertEqual((body["games"], body["standings"]["rows"]), ([], []))

    def test_unknown_slug_is_404(self):
        self.check(self.public("zzzzzz"), 404, {"error": "League not found"})


class UnknownApiPathTests(LeagueTestCase):
    def test_unknown_api_path_is_json_404(self):
        for path in ("/api/nope", "/api/nope/deeper/", "/api/leagues/x/nope"):
            self.check(self.client.get(path), 404, {"error": "Not Found"})
        self.check(self.client.post("/api/nope", {}, format="json"), 404, {"error": "Not Found"})
