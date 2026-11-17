import hmac
import os
from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import check_password, current_organizer, hash_password, issue_tokens, read_token
from ..db import get_session
from ..errors import ApiError, object_body
from ..models import Organizer

router = APIRouter(prefix="/api/auth")


def check_signup_password(given: object) -> None:
    """US13-02: sign-up needs the server's SIGNUP_PASSWORD; none set means sign-up is closed.

    Read on every request (not at import) so a changed setting applies without a code change, and
    checked before the email and duplicate checks so a stranger can't learn which emails have accounts.
    """
    expected = os.environ.get("SIGNUP_PASSWORD", "")
    if not expected:
        raise ApiError(403, "Sign-up is closed")
    if not isinstance(given, str) or not hmac.compare_digest(given.encode(), expected.encode()):
        raise ApiError(403, "Sign-up password is incorrect")


@router.post("/signup", status_code=201)
def signup(body: Any = Body(...), session: Session = Depends(get_session)) -> dict[str, str]:
    # Body is read loosely and validated by hand, in the contract's order.
    data = object_body(body)
    check_signup_password(data.get("signup_password"))
    email = data.get("email")
    email = email.strip().lower() if isinstance(email, str) else ""
    password = data.get("password")
    if "@" not in email:
        raise ApiError(400, "Enter a valid email address")
    if not isinstance(password, str) or len(password) < 8:
        raise ApiError(400, "Password must be at least 8 characters")
    if len(password.encode()) > 72:  # bcrypt and GoTrue both limit bytes, not characters
        raise ApiError(400, "Password must be 72 characters or fewer")
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


@router.post("/login")
def login(body: Any = Body(...), session: Session = Depends(get_session)) -> dict[str, str]:
    data = object_body(body)
    email = data.get("email")
    email = email.strip().lower() if isinstance(email, str) else ""
    password = data.get("password")
    organizer = session.scalar(select(Organizer).where(Organizer.email == email))
    # One refusal for unknown email and wrong/missing password, so the form can't be used to find accounts.
    if organizer is None or not isinstance(password, str) or not check_password(password, organizer.password_hash):
        raise ApiError(401, "Email or password is incorrect")
    return issue_tokens(organizer.id)


@router.post("/refresh")
def refresh(body: Any = Body(...), session: Session = Depends(get_session)) -> dict[str, str]:
    data = object_body(body)
    token = data.get("refresh_token")
    organizer_id = read_token(token, "refresh") if isinstance(token, str) else None
    if organizer_id is None or session.get(Organizer, organizer_id) is None:
        raise ApiError(401, "Sign in required")
    return issue_tokens(organizer_id)


@router.get("/me")
def me(organizer: Organizer = Depends(current_organizer)) -> dict[str, str]:
    return {"email": organizer.email}
