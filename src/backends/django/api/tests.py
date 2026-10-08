from django.core.management import get_commands, load_command_class
from django.test import SimpleTestCase
from rest_framework.test import APITestCase


class ContractTests(APITestCase):
    def test_health_returns_ok(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_backend_names_itself(self):
        response = self.client.get("/api/backend")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"backend": "django"})

    def test_answers_the_android_emulator(self):
        # Inside the Android emulator the host machine is 10.0.2.2 (SCAF-11).
        response = self.client.get("/api/backend", HTTP_HOST="10.0.2.2:8001")
        self.assertEqual(response.status_code, 200)

    def test_hello_greets_by_name(self):
        response = self.client.get("/api/hello", {"name": "Mike"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"message": "Hello Mike"})

    def test_hello_keeps_spaces_and_accents_but_trims_the_ends(self):
        self.assertEqual(self.client.get("/api/hello", {"name": " Ada Lovelace "}).json(), {"message": "Hello Ada Lovelace"})
        self.assertEqual(self.client.get("/api/hello", {"name": "José"}).json(), {"message": "Hello José"})

    def test_hello_refuses_a_missing_or_blank_name(self):
        for params in ({}, {"name": ""}, {"name": "   "}):
            response = self.client.get("/api/hello", params)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json(), {"error": "Name is required"})

    def test_trailing_slash_answers_without_redirect(self):
        self.assertEqual(self.client.get("/api/health/").status_code, 200)
        self.assertEqual(self.client.get("/api/backend/").status_code, 200)

    def test_allows_cross_origin_requests(self):
        response = self.client.get("/api/backend", HTTP_ORIGIN="http://localhost:3000")
        self.assertEqual(response["Access-Control-Allow-Origin"], "*")

    def test_answers_a_cors_preflight(self):
        response = self.client.options(
            "/api/backend",
            HTTP_ORIGIN="http://localhost:3000",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Access-Control-Allow-Origin"], "*")


class RunserverTests(SimpleTestCase):
    def test_runserver_defaults_to_port_8001(self):
        # FastAPI has 8000; every backend gets its own port so all four can run at once.
        self.assertEqual(get_commands()["runserver"], "api")
        self.assertEqual(load_command_class("api", "runserver").default_port, "8001")
