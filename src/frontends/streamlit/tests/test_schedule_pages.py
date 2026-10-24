"""The Schedule tab (US04, US05): mirrors the web app's schedule.test.tsx."""
import json
from contextlib import contextmanager

from conftest import Reply
from test_league_pages import BASE, TUES, page, posts, routed, texts
import views

L = "/api/leagues/abc123"


def game(id, week, home, away, hs=None, as_=None):
    return {"id": id, "week": week, "home_id": f"h-{home}", "home_name": home,
            "away_id": f"a-{away}" if away else None, "away_name": away, "home_score": hs, "away_score": as_}


GENERATED = [game("g1", 1, "Bag Ladies", "Corn Stars"), game("g2", 1, "Hole Patrol", None),
             game("g3", 2, "Corn Stars", "Hole Patrol")]
NAMES = ["Bag Ladies", "Corn Stars", "Hole Patrol"]


def entrants(names=NAMES):
    return Reply(200, [{"id": f"h-{n}", "name": n} for n in names])


def routes(games=(), names=NAMES, **extra):
    r = {f"GET {L}": [Reply(200, TUES)], f"GET {L}/games": [Reply(200, list(games))],
         f"GET {L}/entrants": [entrants(names)]}
    r.update(extra)
    return r


@contextmanager
def routed_page(r):
    """Open the league home with `r` answering routes; yields (at, backend) with the backend still patched.
    A route with several replies answers each GET in turn: first render, the click's run, then the reload."""
    with routed(r) as b:
        yield page("league", {"league_id": "abc123"}), b


def calls(b, method, suffix):
    return [c for c in b.calls if c[0] == method and c[1].endswith(suffix)]


def errors(at):
    return [e.value for e in at.error]


def test_with_no_games_it_says_there_is_no_schedule_yet():
    with routed_page(routes()) as (at, _):
        assert "No schedule yet — add entrants, then generate." in texts(at)
        assert at.button(key="generate").label == "Generate schedule"


def test_existing_games_are_grouped_by_week_with_byes_and_no_empty_notice():
    with routed_page(routes(GENERATED)) as (at, _):
        assert [s.value for s in at.subheader] == ["Week 1", "Week 2"]
        t = texts(at)
        assert "Bag Ladies vs Corn Stars" in t and "Hole Patrol — bye" in t and "Corn Stars vs Hole Patrol" in t
        assert not any("No schedule yet" in x for x in t)


def test_generate_posts_with_no_body_and_no_content_type_and_shows_the_games_and_message():
    msg = "This schedule needs 5 weeks, so the league now runs 5 weeks instead of 8."
    r = routes(**{f"GET {L}/games": [Reply(200, []), Reply(200, GENERATED)],
                  f"POST {L}/schedule": [Reply(201, {"weeks": 5, "message": msg})]})
    with routed_page(r) as (at, b):
        at.button(key="generate").click().run()
        assert not at.exception
        assert msg in texts(at)
        assert "Hole Patrol — bye" in texts(at) and "Week 1" in [s.value for s in at.subheader]
        at.run()  # a later rerun
    (method, url, kw), = posts(b)
    assert url == f"{BASE}{L}/schedule"
    assert "data" not in kw and "json" not in kw and "Content-Type" not in kw["headers"]
    assert kw["headers"] == {"Authorization": "Bearer t1"}


def test_no_message_when_the_backend_has_none():
    r = routes(GENERATED, **{f"POST {L}/schedule": [Reply(201, {"weeks": 2, "message": None})]})
    with routed_page(r) as (at, _):
        at.button(key="generate").click().run()
        assert not at.error and not at.info


def test_generate_refusals_are_shown_as_the_backend_worded_them():
    for status, error in [(400, "Add at least 2 entrants first"), (409, "Scores already recorded — clear them first")]:
        with routed_page(routes(**{f"POST {L}/schedule": [Reply(status, {"error": error})]})) as (at, b):
            at.button(key="generate").click().run()
            assert errors(at) == [error]
            at.run()
            assert len(posts(b)) == 1


def test_clear_all_asks_first_cancel_changes_nothing_and_yes_deletes_with_no_body_once():
    r = routes(GENERATED, **{f"DELETE {L}/scores": [Reply(200, {"cleared": 1})]})
    with routed_page(r) as (at, b):
        at.button(key="clear_all").click().run()
        assert "Clear every score in this league?" in texts(at)
        assert calls(b, "DELETE", "/scores") == []
        at.button(key="clear_all_no").click().run()
        assert "Clear every score in this league?" not in texts(at)
        assert calls(b, "DELETE", "/scores") == []
        at.button(key="clear_all").click().run()
        at.button(key="clear_all_yes").click().run()
        assert not at.exception
        assert "Clear every score in this league?" not in texts(at)
        at.run()
    (method, url, kw), = calls(b, "DELETE", "/scores")
    assert url == f"{BASE}{L}/scores"
    assert "data" not in kw and "Content-Type" not in kw["headers"]
    assert len(calls(b, "GET", "/games")) >= 2  # reloaded


def test_asking_to_clear_all_or_cancelling_drops_an_old_generate_refusal():
    err = "Scores already recorded — clear them first"
    r = routes(GENERATED, **{f"POST {L}/schedule": [Reply(409, {"error": err})]})
    with routed_page(r) as (at, _):
        at.button(key="generate").click().run()
        assert errors(at) == [err]
        at.button(key="clear_all").click().run()
        assert errors(at) == []


def test_clear_all_shows_the_backends_refusal():
    r = routes(GENERATED, **{f"DELETE {L}/scores": [Reply(404, {"error": "League not found"})]})
    with routed_page(r) as (at, _):
        at.button(key="clear_all").click().run()
        at.button(key="clear_all_yes").click().run()
        assert errors(at) == ["League not found"]


def test_each_game_has_two_labelled_number_inputs_and_save_but_a_bye_has_none():
    with routed_page(routes(GENERATED)) as (at, _):
        assert [(n.label, n.min, n.step) for n in at.number_input] == [
            ("Bag Ladies score", 0, 1), ("Corn Stars score", 0, 1),
            ("Corn Stars score", 0, 1), ("Hole Patrol score", 0, 1)]
        assert all(n.value is None for n in at.number_input)
        assert [b.label for b in at.button if b.key.startswith("save_")] == ["Save", "Save"]


def test_saving_sends_the_scores_once_and_the_game_shows_played_and_stays_editable():
    played = [game("g1", 1, "Bag Ladies", "Corn Stars", 21, 14), *GENERATED[1:]]
    r = routes(**{f"GET {L}/games": [Reply(200, GENERATED), Reply(200, GENERATED), Reply(200, played)],
                  "PUT /api/games/g1/score": [Reply(200, played[0])]})
    with routed_page(r) as (at, b):
        at.number_input[0].set_value(21)
        at.number_input[1].set_value(14)
        at.button(key="save_g1").click().run()
        assert not at.exception
        assert "Bag Ladies 21 – 14 Corn Stars" in texts(at)
        assert [n.value for n in at.number_input[:2]] == [21, 14]
        at.run()
    (method, url, kw), = [c for c in b.calls if c[0] == "PUT"]
    assert url == f"{BASE}/api/games/g1/score"
    assert kw["headers"] == {"Content-Type": "application/json", "Authorization": "Bearer t1"}
    assert json.loads(kw["data"]) == {"home_score": 21, "away_score": 14}


def test_blank_inputs_are_sent_as_empty_strings_and_the_refusal_shows_with_that_game():
    err = "Scores must be whole numbers 0 or greater"
    r = routes(GENERATED, **{"PUT /api/games/g1/score": [Reply(400, {"error": err})]})
    with routed_page(r) as (at, b):
        at.button(key="save_g1").click().run()
        assert errors(at) == [err]
        assert "Bag Ladies vs Corn Stars" in texts(at)
        at.run()
    puts = [c for c in b.calls if c[0] == "PUT"]
    assert len(puts) == 1 and json.loads(puts[0][2]["data"]) == {"home_score": "", "away_score": ""}


def test_one_blank_input_sends_empty_string_for_it():
    r = routes(GENERATED, **{"PUT /api/games/g1/score": [Reply(400, {"error": "Scores must be whole numbers 0 or greater"})]})
    with routed_page(r) as (at, b):
        at.number_input[0].set_value(21)
        at.button(key="save_g1").click().run()
    assert json.loads([c for c in b.calls if c[0] == "PUT"][0][2]["data"]) == {"home_score": 21, "away_score": ""}


def test_a_tie_refusal_is_shown_as_the_backend_worded_it():
    r = routes(GENERATED, **{"PUT /api/games/g1/score": [Reply(400, {"error": "This league doesn't allow ties"})]})
    with routed_page(r) as (at, _):
        at.number_input[0].set_value(15)
        at.number_input[1].set_value(15)
        at.button(key="save_g1").click().run()
        assert errors(at) == ["This league doesn't allow ties"]


def test_clear_is_only_on_played_games_sends_both_null_and_the_row_reads_unplayed_again():
    scored = [game("g1", 1, "Bag Ladies", "Corn Stars", 21, 14), *GENERATED[1:]]
    r = routes(**{f"GET {L}/games": [Reply(200, scored), Reply(200, scored), Reply(200, GENERATED)],
                  "PUT /api/games/g1/score": [Reply(200, GENERATED[0])]})
    with routed_page(r) as (at, b):
        assert "Bag Ladies 21 – 14 Corn Stars" in texts(at)
        assert [x.key for x in at.button if x.key.startswith("clear_") and x.key != "clear_all"] == ["clear_g1"]
        assert at.button(key="clear_g1").label == "Clear"
        at.button(key="clear_g1").click().run()
        assert not at.exception
        assert "Bag Ladies vs Corn Stars" in texts(at)
        assert [n.value for n in at.number_input[:2]] == [None, None]
        assert not [x for x in at.button if x.key.startswith("clear_g")]
        at.run()
    (put,) = [c for c in b.calls if c[0] == "PUT"]
    assert json.loads(put[2]["data"]) == {"home_score": None, "away_score": None}
    assert len(calls(b, "GET", "/games")) >= 2


STALE = "Regenerate the schedule to include new entrants."


def test_an_entrant_with_no_games_shows_the_regenerate_notice_above_the_weeks():
    with routed_page(routes(GENERATED, names=NAMES + ["Late Joiners"])) as (at, _):
        t = texts(at)
        assert STALE in t
        assert t.index(STALE) < t.index("Bag Ladies vs Corn Stars")


def test_no_notice_when_every_entrant_has_a_game_or_there_is_no_schedule():
    with routed_page(routes(GENERATED)) as (at, _):
        assert STALE not in texts(at)
    with routed_page(routes(names=["Bag Ladies", "Corn Stars"])) as (at, _):
        assert STALE not in texts(at)


def test_a_failed_entrants_fetch_just_hides_the_notice():
    with routed_page(routes(GENERATED, **{f"GET {L}/entrants": [Reply(500, None)]})) as (at, _):
        assert STALE not in texts(at) and "Hole Patrol — bye" in texts(at)


def test_a_failed_games_fetch_shows_the_backends_message():
    with routed_page(routes(**{f"GET {L}/games": [Reply(500, None)]})) as (at, _):
        assert errors(at) == [views.literal("The backend had a problem (500)")]


def test_entrant_names_and_backend_messages_are_shown_literally():
    weird = "*A* $1 :tada:"
    games = [game("g1", 1, weird, "B")]
    r = routes(games, names=[weird, "B"], **{f"POST {L}/schedule": [Reply(400, {"error": "_bad_ *msg* $1"})]})
    with routed_page(r) as (at, _):
        assert f"{weird} vs B" in texts(at)
        assert at.number_input[0].label == views.literal(weird) + " score"
        at.button(key="generate").click().run()
        assert errors(at) == [views.literal("_bad_ *msg* $1")]


def test_the_header_email_is_shown_literally():
    from test_league_pages import backend
    with backend():
        at = page("leagues", {"email": "a_b*c@example.com"})
    assert views.literal("a_b*c@example.com") in [m.value for m in at.markdown]
