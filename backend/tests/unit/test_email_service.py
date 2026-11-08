import pytest
from email import message_from_string

from services.email_service import EmailService

_enviar_email = EmailService._enviar_email


def test_smtp_is_not_opened_when_credentials_are_missing(monkeypatch):
    monkeypatch.setattr("services.email_service.Config.EMAIL_REMETENTE", "")
    monkeypatch.setattr("services.email_service.Config.EMAIL_SENHA_APP", "secret")
    monkeypatch.setattr(
        "services.email_service.smtplib.SMTP",
        lambda *_args, **_kwargs: pytest.fail("SMTP must not be opened."),
    )
    monkeypatch.setattr(
        "services.email_service.smtplib.SMTP_SSL",
        lambda *_args, **_kwargs: pytest.fail("SMTP must not be opened."),
    )

    assert _enviar_email(
        "pessoa@example.com", "Assunto", "Corpo"
    ) is False


def test_smtp_submission_uses_starttls_and_sends_multipart_message(monkeypatch):
    calls = []

    class SMTPDouble:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def ehlo(self):
            calls.append(("ehlo",))

        def starttls(self):
            calls.append(("starttls",))

        def login(self, username, password):
            calls.append(("login", username, password))

        def sendmail(self, sender, recipient, message):
            calls.append(("sendmail", sender, recipient, message))

    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_REMETENTE", "sender@example.com"
    )
    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_SENHA_APP", "app-secret"
    )
    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_SERVER", "smtp.example.com"
    )
    monkeypatch.setattr("services.email_service.Config.EMAIL_PORT", 587)
    monkeypatch.setattr(
        "services.email_service.smtplib.SMTP",
        lambda *args, **kwargs: calls.append(("connect", args, kwargs))
        or SMTPDouble(),
    )

    assert _enviar_email(
        "recipient@example.com",
        "WePay Test",
        "Plain body",
        "<p>HTML body</p>",
    ) is True

    assert calls[0] == (
        "connect",
        ("smtp.example.com", 587),
        {"timeout": 15},
    )
    assert [call[0] for call in calls] == [
        "connect",
        "ehlo",
        "starttls",
        "ehlo",
        "login",
        "sendmail",
    ]
    assert calls[4] == ("login", "sender@example.com", "app-secret")
    _, sender, recipient, message = calls[5]
    assert sender == "sender@example.com"
    assert recipient == "recipient@example.com"
    parsed_message = message_from_string(message)
    assert parsed_message["Subject"] == "WePay Test"
    parts = [
        part.get_payload(decode=True).decode("utf-8")
        for part in parsed_message.walk()
        if part.get_content_maintype() == "text"
    ]
    assert parts == ["Plain body", "<p>HTML body</p>"]


def test_smtp_ssl_submission_uses_secure_connection(monkeypatch):
    calls = []

    class SMTPDouble:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def login(self, username, password):
            calls.append(("login", username, password))

        def sendmail(self, sender, recipient, _message):
            calls.append(("sendmail", sender, recipient))

    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_REMETENTE", "sender@example.com"
    )
    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_SENHA_APP", "app-secret"
    )
    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_SERVER", "smtp.example.com"
    )
    monkeypatch.setattr("services.email_service.Config.EMAIL_PORT", 465)
    monkeypatch.setattr(
        "services.email_service.smtplib.SMTP_SSL",
        lambda *args, **kwargs: calls.append(("connect", args, kwargs))
        or SMTPDouble(),
    )
    monkeypatch.setattr(
        "services.email_service.smtplib.SMTP",
        lambda *_args, **_kwargs: pytest.fail("Port 465 must use SMTP_SSL."),
    )

    assert _enviar_email(
        "recipient@example.com", "Assunto", "Corpo"
    ) is True
    assert calls == [
        ("connect", ("smtp.example.com", 465), {"timeout": 15}),
        ("login", "sender@example.com", "app-secret"),
        ("sendmail", "sender@example.com", "recipient@example.com"),
    ]


def test_smtp_errors_are_logged_and_reported_as_failure(monkeypatch, caplog):
    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_REMETENTE", "sender@example.com"
    )
    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_SENHA_APP", "app-secret"
    )
    monkeypatch.setattr(
        "services.email_service.Config.EMAIL_SERVER", "smtp.example.com"
    )
    monkeypatch.setattr("services.email_service.Config.EMAIL_PORT", 587)

    def fail_connect(*_args, **_kwargs):
        raise OSError("SMTP unavailable")

    monkeypatch.setattr("services.email_service.smtplib.SMTP", fail_connect)

    assert _enviar_email(
        "recipient@example.com", "Assunto", "Corpo"
    ) is False
    assert "Falha ao enviar e-mail SMTP" in caplog.text


def test_email_test_message_uses_expected_subject_and_body(monkeypatch):
    sent = []
    monkeypatch.setattr(
        EmailService,
        "_enviar_email",
        staticmethod(lambda *args: sent.append(args) or True),
    )

    assert EmailService.enviar_email_teste("recipient@example.com") is True
    assert sent == [
        (
            "recipient@example.com",
            "WePay - Teste de Email",
            "Este é um email de teste do WePay.",
        )
    ]


def test_group_invitation_email_contains_deep_link_and_escapes_group_name(monkeypatch):
    emails = []
    monkeypatch.setattr(
        "services.email_service.Config.FRONTEND_URL",
        "https://wepay.example.com/",
    )
    monkeypatch.setattr(
        EmailService,
        "_enviar_email",
        staticmethod(lambda *args: emails.append(args) or True),
    )

    enviado = EmailService.enviar_convite(
        "pessoa@example.com", "Grupo <Teste>", "token-de-convite"
    )

    assert enviado is True
    destino, assunto, texto, html = emails[0]
    assert destino == "pessoa@example.com"
    assert assunto == "WePay - Convite para Grupo <Teste>"
    assert "https://wepay.example.com/convite?token=token-de-convite" in texto
    assert "Grupo &lt;Teste&gt;" in html
    assert "href='https://wepay.example.com/convite?token=token-de-convite'" in html


def test_password_recovery_email_contains_clickable_web_link(monkeypatch):
    emails = []
    monkeypatch.setattr(
        "services.email_service.Config.FRONTEND_URL",
        "https://wepay.example.com/",
    )
    monkeypatch.setattr(
        EmailService,
        "_enviar_email",
        staticmethod(lambda *args: emails.append(args) or True),
    )

    enviado = EmailService.enviar_recuperacao_senha(
        "pessoa@example.com", "recovery-token"
    )

    assert enviado is True
    destino, assunto, texto, html = emails[0]
    link = (
        "https://wepay.example.com/redefinir-senha"
        "?token=recovery-token"
    )
    assert destino == "pessoa@example.com"
    assert assunto == "WePay - Recuperação de senha"
    assert link in texto
    assert f"href='{link}'" in html
    assert "30 minutos" in texto
