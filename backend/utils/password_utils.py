import hashlib
import hmac

import bcrypt


def hash_password(password: str) -> str:
    if password is None:
        raise ValueError("Senha nao pode ser nula.")
    if not isinstance(password, str):
        raise ValueError("Senha deve ser texto.")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def check_password(password: str, hashed_password: str) -> bool:
    if password is None or hashed_password is None:
        return False
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Compatibilidade com hashes SHA-256 antigos do projeto.
        legacy_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        return hmac.compare_digest(legacy_hash, str(hashed_password))
