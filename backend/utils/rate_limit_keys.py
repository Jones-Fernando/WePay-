import jwt
from flask import g, request
from flask_limiter.util import get_remote_address

from config import Config
from utils.jwt_utils import decode_token


def authenticated_user_or_ip():
    user_id = getattr(g, "authenticated_user_id", None)
    if user_id is not None:
        return "user:" + str(user_id)
    return "ip:" + str(get_remote_address())


def refresh_user_or_ip():
    data = request.get_json(silent=True)
    token = data.get("refresh_token") if isinstance(data, dict) else None
    token = token or request.cookies.get(Config.AUTH_REFRESH_COOKIE_NAME)
    if isinstance(token, str) and token:
        try:
            payload = decode_token(token, expected_type="refresh")
            user_id = int(payload["sub"])
            if user_id > 0:
                return f"user:{user_id}"
        except (jwt.PyJWTError, KeyError, TypeError, ValueError):
            pass
    return f"ip:{get_remote_address()}"
