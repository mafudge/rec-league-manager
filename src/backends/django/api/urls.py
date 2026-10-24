from django.urls import re_path

from . import auth_views, views

# The contract has no trailing slash (ADR 003); accept one too, without a redirect.
urlpatterns = [
    re_path(r"^health/?$", views.health),
    re_path(r"^backend/?$", views.backend),
    re_path(r"^hello/?$", views.hello),
    re_path(r"^auth/signup/?$", auth_views.signup),
    re_path(r"^auth/login/?$", auth_views.login),
    re_path(r"^auth/refresh/?$", auth_views.refresh),
    re_path(r"^auth/me/?$", auth_views.me),
]
