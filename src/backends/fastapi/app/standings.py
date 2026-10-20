"""US06: standings are computed from games on every request, never stored (PRD G2)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Entrant:
    id: int
    name: str


@dataclass(frozen=True)
class Game:
    week: int
    home_id: int
    away_id: int | None  # None is a bye (architecture doc)
    home_score: int | None = None  # both None until played
    away_score: int | None = None


@dataclass
class StandingsRow:
    entrant_id: int
    name: str
    w: int = 0
    l: int = 0
    pf: int = 0
    pa: int = 0

    @property
    def diff(self) -> int:
        return self.pf - self.pa


def compute_standings(entrants: list[Entrant], games: list[Game]) -> list[StandingsRow]:
    rows = {e.id: StandingsRow(e.id, e.name) for e in entrants}
    for g in games:
        # Byes and unplayed games contribute nothing (US06 AC4).
        if g.away_id is None or g.home_score is None or g.away_score is None:
            continue
        home, away = rows[g.home_id], rows[g.away_id]
        home.pf += g.home_score
        home.pa += g.away_score
        away.pf += g.away_score
        away.pa += g.home_score
        # A tie gives neither side a W or L (open question in the backlog).
        if g.home_score > g.away_score:
            home.w += 1
            away.l += 1
        elif g.away_score > g.home_score:
            away.w += 1
            home.l += 1
    # W, then Diff, then PF, all descending; name only makes the order deterministic.
    return sorted(rows.values(), key=lambda r: (-r.w, -r.diff, -r.pf, r.name))
