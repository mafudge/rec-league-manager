from api.test_leagues import GOOD, INVALID, NOT_FOUND, LeagueTestCase

LEAGUE = {"name": "Tuesday Cornhole", "location": "Joe's Tavern", "weeks": 8}
DUP = {"error": "An entrant with that name already exists in this league"}


class EntrantTests(LeagueTestCase):
    def league(self, h):
        return self.post("/api/leagues", LEAGUE, **h).json()["id"]

    def add(self, h, lid, name):
        return self.post(f"/api/leagues/{lid}/entrants", {"name": name}, **h)

    def names(self, h, lid):
        return [e["name"] for e in self.client.get(f"/api/leagues/{lid}/entrants", **h).json()]

    def test_add_returns_entrant_and_lists_it(self):
        h = self.signed_in_as()
        lid = self.league(h)
        r = self.add(h, lid, "Bag Ladies")
        self.assertEqual(r.status_code, 201)
        e = r.json()
        self.assertTrue(set(e) == {"id", "name"} and isinstance(e["id"], str) and e["name"] == "Bag Ladies")
        self.assertEqual(self.client.get(f"/api/leagues/{lid}/entrants", **h).json(), [e])
        self.assertEqual(self.client.get(f"/api/leagues/{lid}/entrants/", **h).json(), [e])

    def test_list_is_order_added(self):
        h = self.signed_in_as()
        lid = self.league(h)
        names = ["Zed", "Alpha", "Mid", "Beta"]
        for n in names:
            self.add(h, lid, n)
        self.assertEqual(self.names(h, lid), names)

    def test_name_is_trimmed_as_typed(self):
        h = self.signed_in_as()
        self.assertEqual(self.add(h, self.league(h), "  Corn Stars ").json()["name"], "Corn Stars")

    def test_duplicate_is_refused_however_typed(self):
        h = self.signed_in_as()
        lid = self.league(h)
        self.add(h, lid, "Bag Ladies")
        for again in ("Bag Ladies", " bag ladies ", "BAG LADIES"):
            self.check(self.add(h, lid, again), 409, DUP)
        self.assertEqual(len(self.names(h, lid)), 1)

    def test_blank_or_non_string_name(self):
        h = self.signed_in_as()
        lid = self.league(h)
        for bad in ("", "   ", None, 5, True, ["x"]):
            self.check(self.add(h, lid, bad), 400, {"error": "Name is required"})

    def test_missing_name_and_non_object_body(self):
        h = self.signed_in_as()
        lid = self.league(h)
        self.check(self.post(f"/api/leagues/{lid}/entrants", {}, **h), 400, {"error": "Name is required"})
        for body in ("[]", '"x"', "5", "{oops", None):
            self.check(self.raw_post(f"/api/leagues/{lid}/entrants", body, **h), 400, INVALID)

    def test_same_name_in_another_league_is_fine(self):
        h = self.signed_in_as()
        a, b = self.league(h), self.league(h)
        self.assertEqual(self.add(h, a, "Bag Ladies").status_code, 201)
        self.assertEqual(self.add(h, b, "Bag Ladies").status_code, 201)

    def test_positions_are_per_league(self):
        h = self.signed_in_as()
        a, b = self.league(h), self.league(h)
        self.add(h, a, "One")
        self.add(h, b, "Two")
        self.add(h, b, "Three")
        self.assertEqual(self.names(h, b), ["Two", "Three"])

    def test_other_organizers_league_is_404(self):
        mine = self.signed_in_as()
        theirs = self.signed_in_as("sam@example.com")
        lid = self.league(mine)
        self.check(self.add(theirs, lid, "X"), 404, NOT_FOUND)
        self.check(self.client.get(f"/api/leagues/{lid}/entrants", **theirs), 404, NOT_FOUND)
        self.assertEqual(self.names(mine, lid), [])

    def test_unknown_league_is_404_and_token_required(self):
        h = self.signed_in_as()
        self.assertEqual(self.client.get("/api/leagues/nope/entrants", **h).status_code, 404)
        self.assertEqual(self.add(h, "nope", "X").status_code, 404)
        self.check(self.client.get("/api/leagues/nope/entrants"), 401, {"error": "Sign in required"})
        self.assertEqual(self.post("/api/leagues/nope/entrants", {"name": "X"}).status_code, 401)

    def test_body_shape_is_checked_before_the_league_lookup(self):
        h = self.signed_in_as()
        self.check(self.raw_post("/api/leagues/nope/entrants", "[]", **h), 400, INVALID)

    def test_duplicate_uses_lower_not_casefold(self):
        # JS toLowerCase() and Postgres lower() keep these apart, so every backend must.
        h = self.signed_in_as()
        lid = self.league(h)
        self.assertEqual(self.add(h, lid, "Straße").status_code, 201)
        self.assertEqual(self.add(h, lid, "STRASSE").status_code, 201)

    def test_name_of_100_characters_is_kept_and_101_refused(self):
        h = self.signed_in_as()
        lid = self.league(h)
        self.assertEqual(self.add(h, lid, "a" * 100).status_code, 201)
        self.check(self.add(h, lid, "b" * 101), 400, {"error": "Name must be 100 characters or fewer"})
        self.assertEqual(self.add(h, lid, "  " + "c" * 100 + "  ").status_code, 201)

    def test_53rd_entrant_is_refused_and_not_stored(self):
        h = self.signed_in_as()
        lid = self.league(h)
        for i in range(52):
            self.assertEqual(self.add(h, lid, f"Team {i}").status_code, 201)
        self.check(self.add(h, lid, "One too many"), 400, {"error": "A league can have at most 52 entrants"})
        self.assertEqual(len(self.names(h, lid)), 52)

    def test_full_league_still_reports_a_duplicate_as_409(self):
        h = self.signed_in_as()
        lid = self.league(h)
        for i in range(52):
            self.add(h, lid, f"Team {i}")
        self.assertEqual(self.add(h, lid, "team 3").status_code, 409)
        self.assertEqual(self.add(h, lid, " ").json(), {"error": "Name is required"})
        self.assertEqual(self.add(h, lid, "x" * 101).json(), {"error": "Name must be 100 characters or fewer"})
