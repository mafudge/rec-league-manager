"""US06: standings are computed from games on every request, never stored (PRD G2)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Entrant:
    id: str
    name: str


@dataclass(frozen=True)
class Game:
    week: int
    home_id: str
    away_id: str | None  # None is a bye (architecture doc)
    home_score: int | None = None  # both None until played
    away_score: int | None = None


@dataclass
class StandingsRow:
    entrant_id: str
    name: str
    w: int = 0
    l: int = 0
    t: int = 0
    pf: int = 0
    pa: int = 0

    @property
    def diff(self) -> int:
        return self.pf - self.pa


def compute_standings(entrants: list[Entrant], games: list[Game]) -> list[StandingsRow]:
    rows = {e.id: StandingsRow(e.id, e.name) for e in entrants}
    # Bad game data is an error whether or not the game was played, so the result never depends on a score.
    for g in games:
        for entrant_id in (g.home_id, g.away_id):
            if entrant_id is not None and entrant_id not in rows:
                raise ValueError(f"Week {g.week}: entrant {entrant_id} is not in this league")
        if g.away_id == g.home_id:
            raise ValueError(f"Week {g.week}: entrant {g.home_id} ({rows[g.home_id].name}) can't play itself")
    for g in games:
        # Byes and unplayed games contribute nothing (US06 AC4).
        if g.away_id is None or g.home_score is None or g.away_score is None:
            continue
        home, away = rows[g.home_id], rows[g.away_id]
        home.pf += g.home_score
        home.pa += g.away_score
        away.pf += g.away_score
        away.pa += g.home_score
        # A tie gives neither side a W or L; each side gets a T.
        if g.home_score > g.away_score:
            home.w += 1
            away.l += 1
        elif g.away_score > g.home_score:
            away.w += 1
            home.l += 1
        else:
            home.t += 1
            away.t += 1
    # W, then Diff, then PF, all descending; name only makes the order deterministic.
    return sorted(rows.values(), key=lambda r: (-r.w, -r.diff, -r.pf, r.name))


TIEBREAK = "Sorted by wins, then point difference, then points for."


def standings_json(rows: list[StandingsRow], played: int) -> dict:
    """The Standings shape of the contract; `played` is the number of non-bye games with a score."""
    return {
        "rows": [
            {"entrant_id": r.entrant_id, "name": r.name, "w": r.w, "l": r.l, "t": r.t, "pf": r.pf, "pa": r.pa, "diff": r.diff}
            for r in rows
        ],
        "played": played,
        "tiebreak": TIEBREAK,
    }
