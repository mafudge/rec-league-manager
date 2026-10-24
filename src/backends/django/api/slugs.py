import secrets
from collections.abc import Callable

ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no i, l, o, 0, 1: easy to read aloud and type
LENGTH = 6


def new_slug(taken: Callable[[str], bool]) -> str:
    """A random public-link slug that `taken` says is not in use yet."""
    while True:
        slug = "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))
        if not taken(slug):
            return slug
