from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    """A refusal with the contract's one shape: {"error": message} and a 4xx status."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


TEXT_FIELDS = ("email", "password", "name", "location", "sport", "season")


def has_bad_text(value: object) -> bool:
    """True for a string holding U+0000 or an unpaired surrogate (Python reads a lone \\ud800 as a code point in U+D800-U+DFFF)."""
    return isinstance(value, str) and any(ch == "\0" or "\ud800" <= ch <= "\udfff" for ch in value)


def object_body(body: object) -> dict:
    """The parsed JSON body, which must be an object; anything else is the contract's 400 Invalid request.

    A text field holding U+0000 or an unpaired surrogate is refused the same way, here, so it comes before
    field validation and before any lookup (no backend can store it, and a password can't be hashed).
    """
    if not isinstance(body, dict) or any(has_bad_text(body.get(f)) for f in TEXT_FIELDS):
        raise ApiError(400, "Invalid request")
    return body


def register_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse({"error": exc.message}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, __: RequestValidationError) -> JSONResponse:
        return JSONResponse({"error": "Invalid request"}, status_code=400)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse({"error": str(exc.detail)}, status_code=exc.status_code)
