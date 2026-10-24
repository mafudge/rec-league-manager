"""A NUL or an unpaired surrogate in a text field is 400 Invalid request (src/README.md), before anything is stored."""
import pytest

from tests.conftest import signed_in

INVALID = {"error": "Invalid request"}
BAD = [r"\u0000", r"A\u0000B", r"\ud800", r"x\udc00y", r"\ud83d"]  # NUL, NUL inside, high, lone low, high at the end
JSON = {"Content-Type": "application/json"}


def raw(client, path, text, headers=None):
    return client.post(path, content=text, headers={**JSON, **(headers or {})})


@pytest.mark.parametrize("bad", BAD)
@pytest.mark.parametrize("field", ["email", "password"])
def test_signup_refuses_bad_text(client, field, bad):
    text = '{"email": "%s", "password": "%s"}' % (
        bad if field == "email" else "dana@example.com",
        bad if field == "password" else "cornhole1",
    )
    r = raw(client, "/api/auth/signup", text)
    assert (r.status_code, r.json()) == (400, INVALID)


@pytest.mark.parametrize("bad", BAD)
def test_login_refuses_bad_password(client, bad):
    r = raw(client, "/api/auth/login", '{"email": "dana@example.com", "password": "%s"}' % bad)
    assert (r.status_code, r.json()) == (400, INVALID)


@pytest.mark.parametrize("bad", BAD)
@pytest.mark.parametrize("field", ["name", "location", "sport", "season"])
def test_league_refuses_bad_text_and_stores_nothing(client, field, bad):
    h = signed_in(client)
    fields = {"name": "Cornhole", "location": "Tavern", "sport": "cornhole", "season": "Fall"}
    fields[field] = bad
    text = '{%s, "weeks": 8}' % ", ".join('"%s": "%s"' % kv for kv in fields.items())
    r = raw(client, "/api/leagues", text, h)
    assert (r.status_code, r.json()) == (400, INVALID)
    assert client.get("/api/leagues", headers=h).json() == []


@pytest.mark.parametrize("bad", BAD)
def test_entrant_refuses_bad_name_and_stores_nothing(client, bad):
    h = signed_in(client)
    lid = client.post("/api/leagues", json={"name": "L", "location": "T", "weeks": 8}, headers=h).json()["id"]
    r = raw(client, f"/api/leagues/{lid}/entrants", '{"name": "%s"}' % bad, h)
    assert (r.status_code, r.json()) == (400, INVALID)
    assert client.get(f"/api/leagues/{lid}/entrants", headers=h).json() == []


def test_bad_text_is_refused_before_the_league_lookup(client):
    h = signed_in(client)
    r = raw(client, "/api/leagues/nope/entrants", '{"name": "A\\u0000B"}', h)
    assert (r.status_code, r.json()) == (400, INVALID)


def test_ordinary_unicode_is_still_fine(client):
    h = signed_in(client)
    r = client.post("/api/leagues", json={"name": "Café 😀", "location": "Tavern", "weeks": 8}, headers=h)
    assert r.status_code == 201
