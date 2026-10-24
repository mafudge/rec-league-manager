import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

ACCESS_LIFETIME = timedelta(hours=1)
REFRESH_LIFETIME = timedelta(days=30)


def _secret() -> str:
    return os.environ.get("JWT_SECRET", "dev-only-secret")


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt()).decode()


def check_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode()[:72], hashed.encode())
    except ValueError:
        return False


def _make(organizer_id: str, type: str, lifetime: timedelta) -> str:
    claims = {"sub": organizer_id, "type": type, "exp": datetime.now(timezone.utc) + lifetime}
    return jwt.encode(claims, _secret(), algorithm="HS256")


def issue_tokens(organizer_id: str) -> dict[str, str]:
    return {
        "token": _make(organizer_id, "access", ACCESS_LIFETIME),
        "refresh_token": _make(organizer_id, "refresh", REFRESH_LIFETIME),
    }


def read_token(token: str, type: str) -> str | None:
    """The organizer id inside a valid, unexpired token of this type, else None."""
    try:
        claims = jwt.decode(token, _secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    sub = claims.get("sub")
    if claims.get("type") != type or not isinstance(sub, str):
        return None
    return sub
