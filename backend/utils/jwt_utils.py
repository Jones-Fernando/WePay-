from datetime import datetime, timedelta, timezone
from uuid import uuid4
import hashlib

import jwt

from config import Config
from database.connection import cursor_for, fetch_one, get_connection_context


def _generate_token(usuario_id, token_type, expires_delta, auth_version=0):
    now = datetime.now(timezone.utc)
    expires_at = now + expires_delta
    payload = {
        "sub": str(usuario_id),
        "type": token_type,
        "jti": str(uuid4()),
        "auth_version": auth_version,
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(
        payload,
        Config.SECRET_KEY,
        algorithm=Config.JWT_ALGORITHM,
    )


def generate_token(usuario_id, auth_version=0):
    return _generate_token(
        usuario_id,
        "access",
        timedelta(minutes=Config.JWT_ACCESS_TOKEN_EXPIRES_MINUTES),
        auth_version,
    )


def generate_refresh_token(usuario_id, auth_version=0):
    return _generate_token(
        usuario_id,
        "refresh",
        timedelta(days=Config.JWT_REFRESH_TOKEN_EXPIRES_DAYS),
        auth_version,
    )


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def decode_token(token, expected_type="access"):
    if not token:
        raise ValueError("Token ausente.")
    payload = jwt.decode(
        token,
        Config.SECRET_KEY,
        algorithms=[Config.JWT_ALGORITHM],
    )
    if payload.get("type") != expected_type:
        raise ValueError("Tipo de token invalido.")
    return payload


def is_access_token_valid(usuario_id: int, jti: str, auth_version: int) -> bool:
    if not usuario_id or not jti:
        return False
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                SELECT u.auth_version,
                       EXISTS (
                           SELECT 1
                           FROM revoked_tokens r
                           WHERE r.jti = ?
                             AND r.expires_at > CURRENT_TIMESTAMP
                       ) AS token_revoked
                FROM usuarios u
                WHERE u.id = ?
                  AND u.excluido_em IS NULL
                """,
                (jti, usuario_id),
            )
            state = fetch_one(cursor)
            return bool(
                state
                and int(state["auth_version"]) == auth_version
                and not state["token_revoked"]
            )
        finally:
            cursor.close()


def revoke_token(jti: str, token_type: str, expires_at):
    if not jti:
        return
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "DELETE FROM revoked_tokens WHERE expires_at < NOW()"
            )
            cursor.execute(
                "INSERT INTO revoked_tokens (jti, token_type, expires_at) VALUES (?, ?, ?)",
                (jti, token_type, expires_at),
            )
            conn.commit()
        finally:
            cursor.close()
