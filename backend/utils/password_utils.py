import hashlib
import hmac

import bcrypt

MIN_PASSWORD_LENGTH = 12
MAX_PASSWORD_BYTES = 72
PASSWORD_SPECIAL_CHARACTERS = frozenset("!@#$%^&*()-_=+[]{};:,.?")


def is_legacy_password_hash(hashed_password):
    return (
        isinstance(hashed_password, str)
        and len(hashed_password) == 64
        and all(character in "0123456789abcdef" for character in hashed_password)
    )


def check_legacy_password(password: str, hashed_password: str) -> bool:
    if not isinstance(password, str) or not is_legacy_password_hash(hashed_password):
        return False
    try:
        password_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
    except UnicodeEncodeError:
        return False
    return hmac.compare_digest(password_hash, hashed_password)


def validar_senha(password: object) -> str | None:
    if not isinstance(password, str):
        return "Senha deve ser texto."
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Senha deve ter ao menos {MIN_PASSWORD_LENGTH} caracteres."
    if not any("A" <= character <= "Z" for character in password):
        return "Senha deve conter pelo menos uma letra maiuscula."
    if not any("0" <= character <= "9" for character in password):
        return "Senha deve conter pelo menos um numero."
    if not any(character in PASSWORD_SPECIAL_CHARACTERS for character in password):
        return (
            "Senha deve conter pelo menos um caractere especial valido "
            "(como !, @ ou #); espacos nao contam."
        )
    try:
        tamanho_bytes = len(password.encode("utf-8"))
    except UnicodeEncodeError:
        return "Senha contem caracteres invalidos."
    if tamanho_bytes > MAX_PASSWORD_BYTES:
        return f"Senha deve ter no maximo {MAX_PASSWORD_BYTES} bytes."
    return None


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
    except (ValueError, TypeError, UnicodeEncodeError):
        return False
