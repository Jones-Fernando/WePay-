from flask import request

from config import Config
from services.email_service import EmailService
from utils.response_utils import ResponseUtils


class UsuarioController:
    @staticmethod
    def testar_email(current_user_id):
        if not Config.ALLOW_EMAIL_TEST or Config.ENVIRONMENT == "production":
            return ResponseUtils.erro(
                "Endpoint de teste de email desabilitado.",
                status=404,
            )

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        email_value = data.get("email")
        if not isinstance(email_value, str):
            return ResponseUtils.erro("O email eh obrigatorio para o teste.")
        email = email_value.strip().lower()
        if not email:
            return ResponseUtils.erro("O email eh obrigatorio para o teste.")

        enviado = EmailService.enviar_email_teste(email)
        if not enviado:
            return ResponseUtils.erro(
                "Nao foi possivel enviar o email de teste.",
                status=503,
            )
        return ResponseUtils.sucesso(mensagem="Email de teste enviado com sucesso.")
