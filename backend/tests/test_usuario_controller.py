import pytest
from flask import Flask

from config import Config
from controllers.usuario_controller import UsuarioController


@pytest.mark.parametrize(
    ("allow_email_test", "environment"),
    [(False, "testing"), (True, "production")],
)
def test_email_test_endpoint_is_disabled_in_production_or_without_flag(
    monkeypatch, allow_email_test, environment
):
    monkeypatch.setattr(Config, "ALLOW_EMAIL_TEST", allow_email_test)
    monkeypatch.setattr(Config, "ENVIRONMENT", environment)
    monkeypatch.setattr(
        "controllers.usuario_controller.EmailService.enviar_email_teste",
        lambda _email: pytest.fail("Email must not be sent when disabled."),
    )

    with Flask(__name__).test_request_context(
        "/api/usuarios/test-email", method="POST", json={"email": "test@example.com"}
    ):
        response, status = UsuarioController.testar_email(1)

    assert status == 404
    assert response.get_json()["status"] == "erro"


@pytest.mark.parametrize(
    "payload",
    [[], {}, {"email": 1}, {"email": ""}, {"email": "  "}],
)
def test_email_test_endpoint_rejects_invalid_email(monkeypatch, payload):
    monkeypatch.setattr(Config, "ALLOW_EMAIL_TEST", True)
    monkeypatch.setattr(Config, "ENVIRONMENT", "testing")
    monkeypatch.setattr(
        "controllers.usuario_controller.EmailService.enviar_email_teste",
        lambda _email: pytest.fail("Invalid email must not be sent."),
    )

    with Flask(__name__).test_request_context(
        "/api/usuarios/test-email", method="POST", json=payload
    ):
        response, status = UsuarioController.testar_email(1)

    assert status == 400
    assert response.get_json()["status"] == "erro"


def test_email_test_endpoint_normalizes_address_and_returns_success(monkeypatch):
    monkeypatch.setattr(Config, "ALLOW_EMAIL_TEST", True)
    monkeypatch.setattr(Config, "ENVIRONMENT", "testing")
    enviados = []
    monkeypatch.setattr(
        "controllers.usuario_controller.EmailService.enviar_email_teste",
        lambda email: enviados.append(email) or True,
    )

    with Flask(__name__).test_request_context(
        "/api/usuarios/test-email",
        method="POST",
        json={"email": "  TEST@Example.COM  "},
    ):
        response, status = UsuarioController.testar_email(1)

    assert status == 200
    assert enviados == ["test@example.com"]
    assert response.get_json()["status"] == "sucesso"


def test_email_test_endpoint_reports_delivery_failure(monkeypatch):
    monkeypatch.setattr(Config, "ALLOW_EMAIL_TEST", True)
    monkeypatch.setattr(Config, "ENVIRONMENT", "testing")
    monkeypatch.setattr(
        "controllers.usuario_controller.EmailService.enviar_email_teste",
        lambda _email: False,
    )

    with Flask(__name__).test_request_context(
        "/api/usuarios/test-email",
        method="POST",
        json={"email": "test@example.com"},
    ):
        response, status = UsuarioController.testar_email(1)

    assert status == 503
    assert response.get_json()["status"] == "erro"
