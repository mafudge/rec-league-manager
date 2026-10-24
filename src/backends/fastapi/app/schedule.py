from typing import Any

from .models import Game


def round_robin(entrant_ids: list[str]) -> list[list[tuple[str, str | None]]]:
    """Circle method: one list of (home, away) pairs per week; away is None for the bye.

    An odd count gets a placeholder None so one entrant sits out each week. The first id stays put and the
    rest rotate one place per week; position i meets position n-1-i. A pair with the placeholder puts the
    real id at home.
    """
    ring: list[str | None] = list(entrant_ids)
    if len(ring) % 2:
        ring.append(None)
    n = len(ring)
    weeks = []
    for _ in range(n - 1):
        week = []
        for i in range(n // 2):
            a, b = ring[i], ring[n - 1 - i]
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
