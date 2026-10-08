"""The one client for every backend: they all serve the same REST contract (ADR 003)."""
import os

import requests

API_URL = os.environ.get("API_URL", "http://localhost:8000")


def backend_name(api_url: str = API_URL) -> str:
    """Ask the backend which one it is."""
    r = requests.get(f"{api_url.rstrip('/')}/api/backend", timeout=3)
    r.raise_for_status()
    return r.json()["backend"]
