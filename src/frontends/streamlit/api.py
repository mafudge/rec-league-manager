"""The one client for every backend: they all serve the same REST contract (ADR 003)."""
import os

import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000")


class BackendRefused(Exception):
    """The backend understood the request and said no, e.g. "Name is required"."""


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
