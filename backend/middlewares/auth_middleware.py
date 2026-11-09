from functools import wraps

import jwt
from flask import g, request

from utils.jwt_utils import decode_token, is_access_token_valid
from utils.response_utils import ResponseUtils


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()

        if len(parts) != 2 or parts[0].lower() != "bearer":
            return ResponseUtils.erro("Token nao fornecido.", status=401)

        token = parts[1]

        try:
            payload = decode_token(token, expected_type="access")
            current_user_id = int(payload.get("sub"))
            jti = payload.get("jti")
            auth_version = int(payload.get("auth_version", 0))
            if not is_access_token_valid(current_user_id, jti, auth_version):
                return ResponseUtils.erro("Token revogado.", status=401)
        except (jwt.PyJWTError, ValueError, TypeError):
            return ResponseUtils.erro("Token invalido.", status=401)

        g.authenticated_user_id = current_user_id
        return f(current_user_id, *args, **kwargs)

    return decorated
