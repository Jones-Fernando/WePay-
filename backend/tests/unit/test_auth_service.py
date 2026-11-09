import hashlib

import pytest

from services import auth_service
from services.auth_service import AuthService


def test_legacy_password_over_bcrypt_limit_remains_login_compatible(monkeypatch):
    password = "é" * 37
    legacy_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
    usuario = {
        "id": 17,
        "nome": "Conta antiga",
        "email": "legacy@example.com",
        "senha": legacy_hash,
        "saldo_total": 0,
        "auth_version": 0,
        "excluido_em": None,
    }
    monkeypatch.setattr(
        auth_service.UsuarioModel,
        "buscar_por_email",
        staticmethod(lambda _email: usuario),
    )
    monkeypatch.setattr(
        auth_service.UsuarioModel,
        "atualizar_hash_senha_legado",
        staticmethod(lambda *_args: pytest.fail("oversized legacy hash rehashed")),
    )
    monkeypatch.setattr(
        auth_service,
        "generate_token",
        lambda *_args: "access",
    )
    monkeypatch.setattr(
        auth_service,
        "generate_refresh_token",
        lambda *_args: "refresh",
    )

    resultado, erro = AuthService.autenticar_usuario(
        "LEGACY@example.com",
        password,
    )

    assert erro is None
    assert resultado["token"] == "access"
    assert resultado["refresh_token"] == "refresh"
