from datetime import datetime, timedelta, timezone
import secrets

from flask import request

from models.usuario_model import UsuarioModel
from utils.response_utils import ResponseUtils
from utils.password_utils import hash_password
from utils.jwt_utils import token_hash
from database.connection import get_connection_context, cursor_for, fetch_one
from services.email_service import EmailService
from config import Config


class UsuarioController:
    @staticmethod
    def listar():
        busca = request.args.get("busca", "").strip()
        limite = request.args.get("limite", 20)
        try:
            limite = int(limite)
        except (TypeError, ValueError):
            limite = 20
        return ResponseUtils.sucesso(dados=UsuarioModel.listar_todos(busca=busca, limite=limite))

    @staticmethod
    def recuperar_senha():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        if not email:
            return ResponseUtils.erro("O email eh obrigatorio.")

        # Resposta neutra evita revelar se o email existe.
        mensagem = "Se o email estiver cadastrado, enviaremos as instrucoes de recuperacao."
        usuario = UsuarioModel.buscar_por_email(email)
        if not usuario:
            return ResponseUtils.sucesso(mensagem=mensagem)

        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30)
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "UPDATE recuperacao_tokens SET usado_em = CURRENT_TIMESTAMP WHERE usuario_id = ? AND usado_em IS NULL",
                    (usuario["id"],),
                )
                cursor.execute(
                    "INSERT INTO recuperacao_tokens (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)",
                    (usuario["id"], token_hash(token), expires),
                )
                conn.commit()
            finally:
                cursor.close()

        enviado = EmailService.enviar_recuperacao_senha(email, token)
        if not enviado and Config.ENVIRONMENT == "production":
            return ResponseUtils.erro("Nao foi possivel enviar o email de recuperacao.", status=503)

        dados = None
        if Config.ENVIRONMENT != "production":
            dados = {"token_teste": token, "expira_em": expires.isoformat()}

        return ResponseUtils.sucesso(dados=dados, mensagem=mensagem)

    @staticmethod
    def confirmar_recuperacao():
        data = request.get_json(silent=True) or {}
        token = data.get("token")
        nova_senha = data.get("nova_senha")
        if not token or not nova_senha:
            return ResponseUtils.erro("Token e nova senha sao obrigatorios.")
        if not isinstance(nova_senha, str) or len(nova_senha) < 6:
            return ResponseUtils.erro("A nova senha deve ter ao menos 6 caracteres.")

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT id, usuario_id FROM recuperacao_tokens "
                    "WHERE token_hash = ? AND usado_em IS NULL AND expires_at > CURRENT_TIMESTAMP",
                    (token_hash(token),),
                )
                registro = fetch_one(cursor)
                if not registro:
                    return ResponseUtils.erro("Token invalido, expirado ou ja utilizado.", status=400)

                cursor.execute(
                    "UPDATE usuarios SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (hash_password(nova_senha), registro["usuario_id"]),
                )
                cursor.execute(
                    "UPDATE recuperacao_tokens SET usado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (registro["id"],),
                )
                cursor.execute(
                    "UPDATE refresh_tokens SET revogado_em = CURRENT_TIMESTAMP WHERE usuario_id = ? AND revogado_em IS NULL",
                    (registro["usuario_id"],),
                )
                conn.commit()
            finally:
                cursor.close()

        return ResponseUtils.sucesso(mensagem="Senha redefinida com sucesso.")

    @staticmethod
    def testar_email(current_user_id):
        if not Config.ALLOW_EMAIL_TEST or Config.ENVIRONMENT == "production":
            return ResponseUtils.erro("Endpoint de teste de email desabilitado.", status=404)

        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        if not email:
            return ResponseUtils.erro("O email eh obrigatorio para o teste.")

        enviado = EmailService.enviar_email_teste(email)
        if not enviado:
            return ResponseUtils.erro("Nao foi possivel enviar o email de teste.", status=503)
        return ResponseUtils.sucesso(mensagem="Email de teste enviado com sucesso.")
