from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken

from .errors import ApiError, object_body

TAKEN = "An account with that email already exists"


def issue_tokens(user: User) -> dict[str, str]:
    """The contract's names, {token, refresh_token}, not simplejwt's {access, refresh}."""
    refresh = RefreshToken.for_user(user)
    return {"token": str(refresh.access_token), "refresh_token": str(refresh)}


def _email(data: dict) -> str:
    email = data.get("email")
    return email.strip().lower() if isinstance(email, str) else ""


@api_view(["POST"])
@authentication_classes([])  # open route: a stale token in the header is ignored, as on FastAPI
@permission_classes([])
def signup(request):
    data = object_body(request)
    email = _email(data)
    password = data.get("password")
    if "@" not in email:
        raise ApiError(400, "Enter a valid email address")
    # Only the 8-character rule: Django's AUTH_PASSWORD_VALIDATORS are deliberately not run, because they
    # refuse passwords the other backends accept.
    if not isinstance(password, str) or len(password) < 8:
        raise ApiError(400, "Password must be at least 8 characters")
    if len(password.encode()) > 72:  # bcrypt and GoTrue both limit bytes, not characters
        raise ApiError(400, "Password must be 72 characters or fewer")
    if User.objects.filter(username=email).exists():
        raise ApiError(409, TAKEN)
    try:
        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password)
    except IntegrityError:
        # Lost a race with a concurrent signup of the same email: the unique constraint decided.
        raise ApiError(409, TAKEN)
    return Response(issue_tokens(user), status=201)


@api_view(["POST"])
@authentication_classes([])  # open route: a stale token in the header is ignored, as on FastAPI
@permission_classes([])
def login(request):
    data = object_body(request)
    password = data.get("password")
    user = User.objects.filter(username=_email(data)).first()
    # One refusal for unknown email and wrong/missing password, so the form can't be used to find accounts.
    if user is None or not isinstance(password, str) or not user.check_password(password):
        raise ApiError(401, "Email or password is incorrect")
    return Response(issue_tokens(user))


@api_view(["POST"])
@authentication_classes([])  # open route: a stale token in the header is ignored, as on FastAPI
@permission_classes([])
def refresh(request):
    data = object_body(request)
    token = data.get("refresh_token")
    if not isinstance(token, str):
        raise ApiError(401, "Sign in required")
    try:
        # RefreshToken refuses an access token (wrong token_type), an expired one and a bad signature.
        user_id = RefreshToken(token)[api_settings.USER_ID_CLAIM]
    except TokenError:
        raise ApiError(401, "Sign in required")
    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None:
        raise ApiError(401, "Sign in required")
    return Response(issue_tokens(user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response({"email": request.user.email})
