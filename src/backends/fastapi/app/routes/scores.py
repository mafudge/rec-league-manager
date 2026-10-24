from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_organizer
from ..db import get_session
from ..errors import ApiError, object_body
from ..models import Entrant, Game, League, Organizer
from ..schedule import game_json

router = APIRouter(prefix="/api/games")


LIMIT = 2**31  # int4, so every backend (Postgres included) agrees on what fits


def whole(v: object) -> int | None:
    """The score as an int, or None if it isn't one. JS backends can't tell 21.0 from 21, so integral floats count."""
    if isinstance(v, bool):
        return None
    if isinstance(v, float):
        v = int(v) if v.is_integer() else None  # NaN and inf are not integers
    if isinstance(v, int) and 0 <= v < LIMIT:
        return v
    return None


@router.put("/{id}/score")
def record_score(
    id: str,
    body: Any = Body(...),
    organizer: Organizer = Depends(current_organizer),
    session: Session = Depends(get_session),
):
    data = object_body(body)  # the body's shape is checked before anything else, as on every route with a body
    # Ownership runs through the game's league, so another organizer's game id is simply "not found".
    game = session.get(Game, id)
    league = session.get(League, game.league_id) if game else None
    if league is None or league.organizer_id != organizer.id:
        raise ApiError(404, "Game not found")
    if game.away_id is None:
        raise ApiError(400, "A bye has no score")
    home, away = whole(data.get("home_score")), whole(data.get("away_score"))
    if home is None or away is None:
        raise ApiError(400, "Scores must be whole numbers 0 or greater")
    if home == away and not league.allow_ties:
        raise ApiError(400, "This league doesn't allow ties")
    game.home_score, game.away_score = home, away
    session.commit()
    names = {e.id: e.name for e in session.scalars(select(Entrant).where(Entrant.league_id == league.id))}
    return game_json(game, names)
