from flask import request

from database.group_cover_icons import (
    AVAILABLE_GROUP_COVER_ICONS,
    DEFAULT_GROUP_COVER_ICONS,
    GROUP_COVER_ICON_VALUES,
)
from database.connection import get_connection_context, cursor_for
from models.grupo_icone_capa_model import GrupoIconeCapaModel
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from utils.response_utils import ResponseUtils
from utils.validators import (
    MAX_GROUP_DESCRIPTION_LENGTH,
    MAX_GROUP_NAME_LENGTH,
    MAX_PARTICIPANTS_PER_GROUP,
    parse_pagination,
    parse_positive_int,
)


def _is_admin(grupo_id, usuario_id):
    participante = ParticipanteModel.buscar(grupo_id, usuario_id)
    return bool(participante and participante.get("papel") == "admin" and participante.get("ativo") == 1)


class GrupoController:
    @staticmethod
    def listar_icones_capa(current_user_id):
        return ResponseUtils.sucesso(
            dados=GrupoIconeCapaModel.listar(
                current_user_id, DEFAULT_GROUP_COVER_ICONS
            )
        )

    @staticmethod
    def _validar_dados_icone_capa(data):
        if not isinstance(data, dict):
            raise ValueError("Corpo da requisicao invalido.")
        nome_value = data.get("nome")
        icone = data.get("icone")
        if not isinstance(nome_value, str) or not isinstance(icone, str):
            raise ValueError("Nome e icone devem ser textos.")
        nome = nome_value.strip()
        if not nome or len(nome) > 60:
            raise ValueError("Nome deve ter entre 1 e 60 caracteres.")
        if icone not in GROUP_COVER_ICON_VALUES:
            raise ValueError("Icone de capa invalido.")
        return nome, icone

    @staticmethod
    def criar_icone_capa(current_user_id):
        try:
            nome, icone = GrupoController._validar_dados_icone_capa(
                request.get_json(silent=True)
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        opcao_id = GrupoIconeCapaModel.criar(current_user_id, nome, icone)
        return ResponseUtils.sucesso(
            dados={"id": opcao_id},
            mensagem="Opcao de icone criada.",
            status=201,
        )

    @staticmethod
    def atualizar_icone_capa(current_user_id, opcao_id):
        try:
            nome, icone = GrupoController._validar_dados_icone_capa(
                request.get_json(silent=True)
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        if not GrupoIconeCapaModel.atualizar(
            current_user_id, opcao_id, nome, icone
        ):
            return ResponseUtils.erro("Opcao de icone nao encontrada.", status=404)
        return ResponseUtils.sucesso(mensagem="Opcao de icone atualizada.")

    @staticmethod
    def excluir_icone_capa(current_user_id, opcao_id):
        if not GrupoIconeCapaModel.excluir(current_user_id, opcao_id):
            return ResponseUtils.erro("Opcao de icone nao encontrada.", status=404)
        return ResponseUtils.sucesso(
            mensagem="Opcao removida. As capas existentes foram mantidas."
        )

    @staticmethod
    def restaurar_catalogo_icones_capa(current_user_id):
        GrupoIconeCapaModel.restaurar_visibilidade(
            current_user_id,
            DEFAULT_GROUP_COVER_ICONS,
            AVAILABLE_GROUP_COVER_ICONS,
        )
        return ResponseUtils.sucesso(
            mensagem="Visibilidade padrao dos icones restaurada."
        )

    @staticmethod
    def atualizar_icones_capa(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")

        ocultos = data.get("ocultos")
        if not isinstance(ocultos, list):
            return ResponseUtils.erro("A lista de icones ocultos eh invalida.")
        if any(
            not isinstance(icone, str) or icone not in GROUP_COVER_ICON_VALUES
            for icone in ocultos
        ):
            return ResponseUtils.erro("Um ou mais icones de capa sao invalidos.")
        if len(set(ocultos)) != len(ocultos):
            return ResponseUtils.erro("A lista de icones ocultos nao pode conter duplicatas.")

        GrupoIconeCapaModel.substituir_ocultos(
            current_user_id,
            ocultos,
            DEFAULT_GROUP_COVER_ICONS,
            AVAILABLE_GROUP_COVER_ICONS,
        )
        return ResponseUtils.sucesso(mensagem="Opcoes de icones de capa atualizadas.")

    @staticmethod
    def restaurar_icones_capa(current_user_id):
        GrupoIconeCapaModel.restaurar_visibilidade(
            current_user_id,
            DEFAULT_GROUP_COVER_ICONS,
            AVAILABLE_GROUP_COVER_ICONS,
        )
        return ResponseUtils.sucesso(mensagem="Opcoes padrao de icones restauradas.")

    @staticmethod
    def criar(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        nome_value = data.get("nome")
        descricao_value = data.get("descricao", "")
        icone = data.get("icone")
        if not isinstance(nome_value, str):
            return ResponseUtils.erro("Nome do grupo eh obrigatorio.")
        if not isinstance(descricao_value, str):
            return ResponseUtils.erro("Descricao deve ser um texto.")
        if icone is not None and (
            not isinstance(icone, str) or icone not in GROUP_COVER_ICON_VALUES
        ):
            return ResponseUtils.erro("Icone do grupo invalido.")
        nome = nome_value.strip()
        descricao = descricao_value.strip() or None
        participantes = data.get("participantes", [])

        if not nome:
            return ResponseUtils.erro("Nome do grupo eh obrigatorio.")
        if len(nome) < 2:
            return ResponseUtils.erro("Nome do grupo deve ter ao menos 2 caracteres.")
        if len(nome) > MAX_GROUP_NAME_LENGTH:
            return ResponseUtils.erro(
                f"Nome do grupo nao pode exceder {MAX_GROUP_NAME_LENGTH} caracteres."
            )
        if (
            descricao is not None
            and len(descricao) > MAX_GROUP_DESCRIPTION_LENGTH
        ):
            return ResponseUtils.erro(
                f"Descricao nao pode exceder {MAX_GROUP_DESCRIPTION_LENGTH} caracteres."
            )
        if not isinstance(participantes, list):
            return ResponseUtils.erro("Participantes deve ser uma lista de IDs.")
        if len(participantes) > MAX_PARTICIPANTS_PER_GROUP:
            return ResponseUtils.erro(
                f"O grupo pode ter no maximo {MAX_PARTICIPANTS_PER_GROUP} participantes."
            )

        try:
            ids = {
                parse_positive_int(item, "participante")
                for item in participantes
            }
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        ids.discard(int(current_user_id))
        if len(ids) + 1 > MAX_PARTICIPANTS_PER_GROUP:
            return ResponseUtils.erro(
                f"O grupo pode ter no maximo {MAX_PARTICIPANTS_PER_GROUP} participantes."
            )

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                if ids:
                    placeholders = ",".join(["?"] * len(ids))
                    cursor.execute(
                        f"SELECT id FROM usuarios WHERE id IN ({placeholders}) "
                        "AND excluido_em IS NULL",
                        tuple(sorted(ids)),
                    )
                    encontrados = {int(row["id"]) for row in cursor.fetchall()}
                    if encontrados != ids:
                        return ResponseUtils.erro("Um ou mais participantes nao existem.", status=400)

                grupo_id = GrupoModel.criar(
                    nome,
                    descricao,
                    current_user_id,
                    conn=conn,
                    icone=icone,
                )
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
        try:
            limit, offset = parse_pagination(
                request.args.get("limit"), request.args.get("offset")
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        dados, paginacao = GrupoModel.listar_por_usuario(
            current_user_id, limit, offset
        )
        return ResponseUtils.sucesso(dados=dados, paginacao=paginacao)

    @staticmethod
    def buscar(current_user_id, grupo_id):
        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        participante = ParticipanteModel.buscar(grupo_id, current_user_id)
        if not participante:
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        grupo["pode_editar"] = participante.get("papel") == "admin"
        return ResponseUtils.sucesso(dados=grupo)

    @staticmethod
    def atualizar(current_user_id, grupo_id):
        if not _is_admin(grupo_id, current_user_id):
            return ResponseUtils.erro("Apenas administradores podem editar o grupo.", status=403)

        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        nome_value = data.get("nome")
        descricao_value = data.get("descricao", "")
        if not isinstance(nome_value, str):
            return ResponseUtils.erro("Nome do grupo eh obrigatorio.")
        if not isinstance(descricao_value, str):
            return ResponseUtils.erro("Descricao deve ser um texto.")
        nome = nome_value.strip()
        descricao = descricao_value.strip() or None
        if not nome:
            return ResponseUtils.erro("Nome do grupo eh obrigatorio.")
        if len(nome) < 2:
            return ResponseUtils.erro("Nome do grupo deve ter ao menos 2 caracteres.")
        if len(nome) > MAX_GROUP_NAME_LENGTH:
            return ResponseUtils.erro(
                f"Nome do grupo nao pode exceder {MAX_GROUP_NAME_LENGTH} caracteres."
            )
        if (
            descricao is not None
            and len(descricao) > MAX_GROUP_DESCRIPTION_LENGTH
        ):
            return ResponseUtils.erro(
                f"Descricao nao pode exceder {MAX_GROUP_DESCRIPTION_LENGTH} caracteres."
            )

        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)

        if "icone" in data:
            icone = data["icone"]
            if icone is not None and (
                not isinstance(icone, str) or icone not in GROUP_COVER_ICON_VALUES
            ):
                return ResponseUtils.erro("Icone do grupo invalido.")
            GrupoModel.atualizar(grupo_id, nome, descricao, icone=icone)
        else:
            GrupoModel.atualizar(grupo_id, nome, descricao)
        return ResponseUtils.sucesso(mensagem="Grupo atualizado.")

    @staticmethod
    def deletar(current_user_id, grupo_id):
        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not _is_admin(grupo_id, current_user_id):
            return ResponseUtils.erro(
                "Apenas administradores ativos podem remover o grupo.", status=403
            )
        GrupoModel.deletar(grupo_id)
        return ResponseUtils.sucesso(mensagem="Grupo removido.")
