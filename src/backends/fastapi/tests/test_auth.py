from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import check_password, issue_tokens, read_token
from app.models import Organizer

GOOD = {"email": "dana@example.com", "password": "cornhole1"}


def test_signup_creates_account_and_returns_tokens(client):
    r = client.post("/api/auth/signup", json=GOOD)
    assert r.status_code == 201
    body = r.json()
    assert body["token"] and body["refresh_token"]


def test_signup_refuses_registered_email(client):
    client.post("/api/auth/signup", json=GOOD)
    r = client.post("/api/auth/signup", json=GOOD)
    assert r.status_code == 409
    assert r.json() == {"error": "An account with that email already exists"}


def test_signup_email_is_case_and_space_insensitive(client):
    client.post("/api/auth/signup", json=GOOD)
    r = client.post("/api/auth/signup", json={**GOOD, "email": " Dana@Example.com "})
    assert r.status_code == 409
    assert r.json() == {"error": "An account with that email already exists"}


def test_signup_refuses_short_password(client):
    r = client.post("/api/auth/signup", json={**GOOD, "password": "seven77"})
    assert r.status_code == 400
    assert r.json() == {"error": "Password must be at least 8 characters"}


def test_signup_refuses_email_without_at(client):
    r = client.post("/api/auth/signup", json={**GOOD, "email": "dana.example.com"})
    assert r.status_code == 400
    assert r.json() == {"error": "Enter a valid email address"}


def test_email_message_wins_over_password_message(client):
    r = client.post("/api/auth/signup", json={"email": "nope", "password": "x"})
    assert r.json() == {"error": "Enter a valid email address"}


def test_signup_with_missing_or_non_string_fields_is_400_not_500(client):
    for body in ({}, {"email": 5, "password": "cornhole1"}, {"email": "a@b.c", "password": None}, [1]):
        assert client.post("/api/auth/signup", json=body).status_code == 400


def test_invalid_json_is_400_not_422(client):
    r = client.post("/api/auth/signup", content="nope", headers={"Content-Type": "application/json"})
    assert r.status_code == 400
    assert r.json() == {"error": "Invalid request"}


def test_password_is_stored_hashed(client):
    client.post("/api/auth/signup", json=GOOD)
    with Session(client.engine) as s:
        row = s.scalars(select(Organizer)).one()
    assert row.password_hash != GOOD["password"]
    assert row.email == "dana@example.com"
    assert check_password(GOOD["password"], row.password_hash)
    assert not check_password("wrong-pass", row.password_hash)


def test_tokens_round_trip_by_type():
    t = issue_tokens("abc")
    assert read_token(t["token"], "access") == "abc"
    assert read_token(t["refresh_token"], "refresh") == "abc"
    assert read_token(t["token"], "refresh") is None
    assert read_token("garbage", "access") is None
