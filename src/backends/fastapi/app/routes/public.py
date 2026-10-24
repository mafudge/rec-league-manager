from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_session
from ..errors import ApiError
from ..models import Entrant, Game, League
from ..schedule import game_json
from ..standings import Entrant as StandingsEntrant
from ..standings import Game as StandingsGame
from ..standings import compute_standings, is_played, played_count, standings_json
from .leagues import league_json

router = APIRouter(prefix="/api/public")


def current_week(games: list[Game]) -> int | None:
    """Lowest week with an unplayed non-bye game; the last week once everything is played; None with no games."""
    if not games:
        return None
    open_weeks = [g.week for g in games if g.away_id is not None and not is_played(g)]
    return min(open_weeks) if open_weeks else max(g.week for g in games)


@router.get("/{slug}")
def public_league(slug: str, session: Session = Depends(get_session)):
    """No token: anyone with the link reads the league, schedule and standings. Nothing here writes."""
    league = session.scalar(select(League).where(League.slug == slug))
    if league is None:
        raise ApiError(404, "League not found")
    entrants = session.scalars(select(Entrant).where(Entrant.league_id == league.id).order_by(Entrant.position)).all()
    games = session.scalars(select(Game).where(Game.league_id == league.id).order_by(Game.week, Game.slot)).all()
    names = {e.id: e.name for e in entrants}
    rows = compute_standings(
        [StandingsEntrant(e.id, e.name) for e in entrants],
        [StandingsGame(g.week, g.home_id, g.away_id, g.home_score, g.away_score) for g in games],
    )
    public = {k: v for k, v in league_json(league).items() if k != "id"}  # the database id stays private
    return {
        "league": public,
        "current_week": current_week(games),
        "games": [game_json(g, names) for g in games],
        "standings": standings_json(rows, played_count(games)),
    }
