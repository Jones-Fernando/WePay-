import pytest

from app import app


@pytest.fixture()
def client():
    app.config.update(TESTING=True)
    return app.test_client()


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.get_json()["projeto"] == "wepay"


def test_auth_required(client):
    response = client.get("/api/grupos")
    assert response.status_code == 401


def test_signup_and_login(client):
    email = "api-test@example.com"
    response = client.post("/api/auth/cadastro", json={"nome": "API Test", "email": email, "senha": "123456"})
    assert response.status_code == 201
    response = client.post("/api/auth/login", json={"email": email, "senha": "123456"})
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["token"]
    assert data["refresh_token"]


def test_authenticated_request_after_login(client):
    email = "protected-route@example.com"
    assert client.post(
        "/api/auth/cadastro",
        json={"nome": "Protected Route", "email": email, "senha": "123456"},
    ).status_code == 201
    login = client.post(
        "/api/auth/login", json={"email": email, "senha": "123456"}
    )
    token = login.get_json()["data"]["token"]

    response = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["email"] == email


def test_duplicate_signup_returns_conflict(client):
    payload = {"nome": "Dup", "email": "dup@example.com", "senha": "123456"}
    assert client.post("/api/auth/cadastro", json=payload).status_code == 201
    assert client.post("/api/auth/cadastro", json=payload).status_code == 409
