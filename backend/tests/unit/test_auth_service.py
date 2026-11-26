import hashlib

import pytest
from mysql.connector.errors import IntegrityError

from services import auth_service
from services.auth_service import AuthService


def test_signup_uses_generic_result_for_duplicate_email(monkeypatch):
    calls = []

    def create_user(*_args, **_kwargs):
        calls.append("create")
        raise IntegrityError(msg="Duplicate email", errno=1062)

    monkeypatch.setattr(auth_service.UsuarioModel, "criar", create_user)

    usuario_id, erro = AuthService.registrar_usuario(
        "Nome", "EXISTENTE@example.com", "SenhaSegura123!"
    )

    assert usuario_id is None
    assert erro is None
    assert calls == ["create"]


def test_signup_reraises_non_duplicate_integrity_errors(monkeypatch):
    error = IntegrityError(msg="Database constraint failure", errno=1048)
    monkeypatch.setattr(
        auth_service.UsuarioModel,
        "criar",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(error),
    )

    with pytest.raises(IntegrityError) as raised:
        AuthService.registrar_usuario(
            "Nome", "pessoa@example.com", "SenhaSegura123!"
        )

    assert raised.value is error


def test_legacy_password_over_bcrypt_limit_requires_password_reset(monkeypatch):
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
    resultado, erro = AuthService.autenticar_usuario(
        "LEGACY@example.com",
        password,
    )

    assert resultado is None
    assert erro == (
        "O e-mail ou a senha não conferem. Confira os dois e tente novamente."
    )


@pytest.mark.parametrize(
    "usuario",
    [
        None,
        {"senha": "hash", "excluido_em": "2026-01-01"},
    ],
)
def test_missing_or_deleted_accounts_still_check_a_dummy_bcrypt_hash(
    monkeypatch, usuario
):
    checked_hashes = []
    monkeypatch.setattr(
        auth_service.UsuarioModel,
        "buscar_por_email",
        staticmethod(lambda _email: usuario),
    )
    monkeypatch.setattr(
        auth_service,
        "check_password",
        lambda _password, password_hash: checked_hashes.append(password_hash)
        or False,
    )

    resultado, erro = AuthService.autenticar_usuario(
        "unknown@example.com",
        "SenhaSegura123!",
    )

    assert resultado is None
    assert erro == (
        "O e-mail ou a senha não conferem. Confira os dois e tente novamente."
    )
    assert checked_hashes == [auth_service._DUMMY_PASSWORD_HASH]
