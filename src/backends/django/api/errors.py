import json

from rest_framework import exceptions, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response


class ApiError(APIException):
    """A refusal with the contract's one shape: {"error": message} and a 4xx status."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


TEXT_FIELDS = ("email", "password", "name", "location", "sport", "season")


def has_bad_text(value) -> bool:
    """True for a string holding U+0000 or an unpaired surrogate (Python reads a lone \\ud800 as a code point in U+D800-U+DFFF)."""
    return isinstance(value, str) and any(ch == "\0" or "\ud800" <= ch <= "\udfff" for ch in value)


def object_body(request) -> dict:
    """The parsed JSON body, which must be an object; anything else is the contract's 400 Invalid request.

    Read from the raw body rather than request.data: DRF turns an empty body into {}, but the contract
    says a missing body is as invalid as a broken one.
    """
    try:
        data = json.loads(request.body)
    except ValueError:  # includes JSONDecodeError and UnicodeDecodeError
        raise ApiError(400, "Invalid request")
    if not isinstance(data, dict) or any(has_bad_text(data.get(f)) for f in TEXT_FIELDS):
        raise ApiError(400, "Invalid request")  # NUL or a lone surrogate is refused with the body rule, before field validation
    return data


def exception_handler(exc, context):
    """Every DRF exception answers in the contract's shape, {"error": message}, never DRF's {"detail": ...}.

    Anything that isn't a DRF exception returns None, so Django handles it (a real bug is a 500, not a lie).
    """
    if isinstance(exc, ApiError):
        status_code, message = exc.status_code, exc.message
    elif isinstance(exc, (exceptions.NotAuthenticated, exceptions.AuthenticationFailed)):
        # Includes simplejwt's InvalidToken/TokenError, whose own body would leak {"detail", "code"}.
        status_code, message = status.HTTP_401_UNAUTHORIZED, "Sign in required"
    elif isinstance(exc, (exceptions.ParseError, exceptions.ValidationError, exceptions.UnsupportedMediaType)):
        status_code, message = status.HTTP_400_BAD_REQUEST, "Invalid request"
    elif isinstance(exc, exceptions.NotFound):
        status_code, message = status.HTTP_404_NOT_FOUND, str(exc.detail)
    elif isinstance(exc, exceptions.MethodNotAllowed):
        status_code, message = status.HTTP_405_METHOD_NOT_ALLOWED, "Method Not Allowed"
    elif isinstance(exc, exceptions.APIException):
        status_code, message = exc.status_code, str(exc.detail)
    else:
        return None
    return Response({"error": message}, status=status_code)
