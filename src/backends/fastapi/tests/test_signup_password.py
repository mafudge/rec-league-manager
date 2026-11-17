"""US13-02: sign-up needs the server's sign-up password (src/README.md, signup row)."""
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Organizer
from tests.conftest import SIGNUP_PASSWORD

NEW = {"email": "dana@example.com", "password": "cornhole1"}
INCORRECT = (403, {"error": "Sign-up password is incorrect"})
CLOSED = (403, {"error": "Sign-up is closed"})


def signup(client, **body):
    r = client.post("/api/auth/signup", json=body)
    return r.status_code, r.json()


def organizers(client):
    with Session(client.engine) as session:
        return session.scalar(select(func.count()).select_from(Organizer))


def test_right_sign_up_password_creates_the_account(client):  # AC1
    status, body = signup(client, **NEW, signup_password=SIGNUP_PASSWORD)
    assert status == 201 and body["token"] and body["refresh_token"]
    assert client.post("/api/auth/login", json=NEW).status_code == 200  # sign-in never asks for it


@pytest.mark.parametrize("given", ["wrong", "", SIGNUP_PASSWORD + " ", SIGNUP_PASSWORD.upper(), 5, None, ["x"]])
def test_wrong_or_non_text_sign_up_password_is_refused(client, given):  # AC2
    assert signup(client, **NEW, signup_password=given) == INCORRECT
    assert organizers(client) == 0


def test_missing_sign_up_password_is_refused(client):  # AC2
    assert signup(client, **NEW) == INCORRECT
    assert organizers(client) == 0


def test_wrong_sign_up_password_wins_over_duplicate_email(client):  # AC3: no probing for accounts
    signup(client, **NEW, signup_password=SIGNUP_PASSWORD)
    assert signup(client, **NEW, signup_password="wrong") == INCORRECT


def test_wrong_sign_up_password_wins_over_bad_email_and_password(client):  # AC3
    assert signup(client, email="nope", password="x", signup_password="wrong") == INCORRECT


@pytest.mark.parametrize("server", [None, ""])
def test_no_server_sign_up_password_means_sign_up_is_closed(client, monkeypatch, server):  # AC4
    if server is None:
        monkeypatch.delenv("SIGNUP_PASSWORD")
    else:
        monkeypatch.setenv("SIGNUP_PASSWORD", server)
    assert signup(client, **NEW, signup_password=SIGNUP_PASSWORD) == CLOSED
    assert signup(client, **NEW, signup_password="") == CLOSED
    assert organizers(client) == 0


def test_closed_wins_over_field_checks(client, monkeypatch):  # AC4
    monkeypatch.delenv("SIGNUP_PASSWORD")
    assert signup(client, email="nope", password="x") == CLOSED


def test_server_password_is_read_on_every_request(client, monkeypatch):
    monkeypatch.setenv("SIGNUP_PASSWORD", "first-one")
    assert signup(client, **NEW, signup_password=SIGNUP_PASSWORD) == INCORRECT
    status, _ = signup(client, **NEW, signup_password="first-one")
    assert status == 201


def test_non_ascii_sign_up_password_works(client, monkeypatch):
    monkeypatch.setenv("SIGNUP_PASSWORD", "café-😀")
    status, _ = signup(client, **NEW, signup_password="café-😀")
    assert status == 201
