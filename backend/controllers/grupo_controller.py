from flask import request

from database.connection import get_connection_context, cursor_for
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from utils.response_utils import ResponseUtils


def _is_admin(grupo_id, usuario_id):
    participante = ParticipanteModel.buscar(grupo_id, usuario_id)
    return bool(participante and participante.get("papel") == "admin" and participante.get("ativo") == 1)


class GrupoController:
    @staticmethod
    def criar(current_user_id):
        data = request.get_json(silent=True) or {}
        nome = (data.get("nome") or "").strip()
        descricao = (data.get("descricao") or "").strip() or None
        participantes = data.get("participantes", [])

        if not nome:
            return ResponseUtils.erro("Nome do grupo eh obrigatorio.")
        if len(nome) < 2:
            return ResponseUtils.erro("Nome do grupo deve ter ao menos 2 caracteres.")
        if not isinstance(participantes, list):
            return ResponseUtils.erro("Participantes deve ser uma lista de IDs.")

        ids = {int(item) for item in participantes if str(item).isdigit()}
        ids.discard(int(current_user_id))

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                if ids:
                    placeholders = ",".join(["?"] * len(ids))
                    cursor.execute(
                        f"SELECT id FROM usuarios WHERE id IN ({placeholders})",
                        tuple(sorted(ids)),
                    )
                    encontrados = {int(row["id"]) for row in cursor.fetchall()}
                    if encontrados != ids:
                        return ResponseUtils.erro("Um ou mais participantes nao existem.", status=400)

                grupo_id = GrupoModel.criar(nome, descricao, current_user_id, conn)
                ParticipanteModel.adicionar(grupo_id, current_user_id, "admin", conn)
                for usuario_id in sorted(ids):
                    ParticipanteModel.adicionar(grupo_id, usuario_id, "participante", conn)
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

        return ResponseUtils.sucesso(
            dados={"id": grupo_id},
            mensagem="Grupo criado.",
            status=201,
        )

    @staticmethod
    def listar(current_user_id):
        return ResponseUtils.sucesso(dados=GrupoModel.listar_por_usuario(current_user_id))

    @staticmethod
    def buscar(current_user_id, grupo_id):
        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        return ResponseUtils.sucesso(dados=grupo)

    @staticmethod
    def atualizar(current_user_id, grupo_id):
        if not _is_admin(grupo_id, current_user_id):
            return ResponseUtils.erro("Apenas administradores podem editar o grupo.", status=403)

        data = request.get_json(silent=True) or {}
        nome = (data.get("nome") or "").strip()
        descricao = (data.get("descricao") or "").strip() or None
        if not nome:
            return ResponseUtils.erro("Nome do grupo eh obrigatorio.")

        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)

        GrupoModel.atualizar(grupo_id, nome, descricao)
        return ResponseUtils.sucesso(mensagem="Grupo atualizado.")

    @staticmethod
    def deletar(current_user_id, grupo_id):
        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if int(grupo["criado_por"]) != int(current_user_id):
            return ResponseUtils.erro("Apenas o criador do grupo pode removê-lo.", status=403)
        GrupoModel.deletar(grupo_id)
        return ResponseUtils.sucesso(mensagem="Grupo removido.")
