import hashlib
import pytest

from utils.password_utils import (
    MAX_PASSWORD_BYTES,
    MIN_PASSWORD_LENGTH,
    check_password,
    hash_password,
    is_legacy_password_hash,
    validar_senha,
)


def test_senha_deve_atingir_minimo_de_caracteres():
    assert validar_senha("a" * (MIN_PASSWORD_LENGTH - 1))
    assert validar_senha("a" * MIN_PASSWORD_LENGTH) is None


def test_senha_nao_pode_exceder_limite_de_bytes_do_bcrypt():
    assert validar_senha("a" * (MAX_PASSWORD_BYTES + 1))
    assert validar_senha("é" * (MAX_PASSWORD_BYTES // 2 + 1))


def test_senha_deve_ser_texto():
    assert validar_senha(None) == "Senha deve ser texto."


def test_senha_com_unicode_invalido_e_rejeitada():
    assert validar_senha("\ud800" + "a" * (MIN_PASSWORD_LENGTH - 1))


def test_hash_password_preserva_compatibilidade_com_hashes_legados():
    assert hash_password("123456")


@pytest.mark.parametrize("password", [None, 123])
def test_hash_password_rejeita_valores_que_nao_sao_texto(password):
    with pytest.raises(ValueError):
        hash_password(password)


def test_check_password_valida_bcrypt_e_hashes_legados():
    password = "SenhaSegura123!"
    hashed_password = hash_password(password)
    assert check_password(password, hashed_password) is True
    assert check_password("OutraSenha123!", hashed_password) is False

    legacy_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
    assert check_password(password, legacy_hash) is True
    assert check_password("OutraSenha123!", legacy_hash) is False


def test_is_legacy_password_hash_recognizes_sha256_hex_only():
    assert is_legacy_password_hash("a" * 64) is True
    assert is_legacy_password_hash("A" * 64) is False
    assert is_legacy_password_hash("a" * 63) is False
    assert is_legacy_password_hash("$2b$12$" + "a" * 53) is False
    assert is_legacy_password_hash(None) is False


def test_check_password_rejeita_valores_ausentes_ou_hash_invalido():
    assert check_password(None, "hash") is False
    assert check_password("password", None) is False
    assert check_password("password", "malformed-hash") is False


@pytest.mark.parametrize(
    "password",
    ["", "          a"],
)
def test_senhas_curta_sao_rejeitadas(password):
    assert validar_senha(password) is not None
