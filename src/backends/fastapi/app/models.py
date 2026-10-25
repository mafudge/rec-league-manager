from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def new_id() -> str:
    return uuid4().hex


class Organizer(Base):
    __tablename__ = "organizers"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))


class League(Base):
    __tablename__ = "leagues"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    organizer_id: Mapped[str] = mapped_column(ForeignKey("organizers.id"))
    slug: Mapped[str] = mapped_column(String(6), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(200))
    sport: Mapped[str] = mapped_column(String(100), default="")
    season: Mapped[str] = mapped_column(String(100), default="")
    weeks: Mapped[int] = mapped_column(Integer)
    allow_ties: Mapped[bool] = mapped_column(Boolean, default=False)
    # Lists are oldest first, so a league remembers when it was made.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class Entrant(Base):
    __tablename__ = "entrants"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    league_id: Mapped[str] = mapped_column(ForeignKey("leagues.id"))
    name: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer)


class Game(Base):
    __tablename__ = "games"
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    league_id: Mapped[str] = mapped_column(ForeignKey("leagues.id"))
    week: Mapped[int] = mapped_column(Integer)
    slot: Mapped[int] = mapped_column(Integer)
    home_id: Mapped[str] = mapped_column(ForeignKey("entrants.id"))
    away_id: Mapped[str | None] = mapped_column(ForeignKey("entrants.id"), nullable=True)
    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
