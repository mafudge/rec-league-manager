import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class Reply:
    """A requests.Response stand-in."""

    def __init__(self, status, body=None):
        self.status_code, self.body = status, body

    @property
    def ok(self):
        return self.status_code < 400

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)

    def json(self):
        if self.body is None:
            raise ValueError("no JSON")
        return self.body


class Backend:
    """A requests.request stand-in: answers from a queue and records every call."""

    def __init__(self, *replies):
        self.replies, self.calls = list(replies), []

    def __call__(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        r = self.replies.pop(0)
        if isinstance(r, Exception):
            raise r
        return r
