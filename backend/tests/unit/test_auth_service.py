import hashlib

import pytest
from mysql.connector.errors import IntegrityError

from models import usuario_model
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


def test_valid_legacy_password_is_upgraded_to_bcrypt_after_login(monkeypatch):
    password = "SenhaSegura123!"
    legacy_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
    usuario = {
        "id": 18,
        "nome": "Conta antiga",
        "email": "legacy@example.com",
        "senha": legacy_hash,
        "saldo_total": 0,
        "auth_version": 2,
        "excluido_em": None,
    }
    updates = []
    monkeypatch.setattr(
        auth_service.UsuarioModel,
        "buscar_por_email",
        staticmethod(lambda _email: usuario),
    )
    monkeypatch.setattr(
        auth_service.UsuarioModel,
        "atualizar_hash_senha_legado",
        staticmethod(
            lambda user_id, old_hash, new_hash: updates.append(
                (user_id, old_hash, new_hash)
            )
            or True
        ),
    )

    resultado, erro = AuthService.autenticar_usuario("LEGACY@example.com", password)

    assert erro is None
    assert resultado["user"]["id"] == usuario["id"]
    assert len(updates) == 1
    assert updates[0][:2] == (usuario["id"], legacy_hash)
    assert auth_service.check_password(password, updates[0][2]) is True
    assert usuario["senha"] == updates[0][2]


def test_legacy_login_fails_if_hash_changed_before_upgrade(monkeypatch):
    password = "SenhaSegura123!"
    usuario = {
        "id": 19,
        "nome": "Conta antiga",
        "email": "legacy@example.com",
        "senha": hashlib.sha256(password.encode("utf-8")).hexdigest(),
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
        staticmethod(lambda *_args: False),
    )

    resultado, erro = AuthService.autenticar_usuario("legacy@example.com", password)

    assert resultado is None
    assert erro == (
        "O e-mail ou a senha não conferem. Confira os dois e tente novamente."
    )


@pytest.mark.parametrize(("rowcount", "expected"), [(1, True), (0, False)])
def test_legacy_hash_upgrade_uses_compare_and_swap(
    monkeypatch, rowcount, expected
):
    class FakeCursor:
        def __init__(self):
            self.rowcount = rowcount
            self.query = ""
            self.parameters = ()

        def execute(self, query, parameters):
            self.query = query
            self.parameters = parameters

        def close(self):
            pass

    class FakeConnection:
        def __init__(self):
            self.commits = 0

        def commit(self):
            self.commits += 1

    cursor = FakeCursor()
    connection = FakeConnection()

    class ConnectionContext:
        def __enter__(self):
            return connection

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr(
        usuario_model,
        "get_connection_context",
        lambda: ConnectionContext(),
    )
    monkeypatch.setattr(usuario_model, "cursor_for", lambda _connection: cursor)

    result = usuario_model.UsuarioModel.atualizar_hash_senha_legado(
        42,
        "old-sha256",
        "new-bcrypt",
    )

    assert result is expected
    assert "WHERE id = ? AND senha = ? AND excluido_em IS NULL" in cursor.query
    assert "auth_version" not in cursor.query
    assert cursor.parameters == ("new-bcrypt", 42, "old-sha256")
    assert connection.commits == 1


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
