import json
from contextlib import contextmanager
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

from conftest import Backend, Reply

TOKENS = {"token": "t1", "refresh_token": "r1"}
BASE = "http://localhost:8000"


@contextmanager
def backend(*replies):
    """Patch requests: the hello demo answers itself, every other call comes from the queue."""
    b = Backend(*replies)
    with patch("requests.request", b), patch("requests.get", lambda *a, **k: Reply(200, {"backend": "fastapi"})):
        yield b


def page(name, state=None):
    at = AppTest.from_file("../app.py", default_timeout=10).run()
    for k, v in (state or {}).items():
        at.session_state[k] = v
    return at.switch_page(f"screens/{name}.py").run()


def submit(at, email, password):
    at.text_input(key="auth_email").input(email)
    at.text_input(key="auth_password").input(password)
    at.button[0].click().run()
    assert not at.exception
    return at


def test_sign_up_lands_on_the_leagues_page_signed_in():
    with backend(Reply(201, TOKENS), Reply(200, {"email": "dana@example.com"})) as b:
        at = submit(page("signup"), "dana@example.com", "password1")
    method, url, kw = b.calls[0]
    assert (method, url) == ("POST", f"{BASE}/api/auth/signup")
    assert kw["headers"] == {"Content-Type": "application/json"}
    assert json.loads(kw["data"]) == {"email": "dana@example.com", "password": "password1"}
    assert at.title[0].value == "Your leagues"
    assert at.session_state["token"] == "t1"
    assert at.session_state["refresh_token"] == "r1"


def test_sign_in_lands_on_the_leagues_page():
    with backend(Reply(200, TOKENS), Reply(200, {"email": "dana@example.com"})) as b:
        at = submit(page("signin"), "dana@example.com", "password1")
    assert (b.calls[0][0], b.calls[0][1]) == ("POST", f"{BASE}/api/auth/login")
    assert at.title[0].value == "Your leagues"


def test_the_backends_refusal_is_shown_verbatim_and_nothing_is_saved():
    for status, error in [
        (409, "An account with that email already exists"),
        (400, "Password must be at least 8 characters"),
        (400, "Enter a valid email address"),
        (400, "Password must be 72 characters or fewer"),
    ]:
        with backend(Reply(status, {"error": error})):
            at = submit(page("signup"), "a", "b")
        assert [e.value for e in at.error] == [error]
        assert at.title[0].value == "Create your account"
        assert "token" not in at.session_state


def test_a_wrong_password_stays_on_sign_in_with_the_backends_message():
    with backend(Reply(401, {"error": "Email or password is incorrect"})):
        at = submit(page("signin"), "dana@example.com", "nope")
    assert [e.value for e in at.error] == ["Email or password is incorrect"]
    assert at.title[0].value == "Sign in"
    assert "token" not in at.session_state


def test_an_unreachable_backend_says_where_it_looked():
    with backend(ConnectionError()):
        at = submit(page("signin"), "a@b.c", "password1")
    assert [e.value for e in at.error] == ["Can't reach the backend at http://localhost:8000"]


def test_a_5xx_says_the_backend_had_a_problem():
    with backend(Reply(500, None)):
        at = submit(page("signup"), "a@b.c", "password1")
    assert [e.value for e in at.error] == ["The backend had a problem (500)"]


def test_the_two_pages_link_to_each_other():
    with backend():
        up, inn = page("signup"), page("signin")
    assert up.get("page_link")[0].proto.label == "Sign in"
    assert inn.get("page_link")[0].proto.label == "Sign up"
    assert up.get("page_link")[0].proto.page.endswith("signin")
    assert inn.get("page_link")[0].proto.page.endswith("signup")


def test_the_leagues_page_shows_the_email_and_sign_out_forgets_the_tokens():
    state = {"token": "t1", "refresh_token": "r1"}
    with backend(Reply(200, {"email": "dana@example.com"}), Reply(200, [])) as b:
        at = page("leagues", state)
        assert at.title[0].value == "Your leagues"
        assert at.markdown[0].value == "dana@example.com"
        assert (b.calls[0][0], b.calls[0][1]) == ("GET", f"{BASE}/api/auth/me")
        assert b.calls[0][2]["headers"] == {"Authorization": "Bearer t1"}
        assert "data" not in b.calls[0][2]
        at.button(key="sign_out").click().run()
        assert not at.exception
    assert at.title[0].value == "Sign in"
    assert "token" not in at.session_state and "refresh_token" not in at.session_state
    assert len(b.calls) == 2  # /me and the list; sign-out sends nothing to the backend


def test_signed_out_visitors_are_sent_to_sign_in():
    with backend() as b:
        at = page("leagues")
    assert at.title[0].value == "Sign in"
    assert b.calls == []


def test_a_session_that_cannot_be_restored_goes_to_sign_in():
    state = {"token": "old", "refresh_token": "older"}
    with backend(Reply(401, {}), Reply(401, {"error": "Sign in required"})):
        at = page("leagues", state)
    assert at.title[0].value == "Sign in"
    assert "token" not in at.session_state


def test_the_home_page_still_says_hello_and_offers_sign_up_and_in():
    with backend():
        at = page("home")
    assert at.markdown[0].value == "Hello from fastapi"
    assert [l.proto.label for l in at.get("page_link")] == ["Sign up", "Sign in"]


def test_signing_in_as_someone_else_shows_the_new_email_not_the_cached_one():
    state = {"token": "tA", "refresh_token": "rA", "email": "a@example.com"}
    with backend(Reply(200, TOKENS), Reply(200, {"email": "b@example.com"})) as b:
        at = submit(page("signin", state), "b@example.com", "password1")
    assert (b.calls[1][0], b.calls[1][1]) == ("GET", f"{BASE}/api/auth/me")
    assert b.calls[1][2]["headers"] == {"Authorization": "Bearer t1"}
    assert at.markdown[0].value == "b@example.com"
