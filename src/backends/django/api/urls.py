from django.urls import re_path

from . import views

# The contract has no trailing slash (ADR 003); accept one too, without a redirect.
urlpatterns = [
    re_path(r"^health/?$", views.health),
    re_path(r"^backend/?$", views.backend),
]
