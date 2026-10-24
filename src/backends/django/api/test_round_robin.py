import json
from itertools import combinations
from pathlib import Path

from django.test import SimpleTestCase

from api.schedule import round_robin

FIXTURE = Path(__file__).parent / "tests_fixtures" / "round_robin_fastapi.json"


def ids(n):
    return [f"e{i}" for i in range(n)]


class RoundRobinTests(SimpleTestCase):
    def test_matches_fastapi_exactly_for_the_fixture_sizes(self):
        # Review Focus 5: same pairs, order, home/away and byes as FastAPI, or the two backends look different.
        fixture = json.loads(FIXTURE.read_text())
        self.assertEqual(set(fixture), {"2", "3", "5", "6", "7", "52"})
        for n, expected in fixture.items():
            got = [[list(pair) for pair in week] for week in round_robin([f"e{i:02d}" for i in range(int(n))])]
            self.assertEqual(got, expected, n)

    def test_six_ids_make_five_weeks_and_every_pair_once(self):
        weeks = round_robin(ids(6))
        self.assertEqual(len(weeks), 5)
        seen = []
        for week in weeks:
            flat = [x for pair in week for x in pair]
            self.assertEqual(sorted(flat), sorted(ids(6)))
            seen += [frozenset(p) for p in week]
        self.assertEqual(len(seen), 15)
        self.assertEqual(set(seen), {frozenset(c) for c in combinations(ids(6), 2)})

    def test_five_ids_make_five_weeks_with_one_bye_each(self):
        weeks = round_robin(ids(5))
        self.assertEqual(len(weeks), 5)
        byes = []
        for week in weeks:
            week_byes = [home for home, away in week if away is None]
            self.assertEqual((len(week_byes), len(week)), (1, 3))
            byes += week_byes
        self.assertEqual(sorted(byes), sorted(ids(5)))

    def test_two_ids_make_one_game(self):
        self.assertEqual(round_robin(["a", "b"]), [[("a", "b")]])

    def test_seven_ids_make_seven_weeks(self):
        self.assertEqual(len(round_robin(ids(7))), 7)

    def test_every_pair_once_and_home_away_balanced_for_2_to_52_entrants(self):
        for n in range(2, 53):
            everyone = ids(n)
            home = dict.fromkeys(everyone, 0)
            away = dict.fromkeys(everyone, 0)
            seen = []
            for week in round_robin(everyone):
                for h, a in week:
                    if a is None:
                        continue
                    home[h] += 1
                    away[a] += 1
                    seen.append(frozenset((h, a)))
            self.assertEqual(len(seen), n * (n - 1) // 2, n)
            self.assertEqual(set(seen), {frozenset(c) for c in combinations(everyone, 2)}, n)
            for e in everyone:
                self.assertLessEqual(abs(home[e] - away[e]), 1, (n, e))
