from django.db import transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .errors import ApiError, object_body
from .league_views import owned_league
from .models import Entrant, Game, League
from .schedule import game_json, round_robin

LIMIT = 2**31  # int4, so every backend (Postgres included) agrees on what fits


def whole(v: object) -> int | None:
    """The score as an int, or None if it isn't one. JS backends can't tell 21.0 from 21, so integral floats count."""
    if isinstance(v, bool):  # DRF's JSON parser gives a real bool; it is an int subclass, so refuse it first
        return None
    if isinstance(v, float):
        v = int(v) if v.is_integer() else None  # NaN and inf are not integers
    if isinstance(v, int) and 0 <= v < LIMIT:
        return v
    return None


def names_of(league_id: str) -> dict[str, str]:
    return dict(Entrant.objects.filter(league_id=league_id).values_list("id", "name"))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generate(request, league_id):
    league = owned_league(request, league_id)
    entrants = list(Entrant.objects.filter(league_id=league_id).order_by("position"))
    if len(entrants) < 2:
        raise ApiError(400, "Add at least 2 entrants first")
    if Game.objects.filter(league_id=league_id, home_score__isnull=False).exists():
        raise ApiError(409, "Scores already recorded — clear them first")
    rounds = round_robin([e.id for e in entrants])
    message = None
    with transaction.atomic():
        Game.objects.filter(league_id=league_id).delete()
        Game.objects.bulk_create(
            Game(league_id=league_id, week=week, slot=slot, home_id=home, away_id=away)
            for week, pairs in enumerate(rounds, start=1)
            for slot, (home, away) in enumerate(pairs)
        )
        if league.weeks != len(rounds):
            n = len(rounds)
            unit = "week" if n == 1 else "weeks"
            message = f"This schedule needs {n} {unit}, so the league now runs {n} {unit} instead of {league.weeks}."
            league.weeks = n
            league.save(update_fields=["weeks"])
    return Response({"weeks": len(rounds), "message": message}, status=201)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def games(request, league_id):
    owned_league(request, league_id)
    names = names_of(league_id)
    return Response([game_json(g, names) for g in Game.objects.filter(league_id=league_id).order_by("week", "slot")])


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def clear_scores(request, league_id):
    owned_league(request, league_id)
    cleared = Game.objects.filter(league_id=league_id, home_score__isnull=False).update(home_score=None, away_score=None)
    return Response({"cleared": cleared})


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def record_score(request, game_id):
    data = object_body(request)  # the body's shape is checked before anything else, as on every route with a body
    # Ownership runs through the game's league, so another organizer's game id is simply "not found".
    game = Game.objects.filter(pk=game_id, league__organizer=request.user).select_related("league").first()
    if game is None:
        raise ApiError(404, "Game not found")
    if game.away_id is None:
        raise ApiError(400, "A bye has no score")
    league: League = game.league
    if data.get("home_score") is None and data.get("away_score") is None:
        # Both null (or both absent) clears the game; one null beside a number falls through to the whole-numbers refusal.
        game.home_score = game.away_score = None
    else:
        home, away = whole(data.get("home_score")), whole(data.get("away_score"))
        if home is None or away is None:
            raise ApiError(400, "Scores must be whole numbers 0 or greater")
        if home == away and not league.allow_ties:
            raise ApiError(400, "This league doesn't allow ties")
        game.home_score, game.away_score = home, away
    game.save(update_fields=["home_score", "away_score"])
    return Response(game_json(game, names_of(league.id)))
