from flask import Flask

from utils.rate_limit_keys import password_reset_email_or_ip


def test_password_reset_rate_limit_key_normalizes_and_hides_email():
    app = Flask(__name__)

    with app.test_request_context(
        json={"email": "  User@Example.com  "},
        environ_base={"REMOTE_ADDR": "203.0.113.15"},
    ):
        first_key = password_reset_email_or_ip()

    with app.test_request_context(
        json={"email": "user@example.com"},
        environ_base={"REMOTE_ADDR": "198.51.100.27"},
    ):
        second_key = password_reset_email_or_ip()

    assert first_key == second_key
    assert "user@example.com" not in first_key


def test_password_reset_rate_limit_key_falls_back_to_ip_without_email():
    app = Flask(__name__)

    with app.test_request_context(
        json={},
        environ_base={"REMOTE_ADDR": "203.0.113.15"},
    ):
        assert password_reset_email_or_ip() == "ip:203.0.113.15"
