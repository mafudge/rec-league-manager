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
