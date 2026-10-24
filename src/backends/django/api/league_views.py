from typing import Any

from django.db import IntegrityError, transaction
from django.db.models import Max
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .errors import ApiError, object_body
from .models import Entrant, Game, League
from .slugs import new_slug
from .standings import standings_for

NAME_LIMIT = 100
WEEKS_MAX = 52
ENTRANT_LIMIT = 52  # a round robin of 53 needs 53 weeks, and a league runs at most 52


def league_json(league: League) -> dict[str, Any]:
    return {
        "id": league.id,
        "slug": league.slug,
        "name": league.name,
        "location": league.location,
        "sport": league.sport,
        "season": league.season,
        "weeks": league.weeks,
        "allow_ties": league.allow_ties,
    }


def entrant_json(e: Entrant) -> dict[str, str]:
    return {"id": e.id, "name": e.name}


def owned_league(request, league_id: str) -> League:
    """The league if it is this organizer's; unknown and someone else's look the same (404)."""
    league = League.objects.filter(pk=league_id, organizer=request.user).first()
    if league is None:
        raise ApiError(404, "League not found")
    return league


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def leagues(request):
    if request.method == "GET":
        rows = League.objects.filter(organizer=request.user).order_by("created_at", "id")
        return Response([league_json(l) for l in rows])
    # Read loosely, validate by hand in the contract's order.
    data = object_body(request)
    name, location = _text(data.get("name")), _text(data.get("location"))
    weeks = data.get("weeks")
    allow_ties = data.get("allow_ties", False)
    if not name:
        raise ApiError(400, "Name is required")
    if len(name) > NAME_LIMIT:
        raise ApiError(400, f"Name must be {NAME_LIMIT} characters or fewer")
    if not location:
        raise ApiError(400, "Location is required")
    # An integral float such as 3.0 counts as 3: the JS backends can't tell them apart (as for scores).
    if type(weeks) is float and weeks.is_integer():
        weeks = int(weeks)
    # bool is an int subclass, so check the exact type.
    if type(weeks) is not int or weeks < 1:
        raise ApiError(400, "Weeks must be at least 1")
    if weeks > WEEKS_MAX:
        raise ApiError(400, f"Weeks must be between 1 and {WEEKS_MAX}")
    if not isinstance(allow_ties, bool):
        raise ApiError(400, "Invalid request")
    for _ in range(5):  # a lost race on the unique slug just draws another
        try:
            with transaction.atomic():
                league = League.objects.create(
                    organizer=request.user,
                    slug=new_slug(lambda s: League.objects.filter(slug=s).exists()),
                    name=name,
                    location=location,
                    sport=_text(data.get("sport")),
                    season=_text(data.get("season")),
                    weeks=weeks,
                    allow_ties=allow_ties,
                )
        except IntegrityError:
            continue
        return Response(league_json(league), status=201)
    raise ApiError(409, "Could not create the league, try again")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def league_detail(request, league_id):
    return Response(league_json(owned_league(request, league_id)))


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def entrants(request, league_id):
    if request.method == "GET":
        owned_league(request, league_id)
        return Response([entrant_json(e) for e in Entrant.objects.filter(league_id=league_id).order_by("position")])
    data = object_body(request)  # the body's shape is checked before the league lookup
    owned_league(request, league_id)
    name = _text(data.get("name"))  # a non-string name counts as blank
    if not name:
        raise ApiError(400, "Name is required")
    if len(name) > NAME_LIMIT:
        raise ApiError(400, f"Name must be {NAME_LIMIT} characters or fewer")
    existing = list(Entrant.objects.filter(league_id=league_id).values_list("name", flat=True))
    if name.lower() in {n.strip().lower() for n in existing}:
        raise ApiError(409, "An entrant with that name already exists in this league")
    if len(existing) >= ENTRANT_LIMIT:
        raise ApiError(400, f"A league can have at most {ENTRANT_LIMIT} entrants")
    last = Entrant.objects.filter(league_id=league_id).aggregate(m=Max("position"))["m"]
    entrant = Entrant.objects.create(league_id=league_id, name=name, position=0 if last is None else last + 1)
    return Response(entrant_json(entrant), status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def standings(request, league_id):
    """Computed from the games on every request; nothing stores standings (PRD §5)."""
    owned_league(request, league_id)
    entrants = Entrant.objects.filter(league_id=league_id).order_by("position")
    games = Game.objects.filter(league_id=league_id).order_by("week", "slot")
    return Response(standings_for(list(entrants), list(games)))
