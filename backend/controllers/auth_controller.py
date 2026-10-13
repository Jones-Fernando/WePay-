from datetime import datetime, timedelta, timezone
import secrets

import jwt
from flask import request

from services.auth_service import AuthService
from services.email_service import EmailService
from utils.response_utils import ResponseUtils
from models.usuario_model import UsuarioModel
from utils.password_utils import hash_password, check_password
from utils.jwt_utils import decode_token, generate_token, generate_refresh_token, token_hash, revoke_token
from database.connection import get_connection_context, cursor_for, fetch_one


class AuthController:
    @staticmethod
    def registrar():
        data = request.get_json(silent=True) or {}
        nome = (data.get("nome") or "").strip()
        email = (data.get("email") or "").strip().lower()
        senha = data.get("senha")

        if not nome or not email or not senha:
            return ResponseUtils.erro("Nome, email e senha sao obrigatorios.")
        if len(nome) < 2:
            return ResponseUtils.erro("Nome deve ter ao menos 2 caracteres.")
        if "@" not in email:
            return ResponseUtils.erro("Email invalido.")
        if not isinstance(senha, str) or len(senha) < 6:
            return ResponseUtils.erro("Senha deve ter ao menos 6 caracteres.")

        _, erro = AuthService.registrar_usuario(nome, email, senha)
        if erro:
            return ResponseUtils.erro(erro, status=409)
        return ResponseUtils.sucesso(mensagem="Usuario criado com sucesso.", status=201)

    @staticmethod
    def login():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        senha = data.get("senha")

        if not email or not senha:
            return ResponseUtils.erro("Email e senha sao obrigatorios.")

        resultado, erro = AuthService.autenticar_usuario(email, senha)
        if erro:
            return ResponseUtils.erro(erro, status=401)

        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        try:
            payload = decode_token(resultado["refresh_token"], expected_type="refresh")
            expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc).replace(tzinfo=None)
        except Exception:
            pass

        try:
            with get_connection_context() as conn:
                cursor = cursor_for(conn)
                try:
                    cursor.execute(
                        "INSERT INTO refresh_tokens (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)",
                        (resultado["user"]["id"], token_hash(resultado["refresh_token"]), expires_at),
                    )
                    conn.commit()
                finally:
                    cursor.close()
        except Exception:
            pass

        return ResponseUtils.sucesso(dados=resultado)

    @staticmethod
    def logout(current_user_id, access_token):
        try:
            payload = decode_token(access_token, expected_type="access")
            revoke_token(payload.get("jti"), "access", datetime.fromtimestamp(payload["exp"], tz=timezone.utc).replace(tzinfo=None))
        except Exception:
            pass

        data = request.get_json(silent=True) or {}
        refresh = data.get("refresh_token")
        if refresh:
            with get_connection_context() as conn:
                cursor = cursor_for(conn)
                try:
                    cursor.execute(
                        "UPDATE refresh_tokens SET revogado_em = CURRENT_TIMESTAMP WHERE usuario_id = ? AND token_hash = ?",
                        (current_user_id, token_hash(refresh)),
                    )
                    conn.commit()
                finally:
                    cursor.close()

        return ResponseUtils.sucesso(mensagem="Logoff realizado com sucesso.")

    @staticmethod
    def refresh():
        data = request.get_json(silent=True) or {}
        refresh_token = data.get("refresh_token")
        if not refresh_token:
            return ResponseUtils.erro("Refresh token nao fornecido.", status=401)

        try:
            payload = decode_token(refresh_token, expected_type="refresh")
            usuario_id = int(payload["sub"])
        except (jwt.PyJWTError, KeyError, TypeError, ValueError):
            return ResponseUtils.erro("Refresh token invalido.", status=401)

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT id FROM refresh_tokens WHERE usuario_id = ? AND token_hash = ? "
                    "AND revogado_em IS NULL AND expires_at > CURRENT_TIMESTAMP",
                    (usuario_id, token_hash(refresh_token)),
                )
                sessao = fetch_one(cursor)
                if not sessao:
                    return ResponseUtils.erro("Refresh token expirado ou revogado.", status=401)

                cursor.execute(
                    "UPDATE refresh_tokens SET revogado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (sessao["id"],),
                )
                novo_access = generate_token(usuario_id)
                novo_refresh = generate_refresh_token(usuario_id)
                novo_payload = decode_token(novo_refresh, expected_type="refresh")
                novo_exp = datetime.fromtimestamp(novo_payload["exp"], tz=timezone.utc).replace(tzinfo=None)
                cursor.execute(
                    "INSERT INTO refresh_tokens (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)",
                    (usuario_id, token_hash(novo_refresh), novo_exp),
                )
                conn.commit()
                return ResponseUtils.sucesso(
                    dados={"token": novo_access, "refresh_token": novo_refresh}
                )
            finally:
                cursor.close()

    @staticmethod
    def perfil(current_user_id):
        usuario = UsuarioModel.buscar_por_id(current_user_id)
        if not usuario:
            return ResponseUtils.erro("Usuario nao encontrado.", status=404)
        return ResponseUtils.sucesso(dados=usuario)

    @staticmethod
    def atualizar(current_user_id):
        data = request.get_json(silent=True) or {}
        nome = (data.get("nome") or "").strip()
        email = (data.get("email") or "").strip().lower()

        if not nome or not email:
            return ResponseUtils.erro("Nome e email sao obrigatorios.")
        if "@" not in email:
            return ResponseUtils.erro("Email invalido.")

        usuario_existente = UsuarioModel.buscar_por_email(email)
        if usuario_existente and int(usuario_existente["id"]) != int(current_user_id):
            return ResponseUtils.erro("Email ja cadastrado por outro usuario.", status=409)

        UsuarioModel.atualizar(current_user_id, nome, email)
        return ResponseUtils.sucesso(mensagem="Perfil atualizado com sucesso.")

    @staticmethod
    def alterar_senha(current_user_id):
        data = request.get_json(silent=True) or {}
        senha_atual = data.get("senha_atual")
        nova_senha = data.get("nova_senha")

        if not senha_atual or not nova_senha:
            return ResponseUtils.erro("Senha atual e nova senha sao obrigatorias.")
        if len(nova_senha) < 6:
            return ResponseUtils.erro("A nova senha deve ter ao menos 6 caracteres.")

        usuario_perfil = UsuarioModel.buscar_por_id(current_user_id)
        if not usuario_perfil:
            return ResponseUtils.erro("Usuario nao encontrado.", status=404)

        usuario = UsuarioModel.buscar_por_email(usuario_perfil["email"])
        if not usuario or not check_password(senha_atual, usuario["senha"]):
            return ResponseUtils.erro("Senha atual invalida.", status=401)

        UsuarioModel.atualizar_senha(current_user_id, hash_password(nova_senha))
        return ResponseUtils.sucesso(mensagem="Senha atualizada com sucesso.")

    @staticmethod
    def esqueci_senha():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return ResponseUtils.erro("Email invalido.")

        usuario = UsuarioModel.buscar_por_email(email)
        if usuario:
            token = secrets.token_urlsafe(32)
            expira_em = datetime.now(timezone.utc) + timedelta(minutes=30)
            with get_connection_context() as conn:
                cursor = cursor_for(conn)
                try:
                    cursor.execute(
                        "INSERT INTO recuperacao_tokens (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)",
                        (usuario["id"], token_hash(token), expira_em.replace(tzinfo=None)),
                    )
                    conn.commit()
                finally:
                    cursor.close()
            EmailService.enviar_recuperacao_senha(email, token)

        return ResponseUtils.sucesso(mensagem="Se o e-mail estiver cadastrado, voce recebera as instrucoes.")

    @staticmethod
    def deletar(current_user_id):
        UsuarioModel.deletar(current_user_id)
        return ResponseUtils.sucesso(mensagem="Conta excluida com sucesso.")
