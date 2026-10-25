from django.test import SimpleTestCase

from api.standings import Entrant, Game, compute_standings

A, B, C, D = (Entrant("1", "Bag Ladies"), Entrant("2", "Corn Stars"), Entrant("3", "Hole Patrol"), Entrant("4", "Sack Attack"))


def table(rows):
    return [(r.name, r.w, r.l, r.pf, r.pa, r.diff) for r in rows]


class ComputeStandingsTests(SimpleTestCase):
    def test_ac1_played_games_give_w_l_pf_pa_diff_sorted_by_w_then_diff(self):
        games = [
            Game(1, A.id, B.id, 21, 14),
            Game(1, C.id, D.id, 21, 20),
            Game(2, A.id, C.id, 21, 10),
            Game(2, B.id, D.id, 21, 5),
        ]
        self.assertEqual(
            table(compute_standings([A, B, C, D], games)),
            [
                ("Bag Ladies", 2, 0, 42, 24, 18),
                ("Corn Stars", 1, 1, 35, 26, 9),  # same W as Hole Patrol, better Diff
                ("Hole Patrol", 1, 1, 31, 41, -10),
                ("Sack Attack", 0, 2, 25, 42, -17),
            ],
        )

    def test_ac2_equal_w_and_diff_are_ordered_by_pf(self):
        games = [
            Game(1, B.id, A.id, 15, 10),
            Game(2, B.id, D.id, 5, 10),
            Game(1, C.id, D.id, 21, 16),
            Game(2, C.id, A.id, 16, 21),
        ]
        rows = compute_standings([A, B, C, D], games)
        self.assertTrue(all(r.w == 1 and r.diff == 0 for r in rows))
        self.assertEqual(
            [(r.name, r.pf) for r in rows],
            [("Hole Patrol", 37), ("Bag Ladies", 31), ("Sack Attack", 26), ("Corn Stars", 20)],
        )

    def test_ac3_no_games_played_every_entrant_shows_0_0(self):
        games = [Game(1, A.id, B.id, None, None), Game(1, C.id, D.id, None, None)]
        rows = compute_standings([A, B, C, D], games)
        self.assertEqual([(r.w, r.l, r.pf, r.pa, r.diff) for r in rows], [(0, 0, 0, 0, 0)] * 4)
        self.assertEqual({r.name for r in rows}, {"Bag Ladies", "Corn Stars", "Hole Patrol", "Sack Attack"})

    def test_ac3_no_games_at_all_still_lists_every_entrant(self):
        self.assertEqual(len(compute_standings([A, B, C, D], [])), 4)

    def test_ac4_an_unplayed_game_contributes_nothing(self):
        played = [Game(1, A.id, B.id, 21, 14)]
        unplayed = [Game(2, A.id, C.id, None, None), Game(2, B.id, D.id, 21, None)]
        self.assertEqual(compute_standings([A, B, C, D], played + unplayed), compute_standings([A, B, C, D], played))

    def test_a_bye_contributes_nothing(self):
        rows = compute_standings([A, B], [Game(1, A.id, None, None, None)])
        self.assertEqual(table(rows), [("Bag Ladies", 0, 0, 0, 0, 0), ("Corn Stars", 0, 0, 0, 0, 0)])

    def test_a_tie_counts_points_but_neither_win_nor_loss(self):
        rows = compute_standings([A, B], [Game(1, A.id, B.id, 15, 15)])
        self.assertEqual(table(rows), [("Bag Ladies", 0, 0, 15, 15, 0), ("Corn Stars", 0, 0, 15, 15, 0)])
        self.assertEqual([r.t for r in rows], [1, 1])  # each side gets a T

    def test_us06_01_unknown_entrant_is_a_value_error_played_or_not(self):
        with self.assertRaisesRegex(ValueError, "Week 3: entrant 99 is not in this league"):
            compute_standings([A, B], [Game(3, A.id, "99", 10, 5)])
        with self.assertRaisesRegex(ValueError, "Week 2: entrant 77 is not in this league"):
            compute_standings([A, B], [Game(2, "77", B.id, None, None)])

    def test_us06_01_an_entrant_cannot_play_itself(self):
        with self.assertRaisesRegex(ValueError, r"Week 3: entrant 2 \(Corn Stars\) can't play itself"):
            compute_standings([A, B], [Game(3, B.id, B.id, 10, 5)])
