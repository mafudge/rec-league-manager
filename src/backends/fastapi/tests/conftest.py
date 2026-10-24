import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db import Base, get_session
from app.main import app


@pytest.fixture
def client():
    from app import models  # noqa: F401

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)

    def override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override
    c = TestClient(app)
    c.engine = engine  # tests may inspect rows directly
    yield c
    app.dependency_overrides.clear()
    engine.dispose()


def signed_in(client: TestClient, email: str = "dana@example.com") -> dict[str, str]:
    """Sign up and return auth headers (used from Task 3 on)."""
    r = client.post("/api/auth/signup", json={"email": email, "password": "cornhole1"})
    return {"Authorization": f"Bearer {r.json()['token']}"}
