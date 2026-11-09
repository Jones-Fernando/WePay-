from contextlib import contextmanager

from app import create_app
from controllers import auth_controller
from controllers.auth_controller import AuthController
from services.auth_service import AuthService


app = create_app()


def _successful_authentication():
    return {
        "token": "access-token-secret",
        "refresh_token": "refresh-token-secret",
        "user": {
            "id": 42,
            "nome": "Teste",
            "email": "teste@example.com",
            "saldo_total": 0,
        },
    }, None


def test_login_logs_refresh_decode_failure_without_exposing_token(
    monkeypatch, caplog
):
    monkeypatch.setattr(
        AuthService,
        "autenticar_usuario",
        staticmethod(lambda *_args: _successful_authentication()),
    )

    def fail_decode(*_args, **_kwargs):
        raise ValueError("invalid refresh payload")

    monkeypatch.setattr(auth_controller, "decode_token", fail_decode)

    with app.test_request_context(
        "/api/auth/login",
        method="POST",
        json={"email": "teste@example.com", "senha": "SenhaSegura123!"},
    ):
        response, status = AuthController.login()

    assert status == 500
    assert response.get_json()["mensagem"] == "Nao foi possivel iniciar a sessao."
    assert (
        "Falha ao decodificar refresh token durante login (usuario_id=42)."
        in caplog.text
    )
    assert "invalid refresh payload" in caplog.text
    assert "refresh-token-secret" not in caplog.text
    assert "access-token-secret" not in caplog.text
    assert "invalid refresh payload" not in response.get_data(as_text=True)


def test_login_logs_refresh_persistence_failure_without_exposing_token(
    monkeypatch, caplog
):
    monkeypatch.setattr(
        AuthService,
        "autenticar_usuario",
        staticmethod(lambda *_args: _successful_authentication()),
    )
    monkeypatch.setattr(
        auth_controller,
        "decode_token",
        lambda *_args, **_kwargs: {"exp": 1_800_000_000},
    )

    @contextmanager
    def fail_connection():
        raise RuntimeError("database unavailable")
        yield

    monkeypatch.setattr(
        auth_controller, "get_connection_context", fail_connection
    )

    with app.test_request_context(
        "/api/auth/login",
        method="POST",
        json={"email": "teste@example.com", "senha": "SenhaSegura123!"},
    ):
        response, status = AuthController.login()

    assert status == 500
    assert response.get_json()["mensagem"] == "Nao foi possivel iniciar a sessao."
    assert (
        "Falha ao persistir refresh token durante login (usuario_id=42)."
        in caplog.text
    )
    assert "database unavailable" in caplog.text
    assert "refresh-token-secret" not in caplog.text
    assert "access-token-secret" not in caplog.text
    assert "database unavailable" not in response.get_data(as_text=True)
