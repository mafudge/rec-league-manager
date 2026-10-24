from api.slugs import ALPHABET, new_slug
from api.test_auth import ApiTestCase

GOOD = {"name": "Tuesday Cornhole", "location": "Joe's Tavern", "sport": "Cornhole", "season": "Fall 2026", "weeks": 8}
INVALID = {"error": "Invalid request"}
NOT_FOUND = {"error": "League not found"}


class LeagueTestCase(ApiTestCase):
    def signed_in_as(self, email="dana@example.com"):
        tokens = self.post("/api/auth/signup", {"email": email, "password": "cornhole1"}).json()
        return {"HTTP_AUTHORIZATION": f"Bearer {tokens['token']}"}

    def make(self, h, **over):
        return self.post("/api/leagues", {**GOOD, **over}, **h)

    def check(self, r, status, body):
        self.assertEqual((r.status_code, r.json()), (status, body))


class CreateLeagueTests(LeagueTestCase):
    def test_create_returns_league_and_lists_it(self):
        h = self.signed_in_as()
        r = self.make(h)
        self.assertEqual(r.status_code, 201)
        league = r.json()
        self.assertIsInstance(league["id"], str)
        self.assertTrue(len(league["slug"]) == 6 and set(league["slug"]) <= set(ALPHABET))
        self.assertEqual({k: league[k] for k in GOOD}, GOOD)
        self.assertIs(league["allow_ties"], False)
        self.assertEqual(set(league), {"id", "slug", "name", "location", "sport", "season", "weeks", "allow_ties"})
        self.assertEqual(self.client.get("/api/leagues", **h).json(), [league])
        self.assertEqual(self.client.get(f"/api/leagues/{league['id']}", **h).json(), league)

    def test_trailing_slash_accepted(self):
        h = self.signed_in_as()
        self.assertEqual(self.client.get("/api/leagues/", **h).status_code, 200)
        self.assertEqual(self.post("/api/leagues/", GOOD, **h).status_code, 201)

    def test_list_is_oldest_first(self):
        h = self.signed_in_as()
        ids = [self.make(h, name=f"L{i}").json()["id"] for i in range(4)]
        self.assertEqual([x["id"] for x in self.client.get("/api/leagues", **h).json()], ids)

    def test_allow_ties_true_is_kept(self):
        self.assertIs(self.make(self.signed_in_as(), allow_ties=True).json()["allow_ties"], True)

    def test_allow_ties_must_be_boolean(self):
        h = self.signed_in_as()
        for bad in ("yes", 1, None, "true"):
            self.check(self.make(h, allow_ties=bad), 400, INVALID)

    def test_sport_and_season_optional_and_trimmed(self):
        h = self.signed_in_as()
        league = self.post("/api/leagues", {"name": "A", "location": "B", "weeks": 3}, **h).json()
        self.assertEqual((league["sport"], league["season"]), ("", ""))
        league = self.make(h, sport="  Darts ", season="   ").json()
        self.assertEqual((league["sport"], league["season"]), ("Darts", ""))

    def test_name_and_location_trimmed(self):
        league = self.make(self.signed_in_as(), name="  Pitch  ", location=" Bar ").json()
        self.assertEqual((league["name"], league["location"]), ("Pitch", "Bar"))

    def test_blank_location(self):
        h = self.signed_in_as()
        for loc in ("", "   ", None, 5):
            self.check(self.make(h, location=loc), 400, {"error": "Location is required"})

    def test_blank_name(self):
        h = self.signed_in_as()
        for name in ("", "  ", None, 5):
            self.check(self.make(h, name=name), 400, {"error": "Name is required"})

    def test_name_checked_before_location_before_weeks(self):
        h = self.signed_in_as()
        r = self.post("/api/leagues", {"name": "", "location": "", "weeks": 0}, **h)
        self.assertEqual(r.json(), {"error": "Name is required"})
        r = self.post("/api/leagues", {"name": "A", "location": "", "weeks": 0}, **h)
        self.assertEqual(r.json(), {"error": "Location is required"})

    def test_bad_weeks(self):
        h = self.signed_in_as()
        for weeks in (0, -1, "eight", "8", 2.5, True, None):
            self.check(self.make(h, weeks=weeks), 400, {"error": "Weeks must be at least 1"})

    def test_weeks_above_52_is_refused(self):
        h = self.signed_in_as()
        for weeks in (53, 2**31, 3_000_000_000, 10**20):
            self.check(self.make(h, weeks=weeks), 400, {"error": "Weeks must be between 1 and 52"})

    def test_weeks_52_is_kept(self):
        self.assertEqual(self.make(self.signed_in_as(), weeks=52).status_code, 201)

    def test_name_of_100_characters_is_kept_and_101_refused(self):
        h = self.signed_in_as()
        self.assertEqual(self.make(h, name="a" * 100).status_code, 201)
        self.check(self.make(h, name="a" * 101), 400, {"error": "Name must be 100 characters or fewer"})

    def test_name_length_is_measured_after_trimming(self):
        self.assertEqual(self.make(self.signed_in_as(), name="  " + "a" * 100 + "  ").status_code, 201)

    def test_name_length_checked_before_location_and_weeks(self):
        h = self.signed_in_as()
        r = self.make(h, name="a" * 101, location="", weeks=0)
        self.assertEqual(r.json(), {"error": "Name must be 100 characters or fewer"})
        self.assertEqual(self.make(h, location="", weeks=99).json(), {"error": "Location is required"})

    def test_missing_weeks(self):
        r = self.post("/api/leagues", {"name": "A", "location": "B"}, **self.signed_in_as())
        self.check(r, 400, {"error": "Weeks must be at least 1"})

    def test_refused_league_is_not_stored(self):
        h = self.signed_in_as()
        self.make(h, weeks=0)
        self.assertEqual(self.client.get("/api/leagues", **h).json(), [])

    def test_non_object_body_is_refused_not_500(self):
        h = self.signed_in_as()
        for body in ("[1]", "[]", '"x"', "5", "{oops", None):
            self.check(self.raw_post("/api/leagues", body, **h), 400, INVALID)


class LeagueOwnershipTests(LeagueTestCase):
    def test_other_organizer_cannot_see_it(self):
        mine = self.signed_in_as()
        theirs = self.signed_in_as("other@example.com")
        league = self.make(mine).json()
        self.assertEqual(self.client.get("/api/leagues", **theirs).json(), [])
        self.check(self.client.get(f"/api/leagues/{league['id']}", **theirs), 404, NOT_FOUND)
        self.check(self.client.get("/api/leagues/nope", **mine), 404, NOT_FOUND)
        self.check(self.client.get("/api/leagues/nope/", **mine), 404, NOT_FOUND)

    def test_no_token_is_401(self):
        signin = {"error": "Sign in required"}
        self.check(self.client.get("/api/leagues"), 401, signin)
        self.check(self.post("/api/leagues", GOOD), 401, signin)
        self.check(self.client.get("/api/leagues/abc"), 401, signin)

    def test_other_methods_are_405_in_the_contract_shape(self):
        r = self.client.delete("/api/leagues", **self.signed_in_as())
        self.check(r, 405, {"error": "Method not allowed"})


class SlugTests(LeagueTestCase):
    def test_new_slug_retries_until_free(self):
        seen = []

        def taken(s):
            seen.append(s)
            return len(seen) < 3

        slug = new_slug(taken)
        self.assertTrue(len(seen) == 3 and slug == seen[-1])
        self.assertTrue(len(slug) == 6 and set(slug) <= set(ALPHABET))
