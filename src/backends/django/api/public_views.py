from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response

from .errors import ApiError
from .league_views import league_json
from .models import Entrant, Game, League
from .schedule import game_json
from .standings import is_played, standings_for


def current_week(games: list[Game]) -> int | None:
    """Lowest week with an unplayed non-bye game; the last week once everything is played; None with no games."""
    if not games:
        return None
    open_weeks = [g.week for g in games if g.away_id is not None and not is_played(g)]
    return min(open_weeks) if open_weeks else max(g.week for g in games)


@api_view(["GET"])
@authentication_classes([])  # no token is read at all, so a bad Authorization header is ignored
@permission_classes([])
def public_league(request, slug):
    """Anyone with the link reads the league, schedule and standings. Nothing here writes."""
    league = League.objects.filter(slug=slug).first()
    if league is None:
        raise ApiError(404, "League not found")
    entrants = list(Entrant.objects.filter(league=league).order_by("position"))
    games = list(Game.objects.filter(league=league).order_by("week", "slot"))
    names = {e.id: e.name for e in entrants}
    public = {k: v for k, v in league_json(league).items() if k != "id"}  # the database id stays private
    return Response(
        {
            "league": public,
            "current_week": current_week(games),
            "games": [game_json(g, names) for g in games],
            "standings": standings_for(entrants, games),
        }
    )
