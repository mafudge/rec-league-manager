from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_organizer
from ..db import get_session
from ..models import Entrant, Game, Organizer
from ..standings import Entrant as StandingsEntrant
from ..standings import Game as StandingsGame
from ..standings import compute_standings, played_count, standings_json
from .leagues import owned_league

router = APIRouter(prefix="/api/leagues/{id}")


@router.get("/standings")
def standings(id: str, organizer: Organizer = Depends(current_organizer), session: Session = Depends(get_session)):
    """Computed from the games on every request; nothing stores standings (PRD §5)."""
    owned_league(id, organizer, session)
    entrants = session.scalars(select(Entrant).where(Entrant.league_id == id).order_by(Entrant.position)).all()
    games = session.scalars(select(Game).where(Game.league_id == id).order_by(Game.week, Game.slot)).all()
    rows = compute_standings(
        [StandingsEntrant(e.id, e.name) for e in entrants],
        [StandingsGame(g.week, g.home_id, g.away_id, g.home_score, g.away_score) for g in games],
    )
    played = played_count(games)
    return standings_json(rows, played)
