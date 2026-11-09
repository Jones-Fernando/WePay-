from datetime import datetime, timedelta, timezone
import secrets

import jwt
from flask import current_app, request

from config import Config

from services.auth_service import AuthService
from services.email_service import EmailService
from utils.response_utils import ResponseUtils
from models.usuario_model import UsuarioModel
from utils.password_utils import hash_password, check_password, validar_senha
from utils.jwt_utils import decode_token, generate_token, generate_refresh_token, token_hash
from database.connection import (
    cursor_for,
    fetch_all,
    fetch_one,
    get_connection_context,
)


def _json_object():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return None
    return data


def _origem_web_permitida():
    return request.headers.get("Origin") in Config.CORS_ORIGINS


def _definir_cookie_refresh(resposta, token):
    resposta.set_cookie(
        Config.AUTH_REFRESH_COOKIE_NAME,
        token,
        max_age=Config.JWT_REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=Config.AUTH_REFRESH_COOKIE_SECURE,
        samesite=Config.AUTH_REFRESH_COOKIE_SAMESITE,
        path="/api/auth",
    )
    return resposta


def _remover_cookie_refresh(resposta):
    resposta.delete_cookie(
        Config.AUTH_REFRESH_COOKIE_NAME,
        httponly=True,
        secure=Config.AUTH_REFRESH_COOKIE_SECURE,
        samesite=Config.AUTH_REFRESH_COOKIE_SAMESITE,
        path="/api/auth",
    )
    return resposta


def _erro_refresh(mensagem, status, limpar_cookie=False):
    resposta = ResponseUtils.erro(mensagem, status=status)[0]
    if limpar_cookie:
        _remover_cookie_refresh(resposta)
    return resposta, status


class AuthController:
    @staticmethod
    def registrar():
        data = _json_object()
        if data is None:
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        nome_value = data.get("nome")
        email_value = data.get("email")
        senha = data.get("senha")

        if not isinstance(nome_value, str) or not isinstance(email_value, str):
            return ResponseUtils.erro("Nome, email e senha sao obrigatorios.")
        nome = nome_value.strip()
        email = email_value.strip().lower()
        if not nome or not email or not senha:
            return ResponseUtils.erro("Nome, email e senha sao obrigatorios.")
        if not isinstance(senha, str):
            return ResponseUtils.erro("Nome, email e senha sao obrigatorios.")
        if len(nome) < 2:
            return ResponseUtils.erro("Nome deve ter ao menos 2 caracteres.")
        if "@" not in email:
            return ResponseUtils.erro("Email invalido.")
        erro_senha = validar_senha(senha)
        if erro_senha:
            return ResponseUtils.erro(erro_senha)

        usuario_id, erro = AuthService.registrar_usuario(nome, email, senha)
        if erro:
            return ResponseUtils.erro(erro, status=409)
        return ResponseUtils.sucesso(
            mensagem="Conta criada com sucesso. Você já pode entrar.",
            status=201,
        )

    @staticmethod
    def login():
        data = _json_object()
        if data is None:
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        email_value = data.get("email")
        senha = data.get("senha")

        if not isinstance(email_value, str) or not isinstance(senha, str):
            return ResponseUtils.erro("Email e senha sao obrigatorios.")
        email = email_value.strip().lower()
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
            current_app.logger.exception(
                "Falha ao decodificar refresh token durante login (usuario_id=%s).",
                resultado["user"]["id"],
            )
            return ResponseUtils.erro("Nao foi possivel iniciar a sessao.", status=500)

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
            current_app.logger.exception(
                "Falha ao persistir refresh token durante login (usuario_id=%s).",
                resultado["user"]["id"],
            )
            return ResponseUtils.erro("Nao foi possivel iniciar a sessao.", status=500)

        if data.get("web") is True:
            resposta = ResponseUtils.sucesso(
                dados={"token": resultado["token"], "user": resultado["user"]}
            )[0]
            return _definir_cookie_refresh(resposta, resultado["refresh_token"])
        return ResponseUtils.sucesso(dados=resultado)

    @staticmethod
    def logout(current_user_id, access_token):
        payload = decode_token(access_token, expected_type="access")
        data = _json_object()
        if data is None:
            if request.get_data(cache=True):
                return ResponseUtils.erro("Corpo da requisicao invalido.")
            data = {}
        refresh = data.get("refresh_token")
        cookie_refresh = request.cookies.get(Config.AUTH_REFRESH_COOKIE_NAME)
        if cookie_refresh and not _origem_web_permitida():
            return ResponseUtils.erro("Origem da requisicao invalida.", status=403)
        refresh = refresh or cookie_refresh
        push_token = data.get("expo_push_token")
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "DELETE FROM revoked_tokens WHERE expires_at < CURRENT_TIMESTAMP"
                )
                cursor.execute(
                    "INSERT INTO revoked_tokens (jti, token_type, expires_at) "
                    "VALUES (?, 'access', ?)",
                    (
                        payload["jti"],
                        datetime.fromtimestamp(
                            payload["exp"], tz=timezone.utc
                        ).replace(tzinfo=None),
                    ),
                )
                if isinstance(refresh, str) and refresh:
                    cursor.execute(
                        "UPDATE refresh_tokens "
                        "SET revogado_em = CURRENT_TIMESTAMP "
                        "WHERE usuario_id = ? AND token_hash = ? "
                        "AND revogado_em IS NULL",
                        (current_user_id, token_hash(refresh)),
                    )
                if isinstance(push_token, str) and push_token:
                    cursor.execute(
                        "DELETE FROM expo_push_tokens "
                        "WHERE usuario_id = ? AND token = ?",
                        (current_user_id, push_token),
                    )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

        resposta = ResponseUtils.sucesso(
            mensagem="Logoff realizado com sucesso."
        )[0]
        if cookie_refresh:
            return _remover_cookie_refresh(resposta)
        return resposta, 200

    @staticmethod
    def refresh():
        data = request.get_json(silent=True)
        if data is not None and not isinstance(data, dict):
            return ResponseUtils.erro("Refresh token invalido.", status=401)
        data = data or {}
        refresh_token = data.get("refresh_token")
        cookie_refresh = request.cookies.get(Config.AUTH_REFRESH_COOKIE_NAME)
        usa_cookie = not refresh_token and cookie_refresh not in (None, "")
        if usa_cookie and not _origem_web_permitida():
            resposta = ResponseUtils.erro(
                "Origem da requisicao invalida.", status=403
            )[0]
            return _remover_cookie_refresh(resposta), 403
        refresh_token = refresh_token or cookie_refresh
        if not isinstance(refresh_token, str) or not refresh_token:
            return _erro_refresh(
                "Refresh token nao fornecido.", 401, limpar_cookie=usa_cookie
            )

        try:
            payload = decode_token(refresh_token, expected_type="refresh")
            usuario_id = int(payload["sub"])
            auth_version = int(payload.get("auth_version", 0))
            if auth_version < 0:
                raise ValueError("Versao de autenticacao invalida.")
        except (jwt.PyJWTError, KeyError, TypeError, ValueError):
            return _erro_refresh(
                "Refresh token invalido.", 401, limpar_cookie=usa_cookie
            )

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT auth_version FROM usuarios "
                    "WHERE id = ? AND excluido_em IS NULL FOR UPDATE",
                    (usuario_id,),
                )
                usuario = fetch_one(cursor)
                if not usuario or int(usuario["auth_version"]) != auth_version:
                    return _erro_refresh(
                        "Refresh token expirado ou revogado.",
                        401,
                        limpar_cookie=usa_cookie,
                    )

                cursor.execute(
                    "SELECT id FROM refresh_tokens WHERE usuario_id = ? AND token_hash = ? "
                    "AND revogado_em IS NULL AND expires_at > CURRENT_TIMESTAMP "
                    "FOR UPDATE",
                    (usuario_id, token_hash(refresh_token)),
                )
                sessao = fetch_one(cursor)
                if not sessao:
                    return _erro_refresh(
                        "Refresh token expirado ou revogado.",
                        401,
                        limpar_cookie=usa_cookie,
                    )

                cursor.execute(
                    "UPDATE refresh_tokens SET revogado_em = CURRENT_TIMESTAMP "
                    "WHERE id = ? AND revogado_em IS NULL",
                    (sessao["id"],),
                )
                if cursor.rowcount != 1:
                    conn.rollback()
                    return _erro_refresh(
                        "Refresh token expirado ou revogado.",
                        401,
                        limpar_cookie=usa_cookie,
                    )
                novo_access = generate_token(usuario_id, int(usuario["auth_version"]))
                novo_refresh = generate_refresh_token(
                    usuario_id, int(usuario["auth_version"])
                )
                novo_payload = decode_token(novo_refresh, expected_type="refresh")
                novo_exp = datetime.fromtimestamp(novo_payload["exp"], tz=timezone.utc).replace(tzinfo=None)
                cursor.execute(
                    "INSERT INTO refresh_tokens (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)",
                    (usuario_id, token_hash(novo_refresh), novo_exp),
                )
                conn.commit()
                dados = {"token": novo_access}
                if not usa_cookie:
                    dados["refresh_token"] = novo_refresh
                resposta = ResponseUtils.sucesso(dados=dados)[0]
                if usa_cookie:
                    return _definir_cookie_refresh(resposta, novo_refresh)
                return resposta, 200
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
        data = _json_object()
        if data is None:
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        nome_value = data.get("nome")
        email_value = data.get("email")
        telefone_value = data.get("telefone")
        if not isinstance(nome_value, str) or not isinstance(email_value, str):
            return ResponseUtils.erro("Nome e email sao obrigatorios.")
        if telefone_value is not None and not isinstance(telefone_value, str):
            return ResponseUtils.erro("Telefone deve ser um texto.")
        nome = nome_value.strip()
        email = email_value.strip().lower()
        telefone = telefone_value.strip() or None if telefone_value else None

        if not nome or not email:
            return ResponseUtils.erro("Nome e email sao obrigatorios.")
        if "@" not in email:
            return ResponseUtils.erro("Email invalido.")

        usuario_existente = UsuarioModel.buscar_por_email(email)
        if usuario_existente and int(usuario_existente["id"]) != int(current_user_id):
            return ResponseUtils.erro("Email ja cadastrado por outro usuario.", status=409)

        UsuarioModel.atualizar(current_user_id, nome, email, telefone)
        return ResponseUtils.sucesso(mensagem="Perfil atualizado com sucesso.")

    @staticmethod
    def alterar_senha(current_user_id):
        data = _json_object()
        if data is None:
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        senha_atual = data.get("senha_atual")
        nova_senha = data.get("nova_senha")

        if not isinstance(senha_atual, str) or not senha_atual:
            return ResponseUtils.erro("Senha atual e nova senha sao obrigatorias.")
        erro_senha = validar_senha(nova_senha)
        if erro_senha:
            return ResponseUtils.erro(erro_senha)

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT senha FROM usuarios WHERE id = ? FOR UPDATE",
                    (current_user_id,),
                )
                usuario = fetch_one(cursor)
                if not usuario:
                    return ResponseUtils.erro("Usuario nao encontrado.", status=404)
                if not check_password(senha_atual, usuario["senha"]):
                    return ResponseUtils.erro("Senha atual invalida.", status=401)

                UsuarioModel.atualizar_senha(
                    current_user_id, hash_password(nova_senha), conn
                )
                cursor.execute(
                    "UPDATE refresh_tokens SET revogado_em = CURRENT_TIMESTAMP "
                    "WHERE usuario_id = ? AND revogado_em IS NULL",
                    (current_user_id,),
                )
                cursor.execute(
                    "UPDATE recuperacao_tokens SET usado_em = CURRENT_TIMESTAMP "
                    "WHERE usuario_id = ? AND usado_em IS NULL",
                    (current_user_id,),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()
        return ResponseUtils.sucesso(mensagem="Senha atualizada com sucesso.")

    @staticmethod
    def esqueci_senha():
        data = _json_object()
        if data is None:
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        email_value = data.get("email")
        if not isinstance(email_value, str):
            return ResponseUtils.erro("Email invalido.")
        email = email_value.strip().lower()
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
                        "SELECT id FROM usuarios WHERE id = ? FOR UPDATE",
                        (usuario["id"],),
                    )
                    if not fetch_one(cursor):
                        return ResponseUtils.sucesso(
                            mensagem="Se o e-mail estiver cadastrado, voce recebera as instrucoes."
                        )
                    cursor.execute(
                        "UPDATE recuperacao_tokens SET usado_em = CURRENT_TIMESTAMP "
                        "WHERE usuario_id = ? AND usado_em IS NULL",
                        (usuario["id"],),
                    )
                    cursor.execute(
                        "INSERT INTO recuperacao_tokens (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)",
                        (usuario["id"], token_hash(token), expira_em.replace(tzinfo=None)),
                    )
                    conn.commit()
                finally:
                    cursor.close()
            EmailService.enviar_recuperacao_senha(email, token)
            dados = {"token_teste": token} if Config.ENVIRONMENT == "testing" else None
            return ResponseUtils.sucesso(
                dados=dados,
                mensagem="Se o e-mail estiver cadastrado, voce recebera as instrucoes.",
            )

        return ResponseUtils.sucesso(mensagem="Se o e-mail estiver cadastrado, voce recebera as instrucoes.")

    @staticmethod
    def redefinir_senha():
        data = _json_object()
        if data is None:
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        token = data.get("token")
        nova_senha = data.get("nova_senha")
        if not isinstance(token, str) or not token:
            return ResponseUtils.erro("Token e nova senha sao obrigatorios.")
        erro_senha = validar_senha(nova_senha)
        if erro_senha:
            return ResponseUtils.erro(erro_senha)

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT id, usuario_id FROM recuperacao_tokens "
                    "WHERE token_hash = ? AND usado_em IS NULL AND expires_at > CURRENT_TIMESTAMP",
                    (token_hash(token),),
                )
                recuperacao = fetch_one(cursor)
                if not recuperacao:
                    return ResponseUtils.erro("Token invalido, expirado ou ja utilizado.", status=400)

                cursor.execute(
                    "SELECT id FROM usuarios WHERE id = ? FOR UPDATE",
                    (recuperacao["usuario_id"],),
                )
                if not fetch_one(cursor):
                    return ResponseUtils.erro(
                        "Token invalido, expirado ou ja utilizado.", status=400
                    )
                cursor.execute(
                    "UPDATE recuperacao_tokens SET usado_em = CURRENT_TIMESTAMP "
                    "WHERE id = ? AND usado_em IS NULL "
                    "AND expires_at > CURRENT_TIMESTAMP",
                    (recuperacao["id"],),
                )
                if cursor.rowcount != 1:
                    return ResponseUtils.erro(
                        "Token invalido, expirado ou ja utilizado.", status=400
                    )

                UsuarioModel.atualizar_senha(
                    recuperacao["usuario_id"], hash_password(nova_senha), conn
                )
                cursor.execute(
                    "UPDATE refresh_tokens SET revogado_em = CURRENT_TIMESTAMP "
                    "WHERE usuario_id = ? AND revogado_em IS NULL",
                    (recuperacao["usuario_id"],),
                )
                cursor.execute(
                    "UPDATE recuperacao_tokens SET usado_em = CURRENT_TIMESTAMP "
                    "WHERE usuario_id = ? AND usado_em IS NULL",
                    (recuperacao["usuario_id"],),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()
        return ResponseUtils.sucesso(mensagem="Senha redefinida com sucesso.")

    @staticmethod
    def deletar(current_user_id):
        data = _json_object()
        if data is None:
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        senha_atual = data.get("senha_atual")
        if not isinstance(senha_atual, str) or not senha_atual:
            return ResponseUtils.erro("A senha atual eh obrigatoria.")

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT email, senha FROM usuarios "
                    "WHERE id = ? AND excluido_em IS NULL FOR UPDATE",
                    (current_user_id,),
                )
                usuario = fetch_one(cursor)
                if not usuario:
                    return ResponseUtils.erro("Usuario nao encontrado.", status=404)
                if not check_password(senha_atual, usuario["senha"]):
                    return ResponseUtils.erro("Senha atual invalida.", status=401)

                cursor.execute(
                    "SELECT id FROM grupos WHERE criado_por = ? FOR UPDATE",
                    (current_user_id,),
                )
                grupos = fetch_all(cursor)
                for grupo in grupos:
                    cursor.execute(
                        """
                        SELECT p.usuario_id
                        FROM participantes p
                        JOIN usuarios u ON u.id = p.usuario_id
                        WHERE p.grupo_id = ?
                          AND p.usuario_id <> ?
                          AND p.ativo = 1
                          AND u.excluido_em IS NULL
                        ORDER BY CASE WHEN p.papel = 'admin' THEN 0 ELSE 1 END,
                                 p.criado_em, p.id
                        LIMIT 1
                        FOR UPDATE
                        """,
                        (grupo["id"], current_user_id),
                    )
                    sucessor = fetch_one(cursor)
                    if sucessor:
                        cursor.execute(
                            "UPDATE participantes SET papel = 'admin' "
                            "WHERE grupo_id = ? AND usuario_id = ? AND ativo = 1",
                            (grupo["id"], sucessor["usuario_id"]),
                        )
                        cursor.execute(
                            "UPDATE grupos SET criado_por = ? "
                            "WHERE id = ? AND criado_por = ?",
                            (sucessor["usuario_id"], grupo["id"], current_user_id),
                        )
                        continue

                    cursor.execute(
                        """
                        SELECT COUNT(DISTINCT p.usuario_id) AS total
                        FROM participantes p
                        JOIN usuarios u ON u.id = p.usuario_id
                        WHERE p.grupo_id = ?
                          AND p.usuario_id <> ?
                          AND p.ativo = 1
                          AND u.excluido_em IS NULL
                        """,
                        (grupo["id"], current_user_id),
                    )
                    outros_participantes = fetch_one(cursor)
                    if not int(outros_participantes["total"]):
                        cursor.execute(
                            "DELETE FROM grupos WHERE id = ?",
                            (grupo["id"],),
                        )

                cursor.execute(
                    "DELETE FROM convites_grupo "
                    "WHERE criado_por = ? OR LOWER(email) = LOWER(?)",
                    (current_user_id, usuario["email"]),
                )
                for query in (
                    "DELETE FROM despesas_pessoais WHERE usuario_id = ?",
                    "DELETE FROM categorias WHERE usuario_id = ?",
                    "DELETE FROM notificacoes WHERE usuario_id = ?",
                    "DELETE FROM expo_push_tokens WHERE usuario_id = ?",
                    "DELETE FROM refresh_tokens WHERE usuario_id = ?",
                    "DELETE FROM recuperacao_tokens WHERE usuario_id = ?",
                ):
                    cursor.execute(
                        query,
                        (current_user_id,),
                    )

                cursor.execute(
                    "SELECT grupo_id FROM participantes "
                    "WHERE usuario_id = ? AND ativo = 1 AND papel = 'admin' "
                    "FOR UPDATE",
                    (current_user_id,),
                )
                grupos_admin = fetch_all(cursor)
                grupos_proprios = {int(grupo["id"]) for grupo in grupos}
                for grupo_admin in grupos_admin:
                    grupo_id = int(grupo_admin["grupo_id"])
                    if grupo_id in grupos_proprios:
                        continue
                    cursor.execute(
                        """
                        SELECT p.usuario_id
                        FROM participantes p
                        JOIN usuarios u ON u.id = p.usuario_id
                        WHERE p.grupo_id = ?
                          AND p.usuario_id <> ?
                          AND p.ativo = 1
                          AND p.papel = 'admin'
                          AND u.excluido_em IS NULL
                        LIMIT 1
                        FOR UPDATE
                        """,
                        (grupo_id, current_user_id),
                    )
                    if fetch_one(cursor):
                        continue
                    cursor.execute(
                        """
                        SELECT p.usuario_id
                        FROM participantes p
                        JOIN usuarios u ON u.id = p.usuario_id
                        WHERE p.grupo_id = ?
                          AND p.usuario_id <> ?
                          AND p.ativo = 1
                          AND u.excluido_em IS NULL
                        ORDER BY p.criado_em, p.id
                        LIMIT 1
                        FOR UPDATE
                        """,
                        (grupo_id, current_user_id),
                    )
                    sucessor = fetch_one(cursor)
                    if sucessor:
                        cursor.execute(
                            "UPDATE participantes SET papel = 'admin' "
                            "WHERE grupo_id = ? AND usuario_id = ? AND ativo = 1",
                            (grupo_id, sucessor["usuario_id"]),
                        )
                    else:
                        cursor.execute(
                            "DELETE FROM grupos WHERE id = ?",
                            (grupo_id,),
                        )

                cursor.execute(
                    "UPDATE participantes SET papel = 'participante' "
                    "WHERE usuario_id = ?",
                    (current_user_id,),
                )
                email_anonimo = f"excluido+{current_user_id}@deleted.invalid"
                if UsuarioModel.anonimizar(
                    current_user_id,
                    email_anonimo,
                    hash_password(secrets.token_urlsafe(48)),
                    conn,
                ) != 1:
                    conn.rollback()
                    return ResponseUtils.erro("Usuario nao encontrado.", status=404)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

        return ResponseUtils.sucesso(mensagem="Conta excluida com sucesso.")
