from uuid import uuid4

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


def new_id() -> str:
    """A module-level function (not a lambda) so migrations can serialize it."""
    return uuid4().hex


class League(models.Model):
    id = models.CharField(max_length=32, primary_key=True, default=new_id)
    organizer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="leagues")
    slug = models.CharField(max_length=6, unique=True)
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=200)
    sport = models.CharField(max_length=100, default="", blank=True)
    season = models.CharField(max_length=100, default="", blank=True)
    weeks = models.IntegerField()
    allow_ties = models.BooleanField(default=False)
    # Lists are oldest first, so a league remembers when it was made.
    created_at = models.DateTimeField(default=timezone.now)


class Entrant(models.Model):
    id = models.CharField(max_length=32, primary_key=True, default=new_id)
    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="entrants")
    name = models.CharField(max_length=200)
    position = models.IntegerField()


class Game(models.Model):
    id = models.CharField(max_length=32, primary_key=True, default=new_id)
    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name="games")
    week = models.IntegerField()
    slot = models.IntegerField()
    home = models.ForeignKey(Entrant, on_delete=models.CASCADE, related_name="home_games")
    away = models.ForeignKey(Entrant, on_delete=models.CASCADE, related_name="away_games", null=True)
    home_score = models.IntegerField(null=True)
    away_score = models.IntegerField(null=True)
