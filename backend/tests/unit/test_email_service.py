from services.email_service import EmailService


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


def test_email_confirmation_contains_clickable_web_link(monkeypatch):
    emails = []
    monkeypatch.setattr(
        "services.email_service.Config.FRONTEND_URL",
        "https://wepay.example.com",
    )
    monkeypatch.setattr(
        EmailService,
        "_enviar_email",
        staticmethod(lambda *args: emails.append(args) or True),
    )

    enviado = EmailService.enviar_confirmacao_email(
        "pessoa@example.com", "confirmation-token"
    )

    assert enviado is True
    _, _, texto, html = emails[0]
    link = (
        "https://wepay.example.com/verificar-email"
        "?token=confirmation-token"
    )
    assert link in texto
    assert f"href='{link}'" in html


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
