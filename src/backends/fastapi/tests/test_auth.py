import pytest
from tests.conftest import signed_in
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


MSG72 = {"error": "Password must be 72 characters or fewer"}
EMOJI72 = "😀" * 18  # 72 UTF-8 bytes, 18 code points


def test_signup_refuses_73_ascii_characters(client):
    r = client.post("/api/auth/signup", json={**GOOD, "password": "a" * 73})
    assert (r.status_code, r.json()) == (400, MSG72)
    assert client.post("/api/auth/login", json={**GOOD, "password": "a" * 73}).status_code == 401


def test_signup_accepts_72_ascii_characters_and_login_works(client):
    pw = "a" * 72
    assert client.post("/api/auth/signup", json={**GOOD, "password": pw}).status_code == 201
    assert client.post("/api/auth/login", json={**GOOD, "password": pw}).status_code == 200


def test_cap_counts_utf8_bytes_so_72_byte_emoji_password_is_exact(client):
    assert client.post("/api/auth/signup", json={**GOOD, "password": EMOJI72}).status_code == 201
    assert client.post("/api/auth/login", json={**GOOD, "password": EMOJI72}).status_code == 200
    # bcrypt would have ignored anything past 72 bytes; a different tail must not log in
    other = "😀" * 17 + "😁"
    assert client.post("/api/auth/login", json={**GOOD, "password": other}).status_code == 401
    r = client.post("/api/auth/signup", json={"email": "b@example.com", "password": EMOJI72 + "a"})
    assert (r.status_code, r.json()) == (400, MSG72)


def test_long_password_is_checked_after_email_and_short_and_before_duplicate(client):
    client.post("/api/auth/signup", json=GOOD)
    r = client.post("/api/auth/signup", json={**GOOD, "password": "a" * 73})
    assert (r.status_code, r.json()) == (400, MSG72)
    r = client.post("/api/auth/signup", json={"email": "nope", "password": "a" * 73})
    assert r.json() == {"error": "Enter a valid email address"}


def test_signup_refuses_email_without_at(client):
    r = client.post("/api/auth/signup", json={**GOOD, "email": "dana.example.com"})
    assert r.status_code == 400
    assert r.json() == {"error": "Enter a valid email address"}


def test_email_message_wins_over_password_message(client):
    r = client.post("/api/auth/signup", json={"email": "nope", "password": "x"})
    assert r.json() == {"error": "Enter a valid email address"}


def test_signup_with_missing_or_non_string_fields_is_400_not_500(client):
    for body in ({}, {"email": 5, "password": "cornhole1"}, {"email": "a@b.c", "password": None}):
        assert client.post("/api/auth/signup", json=body).status_code == 400


@pytest.mark.parametrize("path", ["/api/auth/signup", "/api/auth/login", "/api/auth/refresh"])
@pytest.mark.parametrize("body", [[], "x", 5, None])
def test_non_object_body_is_invalid_request(client, path, body):
    r = client.post(path, json=body)
    assert (r.status_code, r.json()) == (400, {"error": "Invalid request"})


@pytest.mark.parametrize("path", ["/api/auth/signup", "/api/auth/login", "/api/auth/refresh"])
def test_broken_or_missing_json_is_invalid_request(client, path):
    broken = client.post(path, content="nope", headers={"Content-Type": "application/json"})
    missing = client.post(path)
    assert [(r.status_code, r.json()) for r in (broken, missing)] == [(400, {"error": "Invalid request"})] * 2


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


def test_signup_losing_a_race_on_the_unique_email_is_409_not_500(client, monkeypatch):
    # Another request inserts the same email between our check and our commit.
    from app.routes import auth as routes

    real_hash = routes.hash_password

    def hash_then_insert(pw):
        with Session(client.engine) as s:
            s.add(Organizer(email="dana@example.com", password_hash="x"))
            s.commit()
        return real_hash(pw)

    monkeypatch.setattr(routes, "hash_password", hash_then_insert)
    r = client.post("/api/auth/signup", json=GOOD)
    assert r.status_code == 409
    assert r.json() == {"error": "An account with that email already exists"}


# --- US01 · sign in, refresh, and the sign-in gate ---
def test_login_with_correct_password_returns_tokens(client):
    client.post("/api/auth/signup", json=GOOD)
    r = client.post("/api/auth/login", json=GOOD)
    assert r.status_code == 200
    body = r.json()
    assert body["token"] and body["refresh_token"]


def test_login_wrong_password_and_unknown_email_get_the_same_refusal(client):
    client.post("/api/auth/signup", json=GOOD)
    wrong = client.post("/api/auth/login", json={**GOOD, "password": "nope-nope"})
    unknown = client.post("/api/auth/login", json={"email": "who@example.com", "password": "cornhole1"})
    missing = client.post("/api/auth/login", json={"email": GOOD["email"]})
    for r in (wrong, unknown, missing):
        assert r.status_code == 401
        assert r.json() == {"error": "Email or password is incorrect"}


def test_login_email_is_case_insensitive(client):
    client.post("/api/auth/signup", json=GOOD)
    r = client.post("/api/auth/login", json={**GOOD, "email": " DANA@Example.com "})
    assert r.status_code == 200


def test_refresh_returns_a_new_pair(client):
    first = client.post("/api/auth/signup", json=GOOD).json()
    r = client.post("/api/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert r.status_code == 200
    body = r.json()
    assert body["token"] and body["refresh_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.status_code == 200


def test_refresh_refuses_an_access_token_or_garbage(client):
    first = client.post("/api/auth/signup", json=GOOD).json()
    for bad in (first["token"], "garbage", None, 5):
        r = client.post("/api/auth/refresh", json={"refresh_token": bad})
        assert r.status_code == 401
        assert r.json() == {"error": "Sign in required"}
    assert client.post("/api/auth/refresh", json={}).status_code == 401


def test_protected_route_needs_a_token(client):
    import jwt
    from datetime import datetime, timedelta, timezone

    from app.auth import _secret

    headers = signed_in(client)
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json() == {"email": "dana@example.com"}

    organizer_id = read_token(headers["Authorization"].split()[1], "access")
    expired = jwt.encode(
        {"sub": organizer_id, "type": "access", "exp": datetime.now(timezone.utc) - timedelta(seconds=5)},
        _secret(),
        algorithm="HS256",
    )
    refresh = issue_tokens(organizer_id)["refresh_token"]
    for h in (
        {},
        {"Authorization": "Bearer garbage"},
        {"Authorization": "garbage"},
        {"Authorization": f"Bearer {expired}"},
        {"Authorization": f"Bearer {refresh}"},  # a refresh token is not an access token
    ):
        r = client.get("/api/auth/me", headers=h)
        assert r.status_code == 401
        assert r.json() == {"error": "Sign in required"}


def test_token_for_a_deleted_organizer_is_refused(client):
    headers = signed_in(client)
    with Session(client.engine) as s:
        s.delete(s.scalar(select(Organizer)))
        s.commit()
    assert client.get("/api/auth/me", headers=headers).status_code == 401
