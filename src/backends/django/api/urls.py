from django.urls import re_path

from . import auth_views, league_views, public_views, schedule_views, views

# The contract has no trailing slash (ADR 003); accept one too, without a redirect.
urlpatterns = [
    re_path(r"^health/?$", views.health),
    re_path(r"^backend/?$", views.backend),
    re_path(r"^hello/?$", views.hello),
    re_path(r"^auth/signup/?$", auth_views.signup),
    re_path(r"^auth/login/?$", auth_views.login),
    re_path(r"^auth/refresh/?$", auth_views.refresh),
    re_path(r"^auth/me/?$", auth_views.me),
    re_path(r"^leagues/?$", league_views.leagues),
    re_path(r"^leagues/(?P<league_id>[^/]+)/?$", league_views.league_detail),
    re_path(r"^leagues/(?P<league_id>[^/]+)/entrants/?$", league_views.entrants),
    re_path(r"^leagues/(?P<league_id>[^/]+)/schedule/?$", schedule_views.generate),
    re_path(r"^leagues/(?P<league_id>[^/]+)/games/?$", schedule_views.games),
    re_path(r"^leagues/(?P<league_id>[^/]+)/scores/?$", schedule_views.clear_scores),
    re_path(r"^leagues/(?P<league_id>[^/]+)/standings/?$", league_views.standings),
    re_path(r"^public/(?P<slug>[^/]+)/?$", public_views.public_league),
    re_path(r"^games/(?P<game_id>[^/]+)/score/?$", schedule_views.record_score),
    re_path(r"^.*$", views.not_found),  # last: any other /api/ path is the contract's JSON 404, even with DEBUG on
]
