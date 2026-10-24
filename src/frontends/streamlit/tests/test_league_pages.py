import json
from contextlib import contextmanager
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

from conftest import Backend, Reply

BASE = "http://localhost:8000"
STATE = {"token": "t1", "refresh_token": "r1", "email": "dana@example.com"}
TUES = {"id": "abc123", "slug": "k7m2pq", "name": "Tuesday Cornhole", "location": "Joe's Tavern",
        "sport": "Cornhole", "season": "Fall 2026", "weeks": 8, "allow_ties": False}
THURS = dict(TUES, id="z9", slug="zzzzzz", name="Thursday Darts", location="The Pub")


class Routes(Backend):
    """Answers by route (the last reply for a route repeats), so tests don't count reruns' GETs."""

    def __init__(self, routes):
        super().__init__()
        self.routes = {k: list(v) for k, v in routes.items()}

    def __call__(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        key = f"{method} {url.removeprefix(BASE)}"
        if key not in self.routes and key.endswith("/standings"):  # tests that aren't about standings
            return Reply(200, {"rows": [], "played": 0, "tiebreak": "Sorted by wins."})
        queue = self.routes[key]
        r = queue.pop(0) if len(queue) > 1 else queue[0]
        if isinstance(r, Exception):
            raise r
        return r


@contextmanager
def routed(routes):
    b = Routes(routes)
    with patch("requests.request", b), patch("requests.get", lambda *a, **k: Reply(200, {"backend": "fastapi"})):
        yield b


@contextmanager
def backend(*replies):
    b = Backend(*replies)
    with patch("requests.request", b), patch("requests.get", lambda *a, **k: Reply(200, {"backend": "fastapi"})):
        yield b


def page(name, state=None):
    at = AppTest.from_file("../app.py", default_timeout=10).run()
    for k, v in {**STATE, **(state or {})}.items():
        at.session_state[k] = v
    return at.switch_page(f"screens/{name}.py").run()


def texts(at):
    return [m.value for m in at.markdown] + [c.value for c in at.caption] + [c.value for c in at.text]


def posts(b):
    return [c for c in b.calls if c[0] == "POST"]


# ---- the list
def test_an_empty_list_says_so_and_offers_to_create():
    with backend(Reply(200, [])) as b:
        at = page("leagues")
    assert (b.calls[0][0], b.calls[0][1]) == ("GET", f"{BASE}/api/leagues")
    assert b.calls[0][2]["headers"] == {"Authorization": "Bearer t1"}
    assert "No leagues yet — create one." in texts(at)
    assert at.get("page_link")[0].proto.label == "Create a league"


def test_the_list_shows_each_leagues_name_and_location_and_opens_its_home():
    with routed({"GET /api/leagues": [Reply(200, [TUES, THURS])], "GET /api/leagues/z9": [Reply(200, THURS)],
                 "GET /api/leagues/z9/entrants": [Reply(200, [])]}) as b:
        at = page("leagues")
        assert at.button(key="open_z9").label == "Thursday Darts"
        assert at.button(key="open_abc123").label == "Tuesday Cornhole"
        assert "Joe's Tavern" in texts(at) and "The Pub" in texts(at)
        at.button(key="open_z9").click().run()
    assert not at.exception
    assert at.title[0].value == "Thursday Darts"
    assert f"{BASE}/api/leagues/z9" in [c[1] for c in b.calls]


def test_the_list_shows_the_backends_message_when_it_refuses():
    with backend(Reply(500, None)):
        at = page("leagues")
    assert [e.value for e in at.error] == [r"The backend had a problem \(500\)"]


# ---- the create form
def fill(at, **v):
    for k, val in v.items():
        at.text_input(key=f"league_{k}").input(val)


def test_the_form_has_its_fields_and_the_tie_box_starts_unchecked():
    with backend():
        at = page("league_new")
    assert [t.label for t in at.text_input] == ["Name", "Location", "Sport", "Season", "Weeks"]
    assert at.checkbox[0].label == "Games can end in a tie" and at.checkbox[0].value is False


def test_submitting_sends_the_values_and_goes_to_the_new_league():
    with backend(Reply(201, TUES), Reply(200, TUES), Reply(200, [])) as b:
        at = page("league_new")
        fill(at, name="Tuesday Cornhole", location="Joe's Tavern", sport="Cornhole", season="Fall 2026", weeks="8")
        at.checkbox[0].check()
        at.button(key="create_league").click().run()
    assert not at.exception
    method, url, kw = b.calls[0]
    assert (method, url) == ("POST", f"{BASE}/api/leagues")
    assert kw["headers"] == {"Content-Type": "application/json", "Authorization": "Bearer t1"}
    assert json.loads(kw["data"]) == {"name": "Tuesday Cornhole", "location": "Joe's Tavern", "sport": "Cornhole",
                                      "season": "Fall 2026", "weeks": 8, "allow_ties": True}
    assert at.title[0].value == "Tuesday Cornhole"
    assert b.calls[1][1] == f"{BASE}/api/leagues/abc123"


def test_a_blank_weeks_box_is_sent_as_null_and_the_backends_refusal_shown():
    with backend(Reply(400, {"error": "Weeks must be at least 1"})) as b:
        at = page("league_new")
        fill(at, name="N", location="L")
        at.button(key="create_league").click().run()
    assert json.loads(b.calls[0][2]["data"])["weeks"] is None
    assert [e.value for e in at.error] == ["Weeks must be at least 1"]
    assert at.text_input(key="league_name").value == "N"  # typed text kept
    assert at.title[0].value == "Create a league"


def test_a_long_name_is_not_blocked_by_the_input():
    long = "x" * 101
    with backend(Reply(400, {"error": "Name must be 100 characters or fewer"})) as b:
        at = page("league_new")
        fill(at, name=long, location="L", weeks="3")
        at.button(key="create_league").click().run()
    assert json.loads(b.calls[0][2]["data"])["name"] == long
    assert [e.value for e in at.error] == ["Name must be 100 characters or fewer"]


def test_create_is_not_resent_on_the_next_rerun():
    with backend(Reply(400, {"error": "Location is required"})) as b:
        at = page("league_new")
        fill(at, name="N", weeks="3")
        at.button(key="create_league").click().run()
        at.run()
    assert len(posts(b)) == 1


def test_form_and_home_send_a_signed_out_visitor_to_sign_in():
    for name in ("leagues", "league_new", "league"):
        with backend() as b:
            at = page(name, {"token": None})
        assert at.title[0].value == "Sign in" and b.calls == []


# ---- the league home
def test_the_home_shows_name_location_sport_season_and_the_public_link():
    with backend(Reply(200, TUES), Reply(200, [])) as b:
        at = page("league", {"league_id": "abc123"})
    assert (b.calls[0][0], b.calls[0][1]) == ("GET", f"{BASE}/api/leagues/abc123")
    assert at.title[0].value == "Tuesday Cornhole"
    assert "Joe's Tavern" in texts(at) and "Cornhole · Fall 2026" in texts(at)
    assert at.code[0].value == "http://localhost:8501/?league=k7m2pq"
    assert [t.label for t in at.tabs] == ["Entrants", "Schedule", "Standings"]


def test_the_public_link_uses_PUBLIC_BASE_URL(monkeypatch):
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://league.example.com/")
    with backend(Reply(200, TUES), Reply(200, [])):
        at = page("league", {"league_id": "abc123"})
    assert at.code[0].value == "https://league.example.com/?league=k7m2pq"


def test_blank_sport_and_season_leave_the_line_out():
    with backend(Reply(200, dict(TUES, season="")), Reply(200, [])):
        at = page("league", {"league_id": "abc123"})
    assert "Cornhole" in texts(at)
    with backend(Reply(200, dict(TUES, sport="", season="")), Reply(200, [])):
        at = page("league", {"league_id": "abc123"})
    assert not any("·" in t for t in texts(at))


def test_another_organizers_league_shows_the_backends_404():
    with backend(Reply(404, {"error": "League not found"})):
        at = page("league", {"league_id": "nope"})
    assert [e.value for e in at.error] == ["League not found"]


# ---- entrants
def home(*replies, state=None):
    return backend(Reply(200, TUES), *replies)


def test_existing_entrants_are_listed_in_order():
    with home(Reply(200, [{"id": "1", "name": "Bag Ladies"}, {"id": "2", "name": "Corn Stars"}])) as b:
        at = page("league", {"league_id": "abc123"})
    assert (b.calls[1][0], b.calls[1][1]) == ("GET", f"{BASE}/api/leagues/abc123/entrants")
    assert [m.value for m in at.text if m.value in ("Bag Ladies", "Corn Stars")] == ["Bag Ladies", "Corn Stars"]
    assert "No entrants yet — add the first one." not in texts(at)


def test_no_entrants_says_so():
    with home(Reply(200, [])):
        at = page("league", {"league_id": "abc123"})
    assert "No entrants yet — add the first one." in texts(at)


def test_adding_shows_the_name_clears_the_box_and_sends_once_even_after_another_interaction():
    added = {"id": "1", "name": "Bag Ladies"}
    E = "GET /api/leagues/abc123/entrants"
    with routed({"GET /api/leagues/abc123": [Reply(200, TUES)], E: [Reply(200, []), Reply(200, [added])],
                 "POST /api/leagues/abc123/entrants": [Reply(201, added)]}) as b:
        at = page("league", {"league_id": "abc123"})
        at.text_input[0].input("Bag Ladies")
        at.button(key="add_entrant").click().run()
        assert not at.exception
        assert at.text_input[0].value == ""
        assert "Bag Ladies" in texts(at)
        at.run()  # any later interaction
        assert "Bag Ladies" in texts(at)
    method, url, kw = posts(b)[0]
    assert url == f"{BASE}/api/leagues/abc123/entrants"
    assert kw["headers"] == {"Content-Type": "application/json", "Authorization": "Bearer t1"}
    assert json.loads(kw["data"]) == {"name": "Bag Ladies"}
    assert len(posts(b)) == 1


def test_the_backends_refusal_is_shown_verbatim_and_the_box_keeps_the_text():
    err = "An entrant with that name already exists in this league"
    one = {"id": "1", "name": "Bag Ladies"}
    with routed({"GET /api/leagues/abc123": [Reply(200, TUES)], "GET /api/leagues/abc123/entrants": [Reply(200, [one])], "GET /api/leagues/abc123/games": [Reply(200, [])],
                 "POST /api/leagues/abc123/entrants": [Reply(409, {"error": err})]}) as b:
        at = page("league", {"league_id": "abc123"})
        at.text_input[0].input(" bag ladies ")
        at.button(key="add_entrant").click().run()
        assert [e.value for e in at.error] == [err]
        assert at.text_input[0].value == " bag ladies "
        assert [m.value for m in at.text].count("Bag Ladies") == 1
        at.run()
    assert len(posts(b)) == 1


def test_a_blank_name_is_sent_for_the_backend_to_refuse():
    with routed({"GET /api/leagues/abc123": [Reply(200, TUES)], "GET /api/leagues/abc123/entrants": [Reply(200, [])], "GET /api/leagues/abc123/games": [Reply(200, [])],
                 "POST /api/leagues/abc123/entrants": [Reply(400, {"error": "Name is required"})]}) as b:
        at = page("league", {"league_id": "abc123"})
        at.button(key="add_entrant").click().run()
    assert json.loads(posts(b)[0][2]["data"]) == {"name": ""}
    assert [e.value for e in at.error] == ["Name is required"]


# ---- review fixes
WEIRD = "*A* $1 $2 :tada:"


def test_user_text_is_shown_literally():
    league = dict(TUES, name=WEIRD, location="_L_ $3 :smile:", sport="*S*", season="$4 $5")
    with routed({"GET /api/leagues/abc123": [Reply(200, league)],
                 "GET /api/leagues/abc123/entrants": [Reply(200, [{"id": "1", "name": WEIRD}])]}):
        at = page("league", {"league_id": "abc123"})
    assert [t.value for t in at.text][:3] == ["_L_ $3 :smile:", "*S* · $4 $5", WEIRD]  # then the Standings tab
    import views
    assert at.title[0].value == views.literal(WEIRD) == r"\*A\* \$1 \$2 \:tada\:"
    with routed({"GET /api/leagues": [Reply(200, [league])]}):
        at = page("leagues")
    assert at.button(key="open_abc123").label == views.literal(WEIRD)
    assert "_L_ $3 :smile:" in texts(at)


def test_the_public_url_is_shown_as_text_with_no_extra_caption():
    with backend(Reply(200, TUES), Reply(200, [])):
        at = page("league", {"league_id": "abc123"})
    assert at.code[0].value == "http://localhost:8501/?league=k7m2pq"
    assert not at.caption or all("Public link" not in c.value for c in at.caption)


def test_the_home_with_no_league_selected_goes_back_to_the_list():
    with backend(Reply(200, [])):
        at = page("league")
    assert at.title[0].value == "My leagues"


def test_weeks_is_digits_only_else_sent_as_typed():
    for typed, sent in [(" 10 ", 10), ("1_0", "1_0"), ("1.5", "1.5"), ("-2", "-2")]:
        with backend(Reply(400, {"error": "Weeks must be at least 1"})) as b:
            at = page("league_new")
            fill(at, name="N", location="L", weeks=typed)
            at.button(key="create_league").click().run()
        assert json.loads(b.calls[0][2]["data"])["weeks"] == sent
