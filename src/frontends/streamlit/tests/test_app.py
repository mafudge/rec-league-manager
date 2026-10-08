import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from streamlit.testing.v1 import AppTest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class Ok:
    def __init__(self, body):
        self.body = body

    def raise_for_status(self):
        pass

    def json(self):
        return self.body


def _run(get):
    with patch("requests.get", get):
        at = AppTest.from_file("../app.py").run()
    assert not at.exception
    return at


def test_says_hello_from_the_backend_that_answered():
    calls = []

    def get(url, **kwargs):
        calls.append(url)
        return Ok({"backend": "firebase"})

    at = _run(get)
    assert at.title[0].value == "Rec League Manager"
    assert at.markdown[0].value == "Hello from firebase"
    assert calls == ["http://localhost:8000/api/backend"]


def test_says_where_it_looked_when_the_backend_is_unreachable():
    def boom(*a, **k):
        raise ConnectionError

    assert _run(boom).markdown[0].value == "Can't reach the backend at http://localhost:8000"


def test_ignores_a_trailing_slash_on_the_api_url():
    with patch("requests.get", return_value=Ok({"backend": "django"})) as get:
        from api import backend_name

        assert backend_name("http://localhost:8000/") == "django"
    get.assert_called_once_with("http://localhost:8000/api/backend", timeout=3)


# Live: LIVE_API_URL=http://localhost:5000 LIVE_BACKEND=firebase python -m pytest
LIVE = os.environ.get("LIVE_API_URL")


@pytest.mark.skipif(not LIVE, reason="set LIVE_API_URL to test against a running backend")
def test_a_running_backend_names_itself():
    from api import backend_name

    name = backend_name(LIVE)
    assert name in {"fastapi", "django", "supabase", "firebase"}
    if os.environ.get("LIVE_BACKEND"):
        assert name == os.environ["LIVE_BACKEND"]
