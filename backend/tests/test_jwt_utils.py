from datetime import datetime, timedelta
import hashlib

import jwt
import pytest

from database.connection import cursor_for, get_connection_context
from utils.jwt_utils import (
    decode_token,
    generate_refresh_token,
    generate_token,
    is_access_token_valid,
    revoke_token,
    token_hash,
)


def test_generated_tokens_enforce_types_and_preserve_claims():
    access_token = generate_token(42, auth_version=3)
    access_payload = decode_token(access_token)
    refresh_token = generate_refresh_token(42, auth_version=3)
    refresh_payload = decode_token(refresh_token, expected_type="refresh")

    assert access_payload["sub"] == "42"
    assert access_payload["type"] == "access"
    assert access_payload["auth_version"] == 3
    assert access_payload["jti"]
    assert refresh_payload["sub"] == "42"
    assert refresh_payload["type"] == "refresh"
    assert refresh_payload["auth_version"] == 3
    assert token_hash(access_token) == hashlib.sha256(
        access_token.encode("utf-8")
    ).hexdigest()

    with pytest.raises(ValueError, match="Token ausente"):
        decode_token("")
    with pytest.raises(ValueError, match="Tipo de token invalido"):
        decode_token(access_token, expected_type="refresh")
    with pytest.raises(jwt.PyJWTError):
        decode_token("not.a.valid.token")


def test_access_token_validity_checks_user_version_and_revocation():
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "INSERT INTO usuarios (nome, email, senha, auth_version) "
                "VALUES (?, ?, ?, ?)",
                ("JWT Test", "jwt-utils@example.com", "hash", 2),
            )
            usuario_id = cursor.lastrowid
            connection.commit()
        finally:
            cursor.close()

    payload = decode_token(generate_token(usuario_id, auth_version=2))
    assert is_access_token_valid(usuario_id, payload["jti"], 2) is True
    assert is_access_token_valid(usuario_id, payload["jti"], 1) is False
    assert is_access_token_valid(999999, payload["jti"], 2) is False
    assert is_access_token_valid(usuario_id, "", 2) is False
    assert is_access_token_valid(0, payload["jti"], 2) is False

    revoke_token(
        payload["jti"],
        "access",
        datetime.now() + timedelta(minutes=5),
    )
    assert is_access_token_valid(usuario_id, payload["jti"], 2) is False

    revoke_token("", "access", datetime.now() + timedelta(minutes=5))
