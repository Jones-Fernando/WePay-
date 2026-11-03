import hashlib

import pytest
from io import BytesIO

from app import app
from database.connection import cursor_for, get_connection_context, initialize_database
from utils.password_utils import hash_password


@pytest.fixture()
def client():
    app.config.update(TESTING=True)
    return app.test_client()


def cadastrar_confirmar(client, nome, email, senha="123456"):
    cadastro = client.post(
        "/api/auth/cadastro",
        json={"nome": nome, "email": email, "senha": senha},
    )
    assert cadastro.status_code == 201
    token = cadastro.get_json()["data"]["token_teste"]
    confirmacao = client.post(
        "/api/auth/confirmar-email", json={"token": token}
    )
    assert confirmacao.status_code == 200
    return token


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
    cadastro = response.get_json()
    token_confirmacao = cadastro["data"]["token_teste"]
    assert cadastro["data"]["email_enviado"] is False
    pendente = client.post(
        "/api/auth/login", json={"email": email, "senha": "123456"}
    )
    assert pendente.status_code == 403
    assert "Confirme seu e-mail" in pendente.get_json()["message"]

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT token_hash FROM email_verification_tokens "
                "WHERE usuario_id = (SELECT id FROM usuarios WHERE email = ?)",
                (email,),
            )
            token_persistido = cursor.fetchone()["token_hash"]
        finally:
            cursor.close()
    assert token_persistido != token_confirmacao
    assert len(token_persistido) == 64
    assert token_persistido == hashlib.sha256(
        token_confirmacao.encode("utf-8")
    ).hexdigest()

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT delivery_status FROM email_verification_tokens "
                "WHERE token_hash = ?",
                (token_persistido,),
            )
            assert cursor.fetchone()["delivery_status"] == "failed"
        finally:
            cursor.close()

    assert client.post(
        "/api/auth/confirmar-email", json={"token": token_confirmacao}
    ).status_code == 200
    response = client.post("/api/auth/login", json={"email": email, "senha": "123456"})
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["token"]
    assert data["refresh_token"]


def test_authenticated_request_after_login(client):
    email = "protected-route@example.com"
    cadastrar_confirmar(client, "Protected Route", email)
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
    cadastrar_confirmar(client, "Profile Test", email)
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


def test_accept_group_invitation(client, monkeypatch):
    emails_enviados = []
    monkeypatch.setattr(
        "controllers.participante_controller.EmailService.enviar_convite",
        lambda email, grupo, token: emails_enviados.append((email, grupo, token))
        or True,
    )
    owner_email = "invite-owner@example.com"
    guest_email = "invite-guest@example.com"
    cadastrar_confirmar(client, "Owner", owner_email)
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
    assert convite.get_json()["data"]["email_enviado"] is True
    assert "Convite enviado" in convite.get_json()["message"]
    assert len(emails_enviados) == 1
    assert emails_enviados[0][:2] == (guest_email, "Grupo Convite")
    token_convite = convite.get_json()["data"]["token_teste"]

    cadastrar_confirmar(client, "Guest", guest_email)
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
    cadastrar_confirmar(client, "Reset Test", email)
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
    cadastrar_confirmar(client, "Receipt Test", email)
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


def test_email_confirmation_rejects_invalid_expired_and_used_tokens(client):
    invalid = client.post(
        "/api/auth/confirmar-email", json={"token": "token-invalido"}
    )
    assert invalid.status_code == 400

    expired_email = "expired-confirmation@example.com"
    expired_token = client.post(
        "/api/auth/cadastro",
        json={"nome": "Expired", "email": expired_email, "senha": "123456"},
    ).get_json()["data"]["token_teste"]
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE email_verification_tokens SET expires_at = "
                "DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) "
                "WHERE token_hash = SHA2(?, 256)",
                (expired_token,),
            )
            connection.commit()
        finally:
            cursor.close()
    assert client.post(
        "/api/auth/confirmar-email", json={"token": expired_token}
    ).status_code == 400

    used_token = cadastrar_confirmar(
        client, "Single Use", "single-use-confirmation@example.com"
    )
    assert client.post(
        "/api/auth/confirmar-email", json={"token": used_token}
    ).status_code == 400


def test_resend_confirmation_response_does_not_reveal_account_existence(client):
    existing = client.post(
        "/api/auth/reenviar-confirmacao",
        json={"email": "not-registered@example.com"},
    )
    pending = client.post(
        "/api/auth/cadastro",
        json={
            "nome": "Pending",
            "email": "pending-resend@example.com",
            "senha": "123456",
        },
    )
    assert pending.status_code == 201
    token_anterior = pending.get_json()["data"]["token_teste"]
    resend = client.post(
        "/api/auth/reenviar-confirmacao",
        json={"email": "pending-resend@example.com"},
    )

    assert existing.status_code == resend.status_code == 200
    assert existing.get_json()["message"] == resend.get_json()["message"]
    assert client.post(
        "/api/auth/confirmar-email", json={"token": token_anterior}
    ).status_code == 200


def test_legacy_user_without_verification_token_can_login(client):
    email = "legacy-account@example.com"
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "INSERT INTO usuarios "
                "(nome, email, senha, email_verificado) VALUES (?, ?, ?, 0)",
                ("Conta antiga", email, hash_password("123456")),
            )
            connection.commit()
        finally:
            cursor.close()

    initialize_database()

    response = client.post(
        "/api/auth/login", json={"email": email, "senha": "123456"}
    )
    assert response.status_code == 200
