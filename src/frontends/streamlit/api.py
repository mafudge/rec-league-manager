"""The one client for every backend: they all serve the same REST contract (ADR 003)."""
import json
import os
from collections.abc import MutableMapping

import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000")


class BackendRefused(Exception):
    """The backend understood the request and said no, e.g. "Name is required"."""


class BackendProblem(Exception):
    """The backend answered, but with a failure it did not explain (5xx, or a 4xx with no `error`)."""

    def __init__(self, status: int):
        super().__init__(f"The backend had a problem ({status})")


class SignInRequired(Exception):
    """Sign-in is required and could not be restored: send the organizer to Sign in."""


def message_for(e: Exception) -> str:
    """What to show for a failed call: the backend's own words, or where we looked if nothing answered."""
    if isinstance(e, (BackendRefused, BackendProblem)):
        return str(e)
    return f"Can't reach the backend at {API_URL}"


# The tokens live in the `session` mapping every call takes: st.session_state in the app, a dict in tests.
def save_session(session: MutableMapping, tokens: dict) -> None:
    session["token"], session["refresh_token"] = tokens["token"], tokens["refresh_token"]


def clear_session(session: MutableMapping) -> None:
    for key in ("token", "refresh_token", "email"):
        session.pop(key, None)


def _send(method: str, href: str, body, token):
    headers = {}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    kwargs = {"headers": headers, "timeout": 10}
    if body is not None:
        kwargs["data"] = json.dumps(body)
    return requests.request(method, href, **kwargs)


def refresh(session: MutableMapping, api_url: str) -> bool:
    """Trade the newest refresh token for a new pair. False if the backend refuses it; BackendProblem if it merely failed."""
    refresh_token = session.get("refresh_token")
    if not refresh_token:
        return False
    r = _send("POST", f"{api_url}/api/auth/refresh", {"refresh_token": refresh_token}, None)
    # Only a refusal means the tokens are no good. A blip (5xx, 429) must not sign the organizer out.
    if r.status_code in (400, 401, 403):
        return False
    if r.status_code >= 400:
        raise BackendProblem(r.status_code)
    save_session(session, r.json())
    return True


def request(session: MutableMapping, method: str, path: str, body=None, auth: bool = False, api_url: str = API_URL):
    """One call for every contract route. A 4xx with an `error` becomes BackendRefused(error); any other
    non-2xx becomes BackendProblem. With auth=True the bearer token is attached; on 401 the tokens are
    refreshed once and the call retried, and if that fails the session is cleared and SignInRequired raised."""
    api_url = api_url.rstrip("/")
    href = f"{api_url}{path}"
    r = _send(method, href, body, session.get("token") if auth else None)
    if auth and r.status_code == 401:
        if not refresh(session, api_url):
            clear_session(session)
            raise SignInRequired()
        r = _send(method, href, body, session.get("token"))
        if r.status_code == 401:
            clear_session(session)
            raise SignInRequired()
    if r.status_code >= 400:
        if r.status_code < 500:
            try:
                error = r.json().get("error")
            except Exception:
                error = None
            if isinstance(error, str) and error:
                raise BackendRefused(error)
        raise BackendProblem(r.status_code)
    return r.json()


def sign_up(session: MutableMapping, email: str, password: str) -> None:
    save_session(session, request(session, "POST", "/api/auth/signup", {"email": email, "password": password}))


def sign_in(session: MutableMapping, email: str, password: str) -> None:
    save_session(session, request(session, "POST", "/api/auth/login", {"email": email, "password": password}))


def me(session: MutableMapping) -> dict:
    return request(session, "GET", "/api/auth/me", auth=True)


def backend_name(api_url: str = API_URL) -> str:
    """Ask the backend which one it is."""
    r = requests.get(f"{api_url.rstrip('/')}/api/backend", timeout=3)
    r.raise_for_status()
    return r.json()["backend"]


def hello(name: str, api_url: str = API_URL) -> str:
    """Ask the backend to greet `name`. Raises BackendRefused if it refuses the name."""
    r = requests.get(f"{api_url.rstrip('/')}/api/hello", params={"name": name}, timeout=3)
    if r.status_code == 400:
        raise BackendRefused(r.json().get("error", "The backend refused the request"))
    r.raise_for_status()
    return r.json()["message"]
