from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import hash_password, issue_tokens
from ..db import get_session
from ..errors import ApiError
from ..models import Organizer

router = APIRouter(prefix="/api/auth")


@router.post("/signup", status_code=201)
def signup(body: Any = Body(...), session: Session = Depends(get_session)) -> dict[str, str]:
    # Body is read loosely and validated by hand, in the contract's order.
    data = body if isinstance(body, dict) else {}
    email = data.get("email")
    email = email.strip().lower() if isinstance(email, str) else ""
    password = data.get("password")
    if "@" not in email:
        raise ApiError(400, "Enter a valid email address")
    if not isinstance(password, str) or len(password) < 8:
        raise ApiError(400, "Password must be at least 8 characters")
    if session.scalar(select(Organizer).where(Organizer.email == email)):
        raise ApiError(409, "An account with that email already exists")
    organizer = Organizer(email=email, password_hash=hash_password(password))
    session.add(organizer)
    try:
        session.commit()
    except IntegrityError:
        # Lost a race with a concurrent signup of the same email: the unique constraint decided.
        session.rollback()
        raise ApiError(409, "An account with that email already exists")
    return issue_tokens(organizer.id)
