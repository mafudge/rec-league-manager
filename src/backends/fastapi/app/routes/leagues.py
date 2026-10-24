from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import current_organizer
from ..db import get_session
from ..errors import ApiError, object_body
from ..models import League, Organizer
from ..slugs import new_slug

router = APIRouter(prefix="/api/leagues")

NAME_LIMIT = 100
WEEKS_MAX = 52


def league_json(l: League) -> dict[str, Any]:
    return {
        "id": l.id,
        "slug": l.slug,
        "name": l.name,
        "location": l.location,
        "sport": l.sport,
        "season": l.season,
        "weeks": l.weeks,
        "allow_ties": l.allow_ties,
    }


def owned_league(id: str, organizer: Organizer, session: Session) -> League:
    """The league if it is this organizer's; unknown and someone else's look the same (404)."""
    league = session.get(League, id)
    if league is None or league.organizer_id != organizer.id:
        raise ApiError(404, "League not found")
    return league


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


@router.get("")
def list_leagues(organizer: Organizer = Depends(current_organizer), session: Session = Depends(get_session)):
    rows = session.scalars(
        select(League).where(League.organizer_id == organizer.id).order_by(League.created_at, League.id)
    )
    return [league_json(l) for l in rows]


@router.post("", status_code=201)
def create_league(
    body: Any = Body(...),
    organizer: Organizer = Depends(current_organizer),
    session: Session = Depends(get_session),
):
    # Read loosely, validate by hand in the contract's order.
    data = object_body(body)
    name, location = _text(data.get("name")), _text(data.get("location"))
    weeks = data.get("weeks")
    allow_ties = data.get("allow_ties", False)
    if not name:
        raise ApiError(400, "Name is required")
    if len(name) > NAME_LIMIT:
        raise ApiError(400, f"Name must be {NAME_LIMIT} characters or fewer")
    if not location:
        raise ApiError(400, "Location is required")
    # bool is an int subclass, so check the exact type.
    if type(weeks) is not int or weeks < 1:
        raise ApiError(400, "Weeks must be at least 1")
    if weeks > WEEKS_MAX:
        raise ApiError(400, f"Weeks must be between 1 and {WEEKS_MAX}")
    if not isinstance(allow_ties, bool):
        raise ApiError(400, "Invalid request")
    taken = lambda s: session.scalar(select(League.id).where(League.slug == s)) is not None  # noqa: E731
    for _ in range(5):  # a lost race on the unique slug just draws another
        league = League(
            organizer_id=organizer.id,
            slug=new_slug(taken),
            name=name,
            location=location,
            sport=_text(data.get("sport")),
            season=_text(data.get("season")),
            weeks=weeks,
            allow_ties=allow_ties,
        )
        session.add(league)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
            continue
        return league_json(league)
    raise ApiError(409, "Could not create the league, try again")


@router.get("/{id}")
def get_league(id: str, organizer: Organizer = Depends(current_organizer), session: Session = Depends(get_session)):
    return league_json(owned_league(id, organizer, session))
