from datetime import datetime, timedelta, timezone
import secrets

from flask import request

from config import Config
from database.connection import get_connection_context, cursor_for, fetch_one
from models.participante_model import ParticipanteModel
from models.grupo_model import GrupoModel
from models.usuario_model import UsuarioModel
from services.email_service import EmailService
from services.financeiro_service import FinanceiroService, money
from utils.jwt_utils import token_hash
from utils.response_utils import ResponseUtils
from utils.validators import parse_pagination, parse_positive_int


def _is_admin(grupo_id, usuario_id):
    participante = ParticipanteModel.buscar(grupo_id, usuario_id)
    return bool(participante and participante.get("papel") == "admin")


def _is_admin_in_connection(conn, grupo_id, usuario_id):
    cursor = cursor_for(conn)
    try:
        cursor.execute(
            "SELECT id FROM participantes "
            "WHERE grupo_id = ? AND usuario_id = ? AND papel = 'admin' "
            "AND ativo = 1 FOR UPDATE",
            (grupo_id, usuario_id),
        )
        return fetch_one(cursor) is not None
    finally:
        cursor.close()


class ParticipanteController:
    @staticmethod
    def adicionar(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        if data.get("grupo_id") in (None, "") or data.get("usuario_id") in (None, ""):
            return ResponseUtils.erro("grupo_id e usuario_id sao obrigatorios.")
        try:
            grupo_id = parse_positive_int(data["grupo_id"], "grupo_id")
            usuario_id = parse_positive_int(data["usuario_id"], "usuario_id")
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        if not GrupoModel.buscar_por_id(grupo_id):
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not UsuarioModel.buscar_por_id(usuario_id):
            return ResponseUtils.erro("Usuario nao encontrado.", status=404)

        with get_connection_context() as conn:
            try:
                FinanceiroService.lock_group(conn, grupo_id)
            except LookupError:
                return ResponseUtils.erro("Grupo nao encontrado.", status=404)
            if not _is_admin_in_connection(conn, grupo_id, current_user_id):
                return ResponseUtils.erro(
                    "Apenas administradores podem adicionar participantes.",
                    status=403,
                )
            ParticipanteModel.adicionar(grupo_id, usuario_id, conn=conn)
            conn.commit()
        return ResponseUtils.sucesso(mensagem="Participante adicionado.", status=201)

    @staticmethod
    def listar(current_user_id, grupo_id):
        try:
            limit, offset = parse_pagination(
                request.args.get("limit"), request.args.get("offset")
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        if not GrupoModel.buscar_por_id(grupo_id):
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        dados, paginacao = ParticipanteModel.listar_por_grupo_paginado(
            grupo_id, limit, offset
        )
        return ResponseUtils.sucesso(dados=dados, paginacao=paginacao)

    @staticmethod
    def buscar(current_user_id, participante_id):
        participante = ParticipanteModel.buscar_por_id(participante_id)
        if not participante:
            return ResponseUtils.erro("Participante nao encontrado.", status=404)
        if not ParticipanteModel.buscar(participante["grupo_id"], current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        usuario = UsuarioModel.buscar_por_id(
            participante["usuario_id"], incluir_excluido=True
        )
        dados = {
            **participante,
            "ativo": (
                0
                if usuario and usuario["email"] is None
                else participante["ativo"]
            ),
            "usuario": usuario,
        }
        return ResponseUtils.sucesso(dados=dados)

    @staticmethod
    def atualizar(current_user_id, participante_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        papel = data.get("papel")
        if not isinstance(papel, str) or papel not in {"admin", "participante"}:
            return ResponseUtils.erro("Papel invalido. Use admin ou participante.")

        participante = ParticipanteModel.buscar_por_id(participante_id)
        if not participante:
            return ResponseUtils.erro("Participante nao encontrado.", status=404)
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                grupo_id = participante["grupo_id"]
                FinanceiroService.lock_group(conn, grupo_id)
                cursor.execute(
                    "SELECT usuario_id FROM participantes WHERE id = ? FOR UPDATE",
                    (participante_id,),
                )
                participante_atual = fetch_one(cursor)
                if not participante_atual:
                    return ResponseUtils.erro(
                        "Participante nao encontrado.", status=404
                    )
                if not _is_admin_in_connection(conn, grupo_id, current_user_id):
                    return ResponseUtils.erro(
                        "Apenas administradores podem alterar permissoes.",
                        status=403,
                    )
                cursor.execute(
                    "SELECT criado_por FROM grupos WHERE id = ?", (grupo_id,)
                )
                grupo_atualizar = fetch_one(cursor)
                if not grupo_atualizar:
                    return ResponseUtils.erro("Grupo nao encontrado.", status=404)
                if int(participante_atual["usuario_id"]) == int(
                    grupo_atualizar["criado_por"]
                ):
                    return ResponseUtils.erro(
                        "O criador do grupo deve continuar como administrador.",
                        status=400,
                    )
                if papel == "admin" and not UsuarioModel.buscar_por_id(
                    participante_atual["usuario_id"]
                ):
                    return ResponseUtils.erro(
                        "Uma conta excluida nao pode ser administradora.",
                        status=400,
                    )
                cursor.execute(
                    "UPDATE participantes SET papel = ? WHERE id = ?",
                    (papel, participante_id),
                )
                conn.commit()
            finally:
                cursor.close()
        return ResponseUtils.sucesso(mensagem="Permissao atualizada.")

    @staticmethod
    def remover(current_user_id, participante_id):
        participante = ParticipanteModel.buscar_por_id(participante_id)
        if not participante:
            return ResponseUtils.erro("Participante nao encontrado.", status=404)

        grupo_id = participante["grupo_id"]
        with get_connection_context() as conn:
            try:
                FinanceiroService.lock_group(conn, grupo_id)
            except LookupError:
                return ResponseUtils.erro("Grupo nao encontrado.", status=404)
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT usuario_id FROM participantes WHERE id = ? FOR UPDATE",
                    (participante_id,),
                )
                participante_atual = fetch_one(cursor)
                if not participante_atual:
                    return ResponseUtils.erro(
                        "Participante nao encontrado.", status=404
                    )
                if not _is_admin_in_connection(conn, grupo_id, current_user_id):
                    return ResponseUtils.erro(
                        "Apenas administradores podem remover participantes.",
                        status=403,
                    )
                cursor.execute(
                    "SELECT criado_por FROM grupos WHERE id = ?", (grupo_id,)
                )
                grupo = fetch_one(cursor)
                if not grupo:
                    return ResponseUtils.erro("Grupo nao encontrado.", status=404)
                if int(participante_atual["usuario_id"]) == int(grupo["criado_por"]):
                    return ResponseUtils.erro(
                        "O criador do grupo nao pode ser removido.", status=400
                    )

                cursor.execute(
                    "SELECT saldo FROM saldos WHERE grupo_id = ? AND usuario_id = ?",
                    (grupo_id, participante_atual["usuario_id"]),
                )
                saldo = money((fetch_one(cursor) or {}).get("saldo", 0))
                if abs(saldo) > money("0.00"):
                    conn.rollback()
                    return ResponseUtils.erro(
                        "O participante possui saldo pendente. Quite a divida antes de removê-lo.",
                        status=409,
                    )
                ParticipanteModel.remover_por_id(participante_id, conn=conn)
                conn.commit()
            finally:
                cursor.close()
        return ResponseUtils.sucesso(mensagem="Participante removido.")

    @staticmethod
    def convidar(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        if data.get("grupo_id") in (None, ""):
            return ResponseUtils.erro("grupo_id e email sao obrigatorios.")
        try:
            grupo_id = parse_positive_int(data["grupo_id"], "grupo_id")
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        email_value = data.get("email")
        if not isinstance(email_value, str) or not email_value.strip():
            return ResponseUtils.erro("grupo_id e email sao obrigatorios.")
        email = email_value.strip().lower()

        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                try:
                    FinanceiroService.lock_group(conn, grupo_id)
                except LookupError:
                    return ResponseUtils.erro("Grupo nao encontrado.", status=404)
                if not _is_admin_in_connection(conn, grupo_id, current_user_id):
                    return ResponseUtils.erro(
                        "Apenas administradores podem enviar convites.", status=403
                    )

                cursor.execute("SELECT nome FROM grupos WHERE id = ?", (grupo_id,))
                grupo = fetch_one(cursor)
                if not grupo:
                    return ResponseUtils.erro("Grupo nao encontrado.", status=404)

                cursor.execute(
                    "SELECT id FROM usuarios WHERE LOWER(email) = LOWER(?) "
                    "AND excluido_em IS NULL",
                    (email,),
                )
                usuario = fetch_one(cursor)
                if usuario:
                    cursor.execute(
                        "SELECT id FROM participantes "
                        "WHERE grupo_id = ? AND usuario_id = ? AND ativo = 1",
                        (grupo_id, usuario["id"]),
                    )
                    if fetch_one(cursor):
                        return ResponseUtils.erro(
                            "Este usuario ja participa do grupo.", status=409
                        )

                cursor.execute(
                    "UPDATE convites_grupo SET usado_em = CURRENT_TIMESTAMP WHERE grupo_id = ? AND email = ? AND usado_em IS NULL",
                    (grupo_id, email),
                )
                cursor.execute(
                    "INSERT INTO convites_grupo (grupo_id, email, token_hash, expires_at, criado_por) VALUES (?, ?, ?, ?, ?)",
                    (grupo_id, email, token_hash(token), expires, current_user_id),
                )
                conn.commit()
            finally:
                cursor.close()

        enviado = EmailService.enviar_convite(email, grupo["nome"], token)
        if not enviado and Config.ENVIRONMENT == "production":
            return ResponseUtils.erro("Nao foi possivel enviar o convite por email.", status=503)

        data_retorno = {
            "email": email,
            "expires_at": expires.isoformat(),
            "email_enviado": enviado,
        }
        if Config.ENVIRONMENT == "testing":
            data_retorno["token_teste"] = token
        return ResponseUtils.sucesso(
            dados=data_retorno,
            mensagem=(
                "Convite enviado por e-mail."
                if enviado
                else "Convite criado, mas o e-mail não foi enviado. Verifique a configuração SMTP."
            ),
            status=201,
        )

    @staticmethod
    def aceitar_convite(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        token = data.get("token")
        if not isinstance(token, str) or not token:
            return ResponseUtils.erro("Token do convite eh obrigatorio.")

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT id, grupo_id, email FROM convites_grupo "
                    "WHERE token_hash = ? AND usado_em IS NULL AND expires_at > CURRENT_TIMESTAMP",
                    (token_hash(token),),
                )
                convite = fetch_one(cursor)
                if not convite:
                    return ResponseUtils.erro("Convite invalido, expirado ou ja utilizado.", status=400)

                try:
                    FinanceiroService.lock_group(conn, convite["grupo_id"])
                except LookupError:
                    return ResponseUtils.erro(
                        "Convite invalido, expirado ou ja utilizado.", status=400
                    )
                cursor.execute(
                    "SELECT id, grupo_id, email FROM convites_grupo "
                    "WHERE id = ? AND usado_em IS NULL "
                    "AND expires_at > CURRENT_TIMESTAMP FOR UPDATE",
                    (convite["id"],),
                )
                convite = fetch_one(cursor)
                if not convite:
                    return ResponseUtils.erro(
                        "Convite invalido, expirado ou ja utilizado.", status=400
                    )
                cursor.execute("SELECT email FROM usuarios WHERE id = ?", (current_user_id,))
                usuario = fetch_one(cursor)
                if not usuario or usuario["email"].lower() != convite["email"].lower():
                    return ResponseUtils.erro("O convite nao pertence ao email desta conta.", status=403)

                ParticipanteModel.adicionar(convite["grupo_id"], current_user_id, "participante", conn)
                cursor.execute(
                    "UPDATE convites_grupo SET usado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (convite["id"],),
                )
                conn.commit()
                return ResponseUtils.sucesso(mensagem="Voce entrou no grupo.")
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()
