from datetime import timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from api.errors import ApiError, exception_handler

GOOD = {"email": "dana@example.com", "password": "cornhole1"}
SIGN_IN_REQUIRED = {"error": "Sign in required"}
INVALID = {"error": "Invalid request"}


class ApiTestCase(APITestCase):
    def post(self, path, body=None, **extra):
        return self.client.post(path, body, format="json", **extra)

    def raw_post(self, path, data=None, **extra):
        kwargs = {"data": data} if data is not None else {}
        return self.client.post(path, content_type="application/json", **kwargs, **extra)

    def signed_in(self):
        tokens = self.post("/api/auth/signup", GOOD).json()
        return {"HTTP_AUTHORIZATION": f"Bearer {tokens['token']}"}


class SignupTests(ApiTestCase):
    def test_signup_creates_account_and_returns_tokens(self):
        r = self.post("/api/auth/signup", GOOD)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(set(r.json()), {"token", "refresh_token"})
        self.assertTrue(r.json()["token"] and r.json()["refresh_token"])

    def test_signup_refuses_registered_email(self):
        self.post("/api/auth/signup", GOOD)
        r = self.post("/api/auth/signup", GOOD)
        self.assertEqual((r.status_code, r.json()), (409, {"error": "An account with that email already exists"}))

    def test_signup_email_is_case_and_space_insensitive(self):
        self.post("/api/auth/signup", GOOD)
        r = self.post("/api/auth/signup", {**GOOD, "email": " Dana@Example.com "})
        self.assertEqual((r.status_code, r.json()), (409, {"error": "An account with that email already exists"}))

    def test_signup_refuses_short_password(self):
        r = self.post("/api/auth/signup", {**GOOD, "password": "seven77"})
        self.assertEqual((r.status_code, r.json()), (400, {"error": "Password must be at least 8 characters"}))

    MSG72 = {"error": "Password must be 72 characters or fewer"}
    EMOJI72 = "😀" * 18  # 72 UTF-8 bytes, 18 code points

    def test_signup_refuses_73_ascii_characters(self):
        r = self.post("/api/auth/signup", {**GOOD, "password": "a" * 73})
        self.assertEqual((r.status_code, r.json()), (400, self.MSG72))
        self.assertEqual(self.post("/api/auth/login", {**GOOD, "password": "a" * 73}).status_code, 401)

    def test_signup_accepts_72_ascii_characters_and_login_works(self):
        self.assertEqual(self.post("/api/auth/signup", {**GOOD, "password": "a" * 72}).status_code, 201)
        self.assertEqual(self.post("/api/auth/login", {**GOOD, "password": "a" * 72}).status_code, 200)

    def test_cap_counts_utf8_bytes_so_72_byte_emoji_password_is_exact(self):
        self.assertEqual(self.post("/api/auth/signup", {**GOOD, "password": self.EMOJI72}).status_code, 201)
        self.assertEqual(self.post("/api/auth/login", {**GOOD, "password": self.EMOJI72}).status_code, 200)
        self.assertEqual(self.post("/api/auth/login", {**GOOD, "password": "😀" * 17 + "😁"}).status_code, 401)
        r = self.post("/api/auth/signup", {"email": "b@example.com", "password": self.EMOJI72 + "a"})
        self.assertEqual((r.status_code, r.json()), (400, self.MSG72))

    def test_long_password_is_checked_after_email_and_before_duplicate(self):
        self.post("/api/auth/signup", GOOD)
        r = self.post("/api/auth/signup", {**GOOD, "password": "a" * 73})
        self.assertEqual((r.status_code, r.json()), (400, self.MSG72))
        r = self.post("/api/auth/signup", {"email": "nope", "password": "a" * 73})
        self.assertEqual(r.json(), {"error": "Enter a valid email address"})

    def test_signup_refuses_email_without_at(self):
        r = self.post("/api/auth/signup", {**GOOD, "email": "dana.example.com"})
        self.assertEqual((r.status_code, r.json()), (400, {"error": "Enter a valid email address"}))

    def test_email_message_wins_over_password_message(self):
        r = self.post("/api/auth/signup", {"email": "nope", "password": "x"})
        self.assertEqual(r.json(), {"error": "Enter a valid email address"})

    def test_signup_with_missing_or_non_string_fields_is_400_not_500(self):
        for body in ({}, {"email": 5, "password": "cornhole1"}, {"email": "a@b.c", "password": None}):
            self.assertEqual(self.post("/api/auth/signup", body).status_code, 400)

    def test_only_the_eight_character_rule_applies_not_djangos_validators(self):
        # Django's validators would refuse all of these; FastAPI accepts them, so every backend must.
        for i, pw in enumerate(["cornhole1", "password", "12345678", "dana@example"]):
            r = self.post("/api/auth/signup", {"email": f"p{i}@example.com", "password": pw})
            self.assertEqual(r.status_code, 201, pw)

    def test_non_object_body_is_invalid_request(self):
        for path in ("/api/auth/signup", "/api/auth/login", "/api/auth/refresh"):
            for body in ([], "x", 5, None):
                r = self.post(path, body)
                self.assertEqual((r.status_code, r.json()), (400, INVALID), (path, body))

    def test_broken_or_missing_json_is_invalid_request(self):
        for path in ("/api/auth/signup", "/api/auth/login", "/api/auth/refresh"):
            for r in (self.raw_post(path, "nope"), self.raw_post(path), self.client.post(path)):
                self.assertEqual((r.status_code, r.json()), (400, INVALID), path)

    def test_password_is_stored_hashed_and_email_is_the_username(self):
        self.post("/api/auth/signup", {**GOOD, "email": " Dana@Example.com "})
        user = User.objects.get()
        self.assertEqual((user.username, user.email), ("dana@example.com", "dana@example.com"))
        self.assertNotEqual(user.password, GOOD["password"])
        self.assertTrue(user.check_password(GOOD["password"]))

    def test_trailing_slash_answers_without_redirect(self):
        self.assertEqual(self.post("/api/auth/signup/", GOOD).status_code, 201)
        self.assertEqual(self.post("/api/auth/login/", GOOD).status_code, 200)


class LoginRefreshTests(ApiTestCase):
    def test_login_with_correct_password_returns_tokens(self):
        self.post("/api/auth/signup", GOOD)
        r = self.post("/api/auth/login", GOOD)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.json()), {"token", "refresh_token"})

    def test_login_wrong_password_and_unknown_email_get_the_same_refusal(self):
        self.post("/api/auth/signup", GOOD)
        for body in (
            {**GOOD, "password": "nope-nope"},
            {"email": "who@example.com", "password": "cornhole1"},
            {"email": GOOD["email"]},
        ):
            r = self.post("/api/auth/login", body)
            self.assertEqual((r.status_code, r.json()), (401, {"error": "Email or password is incorrect"}))

    def test_login_email_is_case_insensitive(self):
        self.post("/api/auth/signup", GOOD)
        self.assertEqual(self.post("/api/auth/login", {**GOOD, "email": " DANA@Example.com "}).status_code, 200)

    def test_refresh_returns_a_new_pair(self):
        first = self.post("/api/auth/signup", GOOD).json()
        r = self.post("/api/auth/refresh", {"refresh_token": first["refresh_token"]})
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(set(body), {"token", "refresh_token"})
        me = self.client.get("/api/auth/me", HTTP_AUTHORIZATION=f"Bearer {body['token']}")
        self.assertEqual(me.status_code, 200)

    def test_refresh_refuses_an_access_token_or_garbage(self):
        first = self.post("/api/auth/signup", GOOD).json()
        for bad in (first["token"], "garbage", None, 5):
            r = self.post("/api/auth/refresh", {"refresh_token": bad})
            self.assertEqual((r.status_code, r.json()), (401, SIGN_IN_REQUIRED), bad)
        self.assertEqual(self.post("/api/auth/refresh", {}).status_code, 401)

    def test_refresh_for_a_deleted_organizer_is_refused(self):
        first = self.post("/api/auth/signup", GOOD).json()
        User.objects.all().delete()
        r = self.post("/api/auth/refresh", {"refresh_token": first["refresh_token"]})
        self.assertEqual((r.status_code, r.json()), (401, SIGN_IN_REQUIRED))


class MeTests(ApiTestCase):
    def test_me_returns_the_email_with_a_token(self):
        headers = self.signed_in()
        r = self.client.get("/api/auth/me", **headers)
        self.assertEqual((r.status_code, r.json()), (200, {"email": "dana@example.com"}))
        self.assertEqual(self.client.get("/api/auth/me/", **headers).status_code, 200)

    def test_me_refuses_every_kind_of_bad_token_with_sign_in_required(self):
        self.signed_in()
        user = User.objects.get()
        expired = AccessToken.for_user(user)
        expired.set_exp(from_time=timezone.now() - timedelta(hours=2), lifetime=timedelta(hours=1))
        refresh = str(RefreshToken.for_user(user))
        for headers in (
            {},
            {"HTTP_AUTHORIZATION": "Bearer garbage"},
            {"HTTP_AUTHORIZATION": "garbage"},
            {"HTTP_AUTHORIZATION": f"Bearer {expired}"},
            {"HTTP_AUTHORIZATION": f"Bearer {refresh}"},  # a refresh token is not an access token
        ):
            r = self.client.get("/api/auth/me", **headers)
            self.assertEqual((r.status_code, r.json()), (401, SIGN_IN_REQUIRED), headers)

    def test_token_for_a_deleted_organizer_is_refused(self):
        headers = self.signed_in()
        User.objects.all().delete()
        r = self.client.get("/api/auth/me", **headers)
        self.assertEqual((r.status_code, r.json()), (401, SIGN_IN_REQUIRED))

    def test_wrong_method_is_405_in_the_contract_shape(self):
        r = self.client.get("/api/auth/login")
        self.assertEqual((r.status_code, r.json()), (405, {"error": "Method Not Allowed"}))
        r = self.client.post("/api/auth/me", **self.signed_in())
        self.assertEqual((r.status_code, r.json()), (405, {"error": "Method Not Allowed"}))


class ExceptionHandlerTests(ApiTestCase):
    """Review Focus 1: no DRF exception may leak {"detail": ...}."""

    def answer(self, exc):
        response = exception_handler(exc, {})
        return response.status_code, response.data

    def test_not_authenticated_and_failed_authentication_are_sign_in_required(self):
        self.assertEqual(self.answer(exceptions.NotAuthenticated()), (401, SIGN_IN_REQUIRED))
        self.assertEqual(self.answer(exceptions.AuthenticationFailed("Token is expired")), (401, SIGN_IN_REQUIRED))

    def test_parse_error_is_invalid_request(self):
        self.assertEqual(self.answer(exceptions.ParseError("JSON parse error")), (400, INVALID))

    def test_validation_error_is_invalid_request(self):
        self.assertEqual(self.answer(exceptions.ValidationError({"email": ["Required"]})), (400, INVALID))

    def test_unsupported_media_type_is_invalid_request(self):
        self.assertEqual(self.answer(exceptions.UnsupportedMediaType("text/plain")), (400, INVALID))

    def test_not_found_keeps_the_message_the_view_raised(self):
        self.assertEqual(self.answer(exceptions.NotFound("League not found")), (404, {"error": "League not found"}))

    def test_method_not_allowed(self):
        self.assertEqual(self.answer(exceptions.MethodNotAllowed("GET")), (405, {"error": "Method Not Allowed"}))

    def test_permission_denied_and_throttled_still_use_the_error_key(self):
        status, body = self.answer(exceptions.PermissionDenied())
        self.assertEqual(status, 403)
        self.assertEqual(list(body), ["error"])
        status, body = self.answer(exceptions.Throttled())
        self.assertEqual(status, 429)
        self.assertEqual(list(body), ["error"])

    def test_api_error_carries_its_status_and_message(self):
        self.assertEqual(self.answer(ApiError(409, "Nope")), (409, {"error": "Nope"}))

    def test_non_drf_exceptions_are_left_to_django(self):
        self.assertIsNone(exception_handler(ValueError("boom"), {}))


class StaleTokenOnOpenRoutesTests(ApiTestCase):
    """Routes that need no sign-in ignore the Authorization header, as FastAPI does (a client may send its expired token along)."""

    GARBAGE = {"HTTP_AUTHORIZATION": "Bearer garbage"}

    def test_signup_login_and_refresh_ignore_a_garbage_token(self):
        r = self.post("/api/auth/signup", GOOD, **self.GARBAGE)
        self.assertEqual(r.status_code, 201)
        r = self.post("/api/auth/login", GOOD, **self.GARBAGE)
        self.assertEqual(r.status_code, 200)
        r = self.post("/api/auth/refresh", {"refresh_token": r.json()["refresh_token"]}, **self.GARBAGE)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.json()), {"token", "refresh_token"})

    def test_open_routes_answer_their_own_refusals_not_sign_in_required(self):
        r = self.post("/api/auth/login", {**GOOD, "password": "wrong-password"}, **self.GARBAGE)
        self.assertEqual((r.status_code, r.json()), (401, {"error": "Email or password is incorrect"}))
        r = self.post("/api/auth/signup", {"email": "x", "password": "cornhole1"}, **self.GARBAGE)
        self.assertEqual((r.status_code, r.json()), (400, {"error": "Enter a valid email address"}))

    def test_health_backend_and_hello_ignore_a_garbage_token(self):
        for path, body in (
            ("/api/health", {"status": "ok"}),
            ("/api/backend", {"backend": "django"}),
            ("/api/hello?name=Mike", {"message": "Hello Mike"}),
        ):
            r = self.client.get(path, **self.GARBAGE)
            self.assertEqual((r.status_code, r.json()), (200, body), path)

    def test_me_still_refuses_a_garbage_token(self):
        r = self.client.get("/api/auth/me", **self.GARBAGE)
        self.assertEqual((r.status_code, r.json()), (401, SIGN_IN_REQUIRED))
