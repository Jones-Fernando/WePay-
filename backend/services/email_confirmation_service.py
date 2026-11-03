import logging
import secrets
from datetime import datetime, timedelta, timezone

from database.connection import get_connection_context
from models.email_verification_model import EmailVerificationModel
from services.email_service import EmailService
from utils.jwt_utils import token_hash

logger = logging.getLogger(__name__)


class EmailConfirmationService:
    @staticmethod
    def emitir(usuario_id, email, convite=None):
        token = secrets.token_urlsafe(32)
        token_digest = token_hash(token)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).replace(
            tzinfo=None
        )
        EmailVerificationModel.criar(usuario_id, token_digest, expires_at)

        enviado = EmailService.enviar_confirmacao_email(email, token, convite)
        erro = None if enviado else "Falha no envio SMTP"
        if not enviado:
            logger.error(
                "Falha no envio do e-mail de confirmação para usuario_id=%s",
                usuario_id,
            )
        EmailVerificationModel.registrar_entrega(token_digest, enviado, erro)
        return token, enviado

    @staticmethod
    def confirmar(token):
        if not isinstance(token, str) or not token:
            return False

        with get_connection_context() as connection:
            verificacao = EmailVerificationModel.buscar_token_valido(
                token_hash(token), connection
            )
            if not verificacao:
                connection.rollback()
                return False

            confirmado = EmailVerificationModel.marcar_usado(
                verificacao["id"], verificacao["usuario_id"], connection
            )
            if confirmado:
                connection.commit()
            else:
                connection.rollback()
            return confirmado

    @staticmethod
    def reenviar(email, convite=None):
        email_normalizado = email.strip().lower()
        usuario = EmailVerificationModel.usuario_pendente(email_normalizado)
        if not usuario:
            return

        EmailConfirmationService.emitir(
            usuario["id"], usuario["email"], convite
        )
