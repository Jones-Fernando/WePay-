from utils.email_token_cipher import (
    decrypt_recovery_token,
    encrypt_recovery_token,
)


def test_recovery_token_ciphertext_is_not_plaintext_and_round_trips():
    token = "sensitive-recovery-token"

    ciphertext = encrypt_recovery_token(token)

    assert token not in ciphertext
    assert decrypt_recovery_token(ciphertext) == token
