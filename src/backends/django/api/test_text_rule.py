"""A NUL or an unpaired surrogate in a text field is 400 Invalid request (src/README.md), before anything is stored."""
from api.test_auth import ApiTestCase
from api.test_leagues import GOOD, INVALID, LeagueTestCase

BAD = [r"\u0000", r"A\u0000B", r"\ud800", r"x\udc00y", r"\ud83d"]


class TextRuleTests(LeagueTestCase):
    def test_signup_and_login_refuse_bad_text(self):
        for bad in BAD:
            for field in ("email", "password"):
                email = bad if field == "email" else "dana@example.com"
                password = bad if field == "password" else "cornhole1"
                text = '{"email": "%s", "password": "%s"}' % (email, password)
                self.check(self.raw_post("/api/auth/signup", text), 400, INVALID)
            self.check(self.raw_post("/api/auth/login", '{"email": "dana@example.com", "password": "%s"}' % bad), 400, INVALID)

    def test_league_refuses_bad_text_and_stores_nothing(self):
        h = self.signed_in_as()
        for bad in BAD:
            for field in ("name", "location", "sport", "season"):
                fields = {"name": "Cornhole", "location": "Tavern", "sport": "cornhole", "season": "Fall"}
                fields[field] = bad
                text = "{%s, \"weeks\": 8}" % ", ".join('"%s": "%s"' % kv for kv in fields.items())
                self.check(self.raw_post("/api/leagues", text, **h), 400, INVALID)
        self.assertEqual(self.client.get("/api/leagues", **h).json(), [])

    def test_entrant_refuses_bad_name_and_stores_nothing(self):
        h = self.signed_in_as()
        lid = self.post("/api/leagues", {"name": "L", "location": "T", "weeks": 8}, **h).json()["id"]
        for bad in BAD:
            self.check(self.raw_post(f"/api/leagues/{lid}/entrants", '{"name": "%s"}' % bad, **h), 400, INVALID)
        self.assertEqual(self.client.get(f"/api/leagues/{lid}/entrants", **h).json(), [])

    def test_bad_text_is_refused_before_the_league_lookup(self):
        h = self.signed_in_as()
        self.check(self.raw_post("/api/leagues/nope/entrants", '{"name": "A\\u0000B"}', **h), 400, INVALID)

    def test_ordinary_unicode_is_still_fine(self):
        h = self.signed_in_as()
        r = self.post("/api/leagues", {"name": "Café 😀", "location": "Tavern", "weeks": 8}, **h)
        self.assertEqual(r.status_code, 201)
