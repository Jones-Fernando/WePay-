"""Configuração dos testes de integração com MySQL."""

import os

import pytest

os.environ.setdefault("APP_ENV", "testing")
os.environ.setdefault("DB_NAME", "wepay_test")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ALLOW_EMAIL_TEST", "false")

from database.connection import cursor_for, get_connection_context, initialize_database
from utils.rate_limiter import limiter

initialize_database()


@pytest.fixture(autouse=True)
def database_reset():
    """Remove dados do banco de testes sem apagar seu schema MySQL."""
    limiter.reset()
    tables = (
        "notificacoes", "convites_grupo", "recuperacao_tokens", "revoked_tokens",
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
