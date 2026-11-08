"""Testes de invalidação e rotação de sessões de autenticação."""

import pytest

from app import create_app
from config import Config

app = create_app()


@pytest.fixture()
def client():
    app.config.update(TESTING=True)
    return app.test_client()


def criar_sessao(client, email):
    cadastro = client.post(
        "/api/auth/cadastro",
        json={"nome": "Teste Sessao", "email": email, "senha": "SenhaSegura123!"},
    )
    assert cadastro.status_code == 201

    resposta = client.post(
        "/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"}
    )
    assert resposta.status_code == 200
    return resposta.get_json()["data"]


def cabecalho_autorizacao(token):
    return {"Authorization": f"Bearer {token}"}


def test_auth_endpoints_reject_non_object_json(client):
    endpoints = (
        ("post", "/api/auth/cadastro"),
        ("post", "/api/auth/login"),
        ("post", "/api/auth/refresh"),
        ("post", "/api/auth/esqueci-senha"),
        ("post", "/api/auth/redefinir-senha"),
    )
    for method, path in endpoints:
        response = getattr(client, method)(path, json=[])
        assert response.status_code in {400, 401}

    invalid_login_fields = client.post(
        "/api/auth/login",
        json={"email": ["not-an-email"], "senha": "secret"},
    )
    assert invalid_login_fields.status_code == 400
    invalid_registration_fields = client.post(
        "/api/auth/cadastro",
        json={"nome": {}, "email": "valid@example.com", "senha": "SenhaSegura123!"},
    )
    assert invalid_registration_fields.status_code == 400


def test_alterar_senha_invalida_todas_as_sessoes_e_tokens_de_recuperacao(client):
    email = "alterar-senha-sessoes@example.com"
    primeira_sessao = criar_sessao(client, email)
    segunda_sessao = client.post(
        "/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]
    recuperacao = client.post(
        "/api/auth/esqueci-senha", json={"email": email}
    ).get_json()["data"]["token_teste"]

    resposta = client.put(
        "/api/auth/alterar-senha",
        json={"senha_atual": "SenhaSegura123!", "nova_senha": "NovaSenha456!"},
        headers=cabecalho_autorizacao(primeira_sessao["token"]),
    )

    assert resposta.status_code == 200
    for sessao in (primeira_sessao, segunda_sessao):
        assert client.get(
            "/api/auth/me", headers=cabecalho_autorizacao(sessao["token"])
        ).status_code == 401
        assert client.post(
            "/api/auth/refresh", json={"refresh_token": sessao["refresh_token"]}
        ).status_code == 401

    assert client.post(
        "/api/auth/redefinir-senha",
        json={"token": recuperacao, "nova_senha": "abcdef"},
    ).status_code == 400
    assert client.post(
        "/api/auth/login", json={"email": email, "senha": "NovaSenha456!"}
    ).status_code == 200


def test_refresh_rotaciona_token_e_rejeita_reutilizacao(client):
    sessao = criar_sessao(client, "rotacao-sessao@example.com")

    resposta = client.post(
        "/api/auth/refresh", json={"refresh_token": sessao["refresh_token"]}
    )

    assert resposta.status_code == 200
    nova_sessao = resposta.get_json()["data"]
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": sessao["refresh_token"]}
    ).status_code == 401
    assert client.get(
        "/api/auth/me", headers=cabecalho_autorizacao(nova_sessao["token"])
    ).status_code == 200


def test_sessao_web_usa_cookie_http_only_e_rotaciona_refresh(client):
    cadastro = client.post(
        "/api/auth/cadastro",
        json={
            "nome": "Teste Web",
            "email": "sessao-web@example.com",
            "senha": "SenhaSegura123!",
        },
    )
    assert cadastro.status_code == 201

    login = client.post(
        "/api/auth/login",
        json={
            "email": "sessao-web@example.com",
            "senha": "SenhaSegura123!",
            "web": True,
        },
    )
    assert login.status_code == 200
    dados_login = login.get_json()["data"]
    assert dados_login["token"]
    assert "refresh_token" not in dados_login

    cookie_inicial = client.get_cookie(
        Config.AUTH_REFRESH_COOKIE_NAME, path="/api/auth"
    )
    assert cookie_inicial is not None
    assert cookie_inicial.http_only
    assert cookie_inicial.path == "/api/auth"
    assert cookie_inicial.same_site == Config.AUTH_REFRESH_COOKIE_SAMESITE

    headers = {"Origin": Config.CORS_ORIGINS[0]}
    refresh = client.post("/api/auth/refresh", json={}, headers=headers)
    assert refresh.status_code == 200
    dados_refresh = refresh.get_json()["data"]
    assert dados_refresh["token"]
    assert "refresh_token" not in dados_refresh

    cookie_renovado = client.get_cookie(
        Config.AUTH_REFRESH_COOKIE_NAME, path="/api/auth"
    )
    assert cookie_renovado is not None
    assert cookie_renovado.value != cookie_inicial.value

    logout = client.post(
        "/api/auth/logout",
        json={},
        headers={
            **headers,
            **cabecalho_autorizacao(dados_refresh["token"]),
        },
    )
    assert logout.status_code == 200
    assert client.get_cookie(
        Config.AUTH_REFRESH_COOKIE_NAME, path="/api/auth"
    ) is None


def test_refresh_cookie_rejeita_origem_nao_permitida(client):
    sessao = criar_sessao(client, "sessao-web-csrf@example.com")
    client.set_cookie(
        Config.AUTH_REFRESH_COOKIE_NAME,
        sessao["refresh_token"],
        path="/api/auth",
    )

    resposta = client.post(
        "/api/auth/refresh",
        json={},
        headers={"Origin": "https://origem-maliciosa.example"},
    )

    assert resposta.status_code == 403
    assert client.get_cookie(
        Config.AUTH_REFRESH_COOKIE_NAME, path="/api/auth"
    ) is None


def test_logout_revoga_tokens_de_acesso_e_atualizacao(client):
    sessao = criar_sessao(client, "logout-sessao@example.com")

    resposta = client.post(
        "/api/auth/logout",
        json={"refresh_token": sessao["refresh_token"]},
        headers=cabecalho_autorizacao(sessao["token"]),
    )

    assert resposta.status_code == 200
    assert client.get(
        "/api/auth/me", headers=cabecalho_autorizacao(sessao["token"])
    ).status_code == 401
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": sessao["refresh_token"]}
    ).status_code == 401


def test_policy_de_senha_e_aplicada_na_alteracao_e_recuperacao(client):
    email = "politica-senha@example.com"
    sessao = criar_sessao(client, email)
    headers = cabecalho_autorizacao(sessao["token"])

    alterar = client.put(
        "/api/auth/alterar-senha",
        json={"senha_atual": "SenhaSegura123!", "nova_senha": "curta123"},
        headers=headers,
    )
    assert alterar.status_code == 400

    token = client.post(
        "/api/auth/esqueci-senha", json={"email": email}
    ).get_json()["data"]["token_teste"]
    redefinir = client.post(
        "/api/auth/redefinir-senha",
        json={"token": token, "nova_senha": "curta123"},
    )
    assert redefinir.status_code == 400


def test_alias_de_recuperacao_nao_expoe_token_fora_de_testes(
    client, monkeypatch
):
    email = "recovery-alias@example.com"
    criar_sessao(client, email)
    monkeypatch.setattr(
        "controllers.auth_controller.Config.ENVIRONMENT",
        "development",
    )
    monkeypatch.setattr(
        "controllers.auth_controller.EmailService.enviar_recuperacao_senha",
        staticmethod(lambda *_: True),
    )

    resposta = client.post("/api/usuarios/recover", json={"email": email})

    assert resposta.status_code == 200
    assert "token_teste" not in resposta.get_json().get("data", {})


def test_aliases_de_recuperacao_compartilham_limite_de_solicitacao(client):
    for _ in range(5):
        resposta = client.post(
            "/api/auth/esqueci-senha",
            json={"email": "nao-cadastrado@example.com"},
        )
        assert resposta.status_code == 200

    resposta_alias = client.post(
        "/api/usuarios/recover",
        json={"email": "nao-cadastrado@example.com"},
    )

    assert resposta_alias.status_code == 429


@pytest.mark.parametrize(
    ("solicitar_path", "redefinir_path"),
    [
        ("/api/auth/esqueci-senha", "/api/auth/redefinir-senha"),
        (
            "/api/usuarios/recuperar-senha",
            "/api/usuarios/recuperar-senha/confirmar",
        ),
    ],
)
def test_redefinir_senha_invalida_sessoes(
    client, solicitar_path, redefinir_path
):
    email = "redefinir-sessoes@example.com"
    sessao = criar_sessao(client, email)
    solicitacao = client.post(solicitar_path, json={"email": email})
    assert solicitacao.status_code == 200
    token = solicitacao.get_json()["data"]["token_teste"]

    resposta = client.post(
        redefinir_path,
        json={"token": token, "nova_senha": "NovaSenha456!"},
    )

    assert resposta.status_code == 200
    assert client.get(
        "/api/auth/me", headers=cabecalho_autorizacao(sessao["token"])
    ).status_code == 401
    assert client.post(
        "/api/auth/refresh", json={"refresh_token": sessao["refresh_token"]}
    ).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": email, "senha": "NovaSenha456!"}
    ).status_code == 200
