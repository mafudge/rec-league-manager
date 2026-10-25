from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_organizer
from ..db import get_session
from ..errors import ApiError, object_body
from ..models import Entrant, Organizer
from .leagues import NAME_LIMIT, owned_league

ENTRANT_LIMIT = 52  # a round robin of 53 needs 53 weeks, and a league runs at most 52

router = APIRouter(prefix="/api/leagues/{id}/entrants")


def entrant_json(e: Entrant) -> dict[str, str]:
    return {"id": e.id, "name": e.name}


@router.get("")
def list_entrants(id: str, organizer: Organizer = Depends(current_organizer), session: Session = Depends(get_session)):
    owned_league(id, organizer, session)
    rows = session.scalars(select(Entrant).where(Entrant.league_id == id).order_by(Entrant.position))
    return [entrant_json(e) for e in rows]


@router.post("", status_code=201)
def add_entrant(
    id: str,
    body: Any = Body(...),
    organizer: Organizer = Depends(current_organizer),
    session: Session = Depends(get_session),
):
    data = object_body(body)  # the body's shape is checked before the league lookup
    owned_league(id, organizer, session)
    raw = data.get("name")
    name = raw.strip() if isinstance(raw, str) else ""  # a non-string name counts as blank
    if not name:
        raise ApiError(400, "Name is required")
    if len(name) > NAME_LIMIT:
        raise ApiError(400, f"Name must be {NAME_LIMIT} characters or fewer")
    existing = session.scalars(select(Entrant.name).where(Entrant.league_id == id)).all()
    if name.lower() in {n.strip().lower() for n in existing}:
        raise ApiError(409, "An entrant with that name already exists in this league")
    if len(existing) >= ENTRANT_LIMIT:
        raise ApiError(400, f"A league can have at most {ENTRANT_LIMIT} entrants")
    last = session.scalar(select(func.max(Entrant.position)).where(Entrant.league_id == id))
    entrant = Entrant(league_id=id, name=name, position=0 if last is None else last + 1)
    session.add(entrant)
    session.commit()
    return entrant_json(entrant)
