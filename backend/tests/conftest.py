"""Configuração dos testes de integração com MySQL."""

import os

import pytest

os.environ.setdefault("APP_ENV", "testing")
os.environ.setdefault("DB_NAME", "wepay_test")
os.environ.setdefault("SECRET_KEY", "test-only-secret-key-at-least-32-bytes")
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
    _connect_mysql,
    cursor_for,
    get_connection_context,
    initialize_database,
)
from services.email_service import EmailService
from utils.rate_limiter import limiter

flask_app = create_app()


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database():
    """Serialize backend test sessions that share the disposable MySQL schema."""
    lock_name = "wepay:backend-tests:wepay_test"
    lock_connection = _connect_mysql()
    lock_cursor = lock_connection.cursor()
    lock_acquired = False
    try:
        lock_cursor.execute("SELECT GET_LOCK(%s, %s)", (lock_name, 600))
        result = lock_cursor.fetchone()
        if not result or result[0] != 1:
            raise RuntimeError(
                "Could not acquire the backend test database lock."
            )
        lock_acquired = True
        initialize_database()
        yield
    finally:
        try:
            if lock_acquired:
                lock_cursor.execute("SELECT RELEASE_LOCK(%s)", (lock_name,))
                lock_cursor.fetchone()
        finally:
            lock_cursor.close()
            lock_connection.close()


@pytest.fixture(autouse=True)
def database_reset():
    """Remove dados do banco de testes sem apagar seu schema MySQL."""
    flask_app.config.update(TESTING=True)
    limiter.reset()
    tables = (
        "gemini_usage_diaria", "push_outbox_destinatarios", "push_outbox", "expo_push_tokens", "notificacoes", "convites_grupo", "password_reset_email_outbox", "recuperacao_tokens", "revoked_tokens",
        "refresh_tokens", "categorias_icones_usuario", "despesas_pessoais", "despesa_divisoes",
        "despesas", "categorias", "saldos", "pagamentos", "participantes", "grupos", "usuarios",
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
