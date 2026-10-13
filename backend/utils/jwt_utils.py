from datetime import datetime, timedelta, timezone
from uuid import uuid4
import hashlib

import jwt

from config import Config
from database.connection import cursor_for, fetch_one, get_connection_context


def _generate_token(usuario_id, token_type, expires_delta):
    now = datetime.now(timezone.utc)
    expires_at = now + expires_delta
    payload = {
        "sub": str(usuario_id),
        "type": token_type,
        "jti": str(uuid4()),
        "iat": now,
        "exp": expires_at,
    }
    return jwt.encode(
        payload,
        Config.SECRET_KEY,
        algorithm=Config.JWT_ALGORITHM,
    )


def generate_token(usuario_id):
    return _generate_token(
        usuario_id,
        "access",
        timedelta(minutes=Config.JWT_ACCESS_TOKEN_EXPIRES_MINUTES),
    )


def generate_refresh_token(usuario_id):
    return _generate_token(
        usuario_id,
        "refresh",
        timedelta(days=Config.JWT_REFRESH_TOKEN_EXPIRES_DAYS),
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


def is_token_revoked(jti: str) -> bool:
    if not jti:
        return False
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            query = "SELECT id FROM revoked_tokens WHERE jti = ? AND expires_at > CURRENT_TIMESTAMP"
            cursor.execute(query, (jti,))
            return fetch_one(cursor) is not None
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
