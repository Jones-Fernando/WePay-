import pytest
from io import BytesIO

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


def test_update_profile_and_password(client):
    email = "profile-test@example.com"
    assert client.post(
        "/api/auth/cadastro",
        json={"nome": "Profile Test", "email": email, "senha": "123456"},
    ).status_code == 201
    login = client.post("/api/auth/login", json={"email": email, "senha": "123456"})
    token = login.get_json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.put(
        "/api/auth/atualizar",
        json={"nome": "Nome Atualizado", "email": email, "telefone": "11999999999"},
        headers=headers,
    ).status_code == 200
    assert client.put(
        "/api/auth/alterar-senha",
        json={"senha_atual": "123456", "nova_senha": "654321"},
        headers=headers,
    ).status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "senha": "654321"}).status_code == 200


def test_accept_group_invitation(client):
    owner_email = "invite-owner@example.com"
    guest_email = "invite-guest@example.com"
    assert client.post(
        "/api/auth/cadastro",
        json={"nome": "Owner", "email": owner_email, "senha": "123456"},
    ).status_code == 201
    owner_token = client.post(
        "/api/auth/login", json={"email": owner_email, "senha": "123456"}
    ).get_json()["data"]["token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    grupo = client.post(
        "/api/grupos", json={"nome": "Grupo Convite"}, headers=owner_headers
    )
    assert grupo.status_code == 201
    grupo_id = grupo.get_json()["data"]["id"]

    convite = client.post(
        "/api/participantes/convite",
        json={"grupo_id": grupo_id, "email": guest_email},
        headers=owner_headers,
    )
    assert convite.status_code == 201
    token_convite = convite.get_json()["data"]["token_teste"]

    assert client.post(
        "/api/auth/cadastro",
        json={"nome": "Guest", "email": guest_email, "senha": "123456"},
    ).status_code == 201
    guest_token = client.post(
        "/api/auth/login", json={"email": guest_email, "senha": "123456"}
    ).get_json()["data"]["token"]
    aceitar = client.post(
        "/api/participantes/convite/aceitar",
        json={"token": token_convite},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert aceitar.status_code == 200
    membros = client.get(
        f"/api/participantes/grupo/{grupo_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert membros.status_code == 200
    assert any(item["email"] == guest_email for item in membros.get_json()["data"])


def test_password_reset_token_is_single_use(client):
    email = "reset-test@example.com"
    assert client.post(
        "/api/auth/cadastro",
        json={"nome": "Reset Test", "email": email, "senha": "123456"},
    ).status_code == 201
    solicitacao = client.post("/api/auth/esqueci-senha", json={"email": email})
    assert solicitacao.status_code == 200
    token = solicitacao.get_json()["data"]["token_teste"]

    resposta = client.post(
        "/api/auth/redefinir-senha",
        json={"token": token, "nova_senha": "654321"},
    )
    assert resposta.status_code == 200
    assert client.post(
        "/api/auth/login", json={"email": email, "senha": "654321"}
    ).status_code == 200
    assert client.post(
        "/api/auth/redefinir-senha",
        json={"token": token, "nova_senha": "abcdef"},
    ).status_code == 400


def test_receipt_reader_normalizes_ai_response(client, monkeypatch):
    email = "receipt-test@example.com"
    assert client.post(
        "/api/auth/cadastro",
        json={"nome": "Receipt Test", "email": email, "senha": "123456"},
    ).status_code == 201
    token = client.post(
        "/api/auth/login", json={"email": email, "senha": "123456"}
    ).get_json()["data"]["token"]
    monkeypatch.setattr(
        "routes.recibo_routes.ler_recibo",
        lambda *_: {
            "estabelecimento": " Mercado Central ",
            "data": "2026-10-25",
            "valor_total": "1.234,56",
            "categoria_sugerida": "Inexistente",
        },
    )
    resposta = client.post(
        "/api/recibos/ler",
        data={"imagem": (BytesIO(b"imagem"), "recibo.jpg", "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
        content_type="multipart/form-data",
    )
    assert resposta.status_code == 200
    dados = resposta.get_json()["data"]
    assert dados == {
        "estabelecimento": "Mercado Central",
        "data": "2026-10-25",
        "valor_total": 1234.56,
        "moeda": "BRL",
        "categoria_sugerida": "Outros",
    }
