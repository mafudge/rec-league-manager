"""US13-02: sign-up needs the server's sign-up password (src/README.md, signup row). Mirrors FastAPI's test_signup_password.py."""
import os
from unittest import mock

from django.contrib.auth.models import User

from api.test_auth import SIGNUP_PASSWORD, ApiTestCase

NEW = {"email": "dana@example.com", "password": "cornhole1"}
INCORRECT = (403, {"error": "Sign-up password is incorrect"})
CLOSED = (403, {"error": "Sign-up is closed"})


class SignupPasswordTests(ApiTestCase):
    def signup(self, **body):
        r = self.post("/api/auth/signup", body)
        return r.status_code, r.json()

    def server_password(self, value):
        """Set (or, with None, unset) the server's SIGNUP_PASSWORD for the rest of this test."""
        patcher = mock.patch.dict(os.environ)
        patcher.start()
        self.addCleanup(patcher.stop)
        if value is None:
            del os.environ["SIGNUP_PASSWORD"]
        else:
            os.environ["SIGNUP_PASSWORD"] = value

    def test_right_sign_up_password_creates_the_account(self):  # AC1
        status, body = self.signup(**NEW, signup_password=SIGNUP_PASSWORD)
        self.assertEqual(status, 201)
        self.assertTrue(body["token"] and body["refresh_token"])
        self.assertEqual(self.post("/api/auth/login", NEW).status_code, 200)  # sign-in never asks for it

    def test_wrong_or_non_text_sign_up_password_is_refused(self):  # AC2
        for given in ["wrong", "", SIGNUP_PASSWORD + " ", SIGNUP_PASSWORD.upper(), 5, None, ["x"]]:
            with self.subTest(given=given):
                self.assertEqual(self.signup(**NEW, signup_password=given), INCORRECT)
                self.assertEqual(User.objects.count(), 0)

    def test_missing_sign_up_password_is_refused(self):  # AC2
        self.assertEqual(self.signup(**NEW), INCORRECT)
        self.assertEqual(User.objects.count(), 0)

    def test_wrong_sign_up_password_wins_over_duplicate_email(self):  # AC3: no probing for accounts
        self.signup(**NEW, signup_password=SIGNUP_PASSWORD)
        self.assertEqual(self.signup(**NEW, signup_password="wrong"), INCORRECT)

    def test_wrong_sign_up_password_wins_over_bad_email_and_password(self):  # AC3
        self.assertEqual(self.signup(email="nope", password="x", signup_password="wrong"), INCORRECT)

    def test_unset_server_sign_up_password_means_sign_up_is_closed(self):  # AC4
        self.server_password(None)
        self.assertEqual(self.signup(**NEW, signup_password=SIGNUP_PASSWORD), CLOSED)
        self.assertEqual(self.signup(**NEW, signup_password=""), CLOSED)
        self.assertEqual(User.objects.count(), 0)

    def test_empty_server_sign_up_password_means_sign_up_is_closed(self):  # AC4
        self.server_password("")
        self.assertEqual(self.signup(**NEW, signup_password=SIGNUP_PASSWORD), CLOSED)
        self.assertEqual(self.signup(**NEW, signup_password=""), CLOSED)
        self.assertEqual(User.objects.count(), 0)

    def test_closed_wins_over_field_checks(self):  # AC4
        self.server_password(None)
        self.assertEqual(self.signup(email="nope", password="x"), CLOSED)

    def test_server_password_is_read_on_every_request(self):
        self.server_password("first-one")
        self.assertEqual(self.signup(**NEW, signup_password=SIGNUP_PASSWORD), INCORRECT)
        status, _ = self.signup(**NEW, signup_password="first-one")
        self.assertEqual(status, 201)

    def test_non_ascii_sign_up_password_works(self):
        self.server_password("café-😀")
        status, _ = self.signup(**NEW, signup_password="café-😀")
        self.assertEqual(status, 201)
