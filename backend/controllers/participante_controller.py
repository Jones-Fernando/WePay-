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


def _is_admin(grupo_id, usuario_id):
    participante = ParticipanteModel.buscar(grupo_id, usuario_id)
    return bool(participante and participante.get("papel") == "admin")


class ParticipanteController:
    @staticmethod
    def adicionar(current_user_id):
        data = request.get_json(silent=True) or {}
        grupo_id = data.get("grupo_id")
        usuario_id = data.get("usuario_id")

        if not grupo_id or not usuario_id:
            return ResponseUtils.erro("grupo_id e usuario_id sao obrigatorios.")
        if not _is_admin(grupo_id, current_user_id):
            return ResponseUtils.erro("Apenas administradores podem adicionar participantes.", status=403)
        if not GrupoModel.buscar_por_id(grupo_id):
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not UsuarioModel.buscar_por_id(usuario_id):
            return ResponseUtils.erro("Usuario nao encontrado.", status=404)

        ParticipanteModel.adicionar(grupo_id, usuario_id)
        return ResponseUtils.sucesso(mensagem="Participante adicionado.", status=201)

    @staticmethod
    def listar(current_user_id, grupo_id):
        if not GrupoModel.buscar_por_id(grupo_id):
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        return ResponseUtils.sucesso(dados=ParticipanteModel.listar_por_grupo(grupo_id))

    @staticmethod
    def buscar(current_user_id, participante_id):
        participante = ParticipanteModel.buscar_por_id(participante_id)
        if not participante:
            return ResponseUtils.erro("Participante nao encontrado.", status=404)
        if not ParticipanteModel.buscar(participante["grupo_id"], current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        usuario = UsuarioModel.buscar_por_id(participante["usuario_id"])
        return ResponseUtils.sucesso(dados={**participante, "usuario": usuario})

    @staticmethod
    def atualizar(current_user_id, participante_id):
        data = request.get_json(silent=True) or {}
        papel = data.get("papel")
        if papel not in {"admin", "participante"}:
            return ResponseUtils.erro("Papel invalido. Use admin ou participante.")

        participante = ParticipanteModel.buscar_por_id(participante_id)
        if not participante:
            return ResponseUtils.erro("Participante nao encontrado.", status=404)
        if not _is_admin(participante["grupo_id"], current_user_id):
            return ResponseUtils.erro("Apenas administradores podem alterar permissoes.", status=403)
        grupo_atualizar = GrupoModel.buscar_por_id(participante["grupo_id"])
        if not grupo_atualizar:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if int(participante["usuario_id"]) == int(grupo_atualizar["criado_por"]):
            return ResponseUtils.erro("O criador do grupo deve continuar como administrador.", status=400)

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
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

        grupo = GrupoModel.buscar_por_id(participante["grupo_id"])
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not _is_admin(participante["grupo_id"], current_user_id):
            return ResponseUtils.erro("Apenas administradores podem remover participantes.", status=403)
        if int(participante["usuario_id"]) == int(grupo["criado_por"]):
            return ResponseUtils.erro("O criador do grupo nao pode ser removido.", status=400)

        saldos = FinanceiroService.saldos_grupo(participante["grupo_id"])
        saldo = next(
            (money(row["saldo"]) for row in saldos if int(row["usuario_id"]) == int(participante["usuario_id"])),
            money(0),
        )
        if abs(saldo) > money("0.00"):
            return ResponseUtils.erro(
                "O participante possui saldo pendente. Quite a divida antes de removê-lo.",
                status=409,
            )

        ParticipanteModel.remover_por_id(participante_id)
        return ResponseUtils.sucesso(mensagem="Participante removido.")

    @staticmethod
    def convidar(current_user_id):
        data = request.get_json(silent=True) or {}
        grupo_id = data.get("grupo_id")
        email = (data.get("email") or "").strip().lower()

        if not grupo_id or not email:
            return ResponseUtils.erro("grupo_id e email sao obrigatorios.")
        if not _is_admin(grupo_id, current_user_id):
            return ResponseUtils.erro("Apenas administradores podem enviar convites.", status=403)

        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)

        usuario = UsuarioModel.buscar_por_email(email)
        if usuario and ParticipanteModel.buscar(grupo_id, usuario["id"]):
            return ResponseUtils.erro("Este usuario ja participa do grupo.", status=409)

        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7)
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
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

        data_retorno = {"email": email, "expires_at": expires.isoformat()}
        if Config.ENVIRONMENT != "production":
            data_retorno["token_teste"] = token
        return ResponseUtils.sucesso(
            dados=data_retorno,
            mensagem="Convite criado.",
            status=201,
        )

    @staticmethod
    def aceitar_convite(current_user_id):
        data = request.get_json(silent=True) or {}
        token = data.get("token")
        if not token:
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
