import os
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.pool import StaticPool

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./rec_league.db")


class Base(DeclarativeBase):
    pass


_kwargs: dict = {}
if DATABASE_URL.startswith("sqlite"):
    # FastAPI runs sync routes in a thread pool, so SQLite must allow cross-thread use.
    _kwargs["connect_args"] = {"check_same_thread": False}
    if ":memory:" in DATABASE_URL:
        _kwargs["poolclass"] = StaticPool

engine = create_engine(DATABASE_URL, **_kwargs)


def create_tables() -> None:
    from . import models  # noqa: F401  (registers the tables on Base)

    Base.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
