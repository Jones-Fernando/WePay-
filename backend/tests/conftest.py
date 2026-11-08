"""Configuração dos testes de integração com MySQL."""

import os

import pytest

os.environ.setdefault("APP_ENV", "testing")
os.environ.setdefault("DB_NAME", "wepay_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALLOW_EMAIL_TEST", "false")

if os.environ["APP_ENV"].strip().lower() != "testing":
    raise RuntimeError(
        "Os testes do backend só podem ser executados com APP_ENV=testing."
    )

if os.environ["DB_NAME"].strip() != "wepay_test":
    raise RuntimeError(
        "Os testes do backend só podem usar o banco isolado DB_NAME=wepay_test."
    )

from app import create_app
from database.connection import (
    cursor_for,
    get_connection_context,
    initialize_database,
)
from services.email_service import EmailService
from utils.rate_limiter import limiter

flask_app = create_app()


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    initialize_database()


@pytest.fixture(autouse=True)
def database_reset():
    """Remove dados do banco de testes sem apagar seu schema MySQL."""
    flask_app.config.update(TESTING=True)
    limiter.reset()
    tables = (
        "push_outbox", "expo_push_tokens", "notificacoes", "convites_grupo", "recuperacao_tokens", "revoked_tokens",
        "refresh_tokens", "categorias", "despesas_pessoais", "saldos", "pagamentos",
        "despesa_divisoes", "despesas", "participantes", "grupos", "usuarios",
    )
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            for table in tables:
                cursor.execute(f"DELETE FROM {table}")
            connection.commit()
        finally:
            cursor.close()


@pytest.fixture(autouse=True)
def prevent_test_emails(monkeypatch):
    monkeypatch.setattr(
        EmailService, "_enviar_email", staticmethod(lambda *args, **kwargs: False)
    )
