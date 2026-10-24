import json
from unittest.mock import patch

import pytest

import api
from conftest import Backend, Reply

BASE = "http://localhost:8000"
TOKENS = {"token": "t2", "refresh_token": "r2"}


def signed_in():
    return {"token": "t1", "refresh_token": "r1"}


def run(backend, fn, *args, **kwargs):
    with patch("requests.request", backend):
        return fn(*args, **kwargs)


def test_a_bearer_token_goes_only_on_auth_calls():
    b = Backend(Reply(200, {"ok": 1}), Reply(200, {"ok": 1}))
    s = signed_in()
    run(b, api.request, s, "GET", "/api/auth/me", auth=True)
    run(b, api.request, s, "GET", "/api/public/abc")
    assert b.calls[0][2]["headers"] == {"Authorization": "Bearer t1"}
    assert b.calls[1][2]["headers"] == {}


def test_a_body_is_a_json_object_with_a_content_type_and_no_body_means_neither():
    b = Backend(Reply(201, TOKENS), Reply(200, {}), Reply(201, {}), Reply(200, {}))
    s = signed_in()
    run(b, api.request, s, "POST", "/api/auth/login", {"email": "a@b.c", "password": "x"})
    run(b, api.request, s, "GET", "/api/leagues", auth=True)
    run(b, api.request, s, "POST", "/api/leagues/1/schedule", auth=True)
    run(b, api.request, s, "DELETE", "/api/leagues/1/scores", auth=True)
    method, url, kw = b.calls[0]
    assert (method, url) == ("POST", f"{BASE}/api/auth/login")
    assert kw["headers"] == {"Content-Type": "application/json"}
    assert json.loads(kw["data"]) == {"email": "a@b.c", "password": "x"}
    for _, _, kw in b.calls[1:]:
        assert kw.get("data") is None and kw.get("json") is None
        assert "Content-Type" not in kw["headers"]


def test_a_401_refreshes_once_with_the_newest_refresh_token_and_retries():
    b = Backend(Reply(401, {"error": "Sign in required"}), Reply(200, TOKENS), Reply(200, {"email": "d@e.f"}))
    s = signed_in()
    assert run(b, api.me, s) == {"email": "d@e.f"}
    refresh = b.calls[1]
    assert (refresh[0], refresh[1]) == ("POST", f"{BASE}/api/auth/refresh")
    assert json.loads(refresh[2]["data"]) == {"refresh_token": "r1"}
    assert "Authorization" not in refresh[2]["headers"]
    assert b.calls[2][2]["headers"]["Authorization"] == "Bearer t2"
    assert s["token"] == "t2" and s["refresh_token"] == "r2"


def test_the_next_refresh_uses_the_pair_saved_by_the_last_one():
    b = Backend(
        Reply(401, {"error": "Sign in required"}), Reply(200, TOKENS), Reply(200, {"email": "x"}),
        Reply(401, {"error": "Sign in required"}), Reply(200, {"token": "t3", "refresh_token": "r3"}),
        Reply(200, {"email": "x"}),
    )
    s = signed_in()
    run(b, api.me, s)
    run(b, api.me, s)
    assert json.loads(b.calls[4][2]["data"]) == {"refresh_token": "r2"}


def test_a_second_401_after_refreshing_clears_the_session_and_does_not_loop():
    b = Backend(Reply(401, {}), Reply(200, TOKENS), Reply(401, {}))
    s = signed_in()
    with pytest.raises(api.SignInRequired):
        run(b, api.me, s)
    assert len(b.calls) == 3
    assert "token" not in s and "refresh_token" not in s


@pytest.mark.parametrize("status", [400, 401, 403])
def test_a_refused_refresh_clears_the_tokens_and_requires_sign_in(status):
    b = Backend(Reply(401, {}), Reply(status, {"error": "Sign in required"}))
    s = signed_in()
    with pytest.raises(api.SignInRequired):
        run(b, api.me, s)
    assert len(b.calls) == 2
    assert "token" not in s and "refresh_token" not in s


def test_a_refresh_that_merely_fails_keeps_the_session_and_says_the_backend_had_a_problem():
    b = Backend(Reply(401, {}), Reply(503, None))
    s = signed_in()
    with pytest.raises(api.BackendProblem) as e:
        run(b, api.me, s)
    assert str(e.value) == "The backend had a problem (503)"
    assert s["token"] == "t1" and s["refresh_token"] == "r1"


def test_no_refresh_token_means_sign_in_is_required_without_calling_refresh():
    b = Backend(Reply(401, {}))
    with pytest.raises(api.SignInRequired):
        run(b, api.me, {})
    assert len(b.calls) == 1


def test_a_4xx_shows_the_backends_error_verbatim():
    b = Backend(Reply(409, {"error": "An account with that email already exists"}))
    with pytest.raises(api.BackendRefused) as e:
        run(b, api.sign_up, {}, "a@b.c", "password1")
    assert str(e.value) == "An account with that email already exists"


def test_a_5xx_or_an_unexplained_4xx_says_the_backend_had_a_problem():
    for reply in (Reply(500, None), Reply(502, {"error": "ignored"}), Reply(404, None)):
        with pytest.raises(api.BackendProblem) as e:
            run(Backend(reply), api.request, {}, "GET", "/api/public/x")
        assert str(e.value) == f"The backend had a problem ({reply.status_code})"


def test_message_for_names_where_it_looked_when_nothing_answered():
    assert api.message_for(ConnectionError()) == "Can't reach the backend at http://localhost:8000"
    assert api.message_for(api.BackendRefused("Name is required")) == "Name is required"
    assert api.message_for(api.BackendProblem(500)) == "The backend had a problem (500)"


def test_sign_up_and_sign_in_save_the_pair_and_send_what_was_typed():
    s = {}
    b = Backend(Reply(201, TOKENS))
    run(b, api.sign_up, s, " Dana@Example.com ", "pw")
    assert b.calls[0][1] == f"{BASE}/api/auth/signup"
    assert json.loads(b.calls[0][2]["data"]) == {"email": " Dana@Example.com ", "password": "pw"}
    assert s["token"] == "t2" and s["refresh_token"] == "r2"
    s = {}
    b = Backend(Reply(200, TOKENS))
    run(b, api.sign_in, s, "d@e.f", "pw")
    assert b.calls[0][1] == f"{BASE}/api/auth/login"
    assert s["token"] == "t2"


def test_a_failed_sign_in_saves_nothing():
    s = {}
    with pytest.raises(api.BackendRefused):
        run(Backend(Reply(401, {"error": "Email or password is incorrect"})), api.sign_in, s, "a", "b")
    assert s == {}


def test_sign_out_forgets_everything_and_sends_nothing():
    s = {**signed_in(), "email": "d@e.f", "other": 1}
    api.clear_session(s)
    assert s == {"other": 1}
