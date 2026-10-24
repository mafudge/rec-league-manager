from itertools import combinations

from app.schedule import round_robin


def ids(n):
    return [f"e{i}" for i in range(n)]


def test_six_ids_make_five_weeks_and_every_pair_once():
    weeks = round_robin(ids(6))
    assert len(weeks) == 5
    seen = []
    for week in weeks:
        flat = [x for pair in week for x in pair]
        assert sorted(flat) == sorted(ids(6))  # each id exactly once per week
        seen += [frozenset(p) for p in week]
    assert len(seen) == 15 and set(seen) == {frozenset(c) for c in combinations(ids(6), 2)}


def test_five_ids_make_five_weeks_with_one_bye_each():
    weeks = round_robin(ids(5))
    assert len(weeks) == 5
    byes = []
    for week in weeks:
        week_byes = [home for home, away in week if away is None]
        assert len(week_byes) == 1 and len(week) == 3
        byes += week_byes
    assert sorted(byes) == sorted(ids(5))  # each id sits out exactly once


def test_two_ids_make_one_game():
    assert round_robin(["a", "b"]) == [[("a", "b")]]


def test_seven_ids_make_seven_weeks():
    assert len(round_robin(ids(7))) == 7
