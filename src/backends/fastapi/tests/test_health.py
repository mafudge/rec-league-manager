from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_backend_names_itself():
    response = client.get("/api/backend")
    assert response.status_code == 200
    assert response.json() == {"backend": "fastapi"}


def test_allows_cross_origin_requests():
    response = client.get("/api/backend", headers={"Origin": "http://localhost:3000"})
    assert response.headers["access-control-allow-origin"] == "*"


def test_answers_a_cors_preflight():
    response = client.options(
        "/api/backend",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"


def test_hello_greets_by_name():
    response = client.get("/api/hello", params={"name": "Mike"})
    assert response.status_code == 200
    assert response.json() == {"message": "Hello Mike"}


def test_hello_keeps_spaces_and_accents_but_trims_the_ends():
    assert client.get("/api/hello", params={"name": " Ada Lovelace "}).json() == {"message": "Hello Ada Lovelace"}
    assert client.get("/api/hello", params={"name": "José"}).json() == {"message": "Hello José"}


def test_hello_refuses_a_missing_or_blank_name():
    for params in ({}, {"name": ""}, {"name": "   "}):
        response = client.get("/api/hello", params=params)
        assert response.status_code == 400
        assert response.json() == {"error": "Name is required"}
