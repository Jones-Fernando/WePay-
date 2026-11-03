from services.email_confirmation_service import EmailConfirmationService
from models.email_verification_model import EmailVerificationModel


def test_resend_normalizes_email_and_preserves_invitation(monkeypatch):
    chamadas = []
    monkeypatch.setattr(
        EmailVerificationModel,
        "usuario_pendente",
        staticmethod(lambda email: {"id": 7, "email": email}),
    )
    monkeypatch.setattr(
        EmailConfirmationService,
        "emitir",
        staticmethod(lambda *args: chamadas.append(args)),
    )

    EmailConfirmationService.reenviar(" Pessoa@Exemplo.com ", "token-convite")

    assert chamadas == [(7, "pessoa@exemplo.com", "token-convite")]
