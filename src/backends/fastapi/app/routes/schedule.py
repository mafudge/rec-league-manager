from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..auth import current_organizer
from ..db import get_session
from ..errors import ApiError
from ..models import Entrant, Game, Organizer
from ..schedule import game_json, round_robin
from .leagues import owned_league

router = APIRouter(prefix="/api/leagues/{id}")


@router.post("/schedule", status_code=201)
def generate(id: str, organizer: Organizer = Depends(current_organizer), session: Session = Depends(get_session)):
    league = owned_league(id, organizer, session)
    entrants = session.scalars(select(Entrant).where(Entrant.league_id == id).order_by(Entrant.position)).all()
    if len(entrants) < 2:
        raise ApiError(400, "Add at least 2 entrants first")
    scored = session.scalar(
        select(Game.id).where(Game.league_id == id, Game.home_score.is_not(None)).limit(1)
    )
    if scored is not None:
        raise ApiError(409, "Scores already recorded — clear them first")
    rounds = round_robin([e.id for e in entrants])
    session.execute(delete(Game).where(Game.league_id == id))
    for week, pairs in enumerate(rounds, start=1):
        for slot, (home, away) in enumerate(pairs):
            session.add(Game(league_id=id, week=week, slot=slot, home_id=home, away_id=away))
    message = None
    if league.weeks != len(rounds):
        message = f"This schedule needs {len(rounds)} weeks, so the league now runs {len(rounds)} weeks instead of {league.weeks}."
        league.weeks = len(rounds)
    session.commit()
    return {"weeks": len(rounds), "message": message}


@router.get("/games")
def list_games(id: str, organizer: Organizer = Depends(current_organizer), session: Session = Depends(get_session)):
    owned_league(id, organizer, session)
    names = {e.id: e.name for e in session.scalars(select(Entrant).where(Entrant.league_id == id))}
    rows = session.scalars(select(Game).where(Game.league_id == id).order_by(Game.week, Game.slot))
    return [game_json(g, names) for g in rows]


@router.delete("/scores")
def clear_scores(id: str, organizer: Organizer = Depends(current_organizer), session: Session = Depends(get_session)):
    owned_league(id, organizer, session)
    played = session.scalars(select(Game).where(Game.league_id == id, Game.home_score.is_not(None))).all()
    for g in played:
        g.home_score = g.away_score = None
    session.commit()
    return {"cleared": len(played)}
