from unittest.mock import patch

from streamlit.testing.v1 import AppTest


def _run(get):
    with patch("requests.get", get):
        at = AppTest.from_file("../app.py").run()
    assert not at.exception
    return at


def test_shows_title_and_backend_ok():
    class R:
        def raise_for_status(self): pass
        def json(self): return {"status": "ok"}

    at = _run(lambda *a, **k: R())
    assert at.title[0].value == "Rec League Manager"
    assert at.markdown[0].value == "Backend: ok"


def test_backend_down_is_reported():
    def boom(*a, **k):
        raise ConnectionError

    assert _run(boom).markdown[0].value == "Backend: backend unreachable"
