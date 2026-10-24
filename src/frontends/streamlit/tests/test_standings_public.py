"""The Standings tab (US06) and the public page (US07): mirror the web app's standings.test.tsx and public.test.tsx."""
from contextlib import contextmanager
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

from conftest import Reply
from test_league_pages import BASE, TUES, Routes, page, routed, texts
from test_schedule_pages import game
import api
import views

L = "/api/leagues/abc123"
TIEBREAK = "Sorted by wins, then point difference, then points for."


def row(name, w, l, t, pf, pa):
    return {"entrant_id": name, "name": name, "w": w, "l": l, "t": t, "pf": pf, "pa": pa, "diff": pf - pa}


STANDINGS = {"rows": [row("Bag Ladies", 1, 0, 0, 21, 14), row("Corn Stars", 0, 0, 0, 0, 0), row("Toss Bosses", 0, 1, 0, 14, 21)],
             "played": 1, "tiebreak": TIEBREAK}


def league_routes(standings=STANDINGS, league=TUES):
    return {f"GET {L}": [Reply(200, league)], f"GET {L}/entrants": [Reply(200, [])], f"GET {L}/games": [Reply(200, [])],
            f"GET {L}/standings": [Reply(200, standings)]}


def table(at):
    return at.table[0].value


def test_columns_are_entrant_w_l_pf_pa_diff_without_ties():
    with routed(league_routes()) as b:
        at = page("league", {"league_id": "abc123"})
    assert not at.exception
    assert list(table(at).columns) == ["Entrant", "W", "L", "PF", "PA", "Diff"]
    (method, url, kw), = [c for c in b.calls if c[1].endswith("/standings")][:1]
    assert (method, url) == ("GET", f"{BASE}{L}/standings") and kw["headers"] == {"Authorization": "Bearer t1"}


def test_a_t_column_appears_when_the_league_allows_ties():
    with routed(league_routes(league=dict(TUES, allow_ties=True))):
        at = page("league", {"league_id": "abc123"})
    assert list(table(at).columns) == ["Entrant", "W", "L", "T", "PF", "PA", "Diff"]


def test_rows_keep_the_backend_order_and_diff_has_a_plus_only_when_positive():
    with routed(league_routes()):
        at = page("league", {"league_id": "abc123"})
    assert table(at).astype(str).values.tolist() == [
        ["Bag Ladies", "1", "0", "21", "14", "+7"], ["Corn Stars", "0", "0", "0", "0", "0"],
        ["Toss Bosses", "0", "1", "14", "21", "-7"]]


def test_the_tiebreak_sentence_comes_from_the_backend_and_there_is_no_empty_notice_once_played():
    with routed(league_routes()):
        at = page("league", {"league_id": "abc123"})
    assert TIEBREAK in texts(at)
    assert "No games played yet" not in texts(at)


def test_with_no_games_played_it_says_so_and_still_lists_every_entrant():
    none = dict(STANDINGS, played=0, rows=[row(r["name"], 0, 0, 0, 0, 0) for r in STANDINGS["rows"]])
    with routed(league_routes(none)):
        at = page("league", {"league_id": "abc123"})
    assert "No games played yet" in texts(at)
    assert len(table(at)) == 3


def test_a_name_is_shown_as_typed_not_as_markdown():
    s = dict(STANDINGS, rows=[row("**Bold** <b>x</b> $1 $2", 0, 0, 0, 0, 0)])
    with routed(league_routes(s)):
        at = page("league", {"league_id": "abc123"})
    # st.table cells are markdown, so the name is escaped the way every other shown name is
    assert table(at)["Entrant"].tolist() == [views.literal("**Bold** <b>x</b> $1 $2")]


def test_standings_are_fetched_again_on_every_run_so_a_new_score_shows():
    fresh = dict(STANDINGS, rows=[row("Bag Ladies", 2, 0, 0, 40, 20)])
    with routed({**league_routes(), f"GET {L}/standings": [Reply(200, STANDINGS), Reply(200, fresh)]}):
        at = page("league", {"league_id": "abc123"})
        at.run()
    assert table(at)["PF"].astype(str).tolist() == ["40"]


def test_a_refused_standings_call_shows_the_backends_message():
    with routed({**league_routes(), f"GET {L}/standings": [Reply(404, {"error": "League not found"})]}):
        at = page("league", {"league_id": "abc123"})
    assert "League not found" in [e.value for e in at.error]


# ---- the public page
SLUG = "buzr7v"
PUB = dict(TUES, slug=SLUG)
PUB.pop("id")
GAMES = [game("g1", 1, "Bag Ladies", "Corn Stars", 21, 14), game("g2", 1, "Hole Patrol", None),
         game("g3", 2, "Corn Stars", "Hole Patrol"), game("g4", 2, "Bag Ladies", None)]
VIEW = {"league": PUB, "current_week": 2, "games": GAMES,
        "standings": {"rows": [row("Bag Ladies", 1, 0, 0, 21, 14), row("Corn Stars", 0, 1, 0, 14, 21), row("Hole Patrol", 0, 0, 0, 0, 0)],
                      "played": 1, "tiebreak": "Sorted by wins."}}


@contextmanager
def public(reply, state=None):
    """Open `?league=<slug>` with the session empty (signed out) unless `state` says otherwise."""
    b = Routes({f"GET /api/public/{SLUG}": [reply]})
    with patch("requests.request", b), patch("requests.get", lambda *a, **k: Reply(200, {"backend": "fastapi"})):
        at = AppTest.from_file("../app.py", default_timeout=10)
        at.query_params["league"] = SLUG
        for k, v in (state or {}).items():
            at.session_state[k] = v
        yield at.run(), b


def test_name_title_then_location_then_sport_and_season():
    with public(Reply(200, VIEW)) as (at, _):
        assert not at.exception
        assert at.title[0].value == "Tuesday Cornhole"
        t = texts(at)
        assert t.index("Joe's Tavern") == t.index("Cornhole · Fall 2026") - 1


def test_this_week_comes_first_then_the_full_schedule_then_standings():
    with public(Reply(200, VIEW)) as (at, _):
        assert [s.value for s in at.subheader] == ["This week — Week 2", "Full schedule", "Standings"]
        assert [m.value for m in at.markdown if m.value.startswith("**Week ")] == ["**Week 1**", "**Week 2**"]


def test_games_read_as_scores_matchups_and_byes_and_this_week_lists_only_its_games():
    with public(Reply(200, VIEW)) as (at, _):
        t = texts(at)
        assert "Bag Ladies 21 – 14 Corn Stars" in t
        assert t.count("Corn Stars vs Hole Patrol") == 2  # this week and the full schedule
        assert "Hole Patrol — bye" in t
        assert t.index("Corn Stars vs Hole Patrol") < t.index("Bag Ladies 21 – 14 Corn Stars")
        assert len(at.table) == 1


def test_nothing_on_the_page_writes_and_there_is_no_sign_in_or_header():
    with public(Reply(200, VIEW)) as (at, _):
        assert len(at.button) == 0 and len(at.text_input) == 0 and len(at.get("form_submit_button")) == 0
        assert len(at.get("page_link")) == 0 and len(at.checkbox) == 0 and len(at.get("number_input")) == 0
        assert "Sign out" not in texts(at)


def test_it_never_reads_the_session_and_sends_no_authorization_header():
    with public(Reply(200, VIEW), {"token": "secret", "refresh_token": "r"}) as (at, b):
        assert not at.exception
    (method, url, kw), = b.calls
    assert (method, url) == ("GET", f"{BASE}/api/public/{SLUG}")
    assert "Authorization" not in kw["headers"] and "data" not in kw


def test_the_client_call_sends_no_token_and_no_body():
    b = Routes({f"GET /api/public/{SLUG}": [Reply(200, VIEW)]})
    with patch("requests.request", b):
        api.public_league(SLUG)
    assert b.calls[0][2]["headers"] == {}


def test_no_schedule_says_so_and_still_shows_standings():
    with public(Reply(200, dict(VIEW, current_week=None, games=[]))) as (at, _):
        assert "No games scheduled yet" in texts(at)
        assert not any("This week" in s.value for s in at.subheader)
        assert [s.value for s in at.subheader] == ["Standings"]
        assert len(at.table) == 1


def test_an_unknown_league_says_league_not_found_and_shows_nothing_else():
    with public(Reply(404, {"error": "League not found"})) as (at, _):
        assert not at.exception
        assert at.title[0].value == "League not found"
        assert len(at.table) == 0 and len(at.button) == 0 and len(at.error) == 0 and len(at.subheader) == 0


def test_a_backend_that_cant_be_reached_says_so_rather_than_league_not_found():
    with public(ConnectionError("down")) as (at, _):
        assert [e.value for e in at.error] == [views.literal(f"Can't reach the backend at {api.API_URL}")]
        assert len(at.title) == 0


def test_a_refusal_other_than_not_found_is_shown_verbatim():
    with public(Reply(400, {"error": "Slug is invalid"})) as (at, _):
        assert [e.value for e in at.error] == ["Slug is invalid"]


def test_the_title_is_shown_as_typed():
    v = dict(VIEW, league=dict(PUB, name="**Bold** League"))
    with public(Reply(200, v)) as (at, _):
        assert at.title[0].value == r"\*\*Bold\*\* League"


def test_ties_column_follows_the_leagues_allow_ties():
    with public(Reply(200, dict(VIEW, league=dict(PUB, allow_ties=True)))) as (at, _):
        assert list(at.table[0].value.columns) == ["Entrant", "W", "L", "T", "PF", "PA", "Diff"]
