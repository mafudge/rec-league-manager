from typing import Any

from .models import Game


def round_robin(entrant_ids: list[str]) -> list[list[tuple[str, str | None]]]:
    """Circle method: one list of (home, away) pairs per week; away is None for the bye.

    Ring of n slots (n even). With an odd count the bye placeholder None takes slot 0, so it is the fixed
    slot and the real entrants rotate. Slot 0 stays put and the rest rotate one place per week; slot i
    meets slot n-1-i. A pair holding the placeholder is a bye, written (real id, None): real id at home.

    Orientation, so every entrant's home and away games differ by at most one (byes don't count): number
    the pairs of a week 0, 1, 2, ... by slot i. Pair 0 is (slot 0, slot n-1) in even weeks (counting weeks
    from 0) and flipped to (slot n-1, slot 0) in odd weeks. Every other pair i is (slot i, slot n-1-i) when
    i is odd and flipped when i is even, in every week. Checked by tests/test_round_robin.py for n = 2..52.
    """
    ring: list[str | None] = list(entrant_ids)
    if len(ring) % 2:
        ring.insert(0, None)
    n = len(ring)
    weeks = []
    for w in range(n - 1):
        week = []
        for i in range(n // 2):
            a, b = ring[i], ring[n - 1 - i]
            if (w % 2 == 1) if i == 0 else (i % 2 == 0):
                a, b = b, a
            if a is None:
                a, b = b, a
            week.append((a, b))
        weeks.append(week)
        ring = [ring[0], ring[-1], *ring[1:-1]]
    return weeks


def game_json(g: Game, names: dict[str, str]) -> dict[str, Any]:
    return {
        "id": g.id,
        "week": g.week,
        "home_id": g.home_id,
        "home_name": names[g.home_id],
        "away_id": g.away_id,
        "away_name": names[g.away_id] if g.away_id else None,
        "home_score": g.home_score,
        "away_score": g.away_score,
    }
