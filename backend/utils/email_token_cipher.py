from cryptography.fernet import Fernet

from config import Config


_cipher = Fernet(Config.EMAIL_OUTBOX_ENCRYPTION_KEY.encode("ascii"))


def encrypt_recovery_token(token: str) -> str:
    return _cipher.encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_recovery_token(ciphertext: str | bytes) -> str:
    if isinstance(ciphertext, str):
        ciphertext = ciphertext.encode("ascii")
    return _cipher.decrypt(ciphertext).decode("utf-8")
