"""Standings helpers; Task 4 adds compute_standings here."""


def is_played(game) -> bool:
    """A played game is a non-bye game with both scores; works on the model rows and plain objects alike."""
    return game.away_id is not None and game.home_score is not None and game.away_score is not None


def played_count(games) -> int:
    return sum(1 for g in games if is_played(g))
