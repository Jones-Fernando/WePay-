from uuid import uuid4

from database.connection import cursor_for, fetch_all, get_connection_context
from database.group_cover_icons import (
    AVAILABLE_GROUP_COVER_ICONS,
    GROUP_COVER_CATALOG_MARKER,
    GROUP_COVER_CATALOG_MARKER_ICON,
)


class GrupoIconeCapaModel:
    @staticmethod
    def listar(
        usuario_id,
        opcoes_padrao,
        opcoes_disponiveis=AVAILABLE_GROUP_COVER_ICONS,
    ):
        nomes_padrao = dict(opcoes_padrao)
        icones_disponiveis = {icone for icone, _nome in opcoes_disponiveis}
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT icone FROM grupo_icones_capa_ocultos "
                    "WHERE usuario_id = ?",
                    (usuario_id,),
                )
                ocultos_anteriores = {
                    item["icone"] for item in fetch_all(cursor)
                }
                cursor.execute(
                    "SELECT opcao_id FROM grupo_icones_capa_opcoes "
                    "WHERE usuario_id = ? AND origem = 'padrao'",
                    (usuario_id,),
                )
                opcoes_existentes = {
                    item["opcao_id"] for item in fetch_all(cursor)
                }
                cursor.execute(
                    "SELECT opcao_id, nome, icone, origem "
                    "FROM grupo_icones_capa_opcoes "
                    "WHERE usuario_id = ? AND ativo = 1 "
                    "ORDER BY origem, nome, opcao_id",
                    (usuario_id,),
                )
                opcoes_ativas = fetch_all(cursor)
            finally:
                cursor.close()

        ativos_padrao = {
            item["opcao_id"]: item
            for item in opcoes_ativas
            if item["origem"] == "padrao"
            and item["opcao_id"] in icones_disponiveis
        }
        if GROUP_COVER_CATALOG_MARKER not in opcoes_existentes:
            icones_visiveis = icones_disponiveis - ocultos_anteriores
        else:
            icones_visiveis = set(ativos_padrao)
            icones_visiveis.update(
                icone
                for icone in icones_disponiveis - opcoes_existentes
                if icone not in ocultos_anteriores
            )

        opcoes = [
            {
                "id": icone,
                "nome": ativos_padrao.get(icone, {}).get(
                    "nome", nomes_padrao.get(icone, icone)
                ),
                "icone": icone,
                "origem": "padrao",
            }
            for icone, _nome in opcoes_disponiveis
            if icone in icones_visiveis
        ]
        opcoes.extend(
            {
                "id": item["opcao_id"],
                "nome": item["nome"],
                "icone": item["icone"],
                "origem": item["origem"],
            }
            for item in opcoes_ativas
            if item["origem"] == "personalizado"
        )
        ocultos = sorted(icones_disponiveis - icones_visiveis)
        return {"icones": opcoes, "ocultos": ocultos}

    @staticmethod
    def criar(usuario_id, nome, icone):
        opcao_id = f"personalizado:{uuid4().hex}"
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO grupo_icones_capa_opcoes "
                    "(usuario_id, opcao_id, nome, icone, origem, ativo) "
                    "VALUES (?, ?, ?, ?, 'personalizado', 1)",
                    (usuario_id, opcao_id, nome, icone),
                )
                conn.commit()
                return opcao_id
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def atualizar(usuario_id, opcao_id, nome, icone):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT opcao_id FROM grupo_icones_capa_opcoes "
                    "WHERE usuario_id = ? AND opcao_id = ? AND ativo = 1",
                    (usuario_id, opcao_id),
                )
                if cursor.fetchone() is None:
                    return False
                cursor.execute(
                    "UPDATE grupo_icones_capa_opcoes "
                    "SET nome = ?, icone = ? "
                    "WHERE usuario_id = ? AND opcao_id = ? AND ativo = 1",
                    (nome, icone, usuario_id, opcao_id),
                )
                conn.commit()
                return True
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def excluir(usuario_id, opcao_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT origem FROM grupo_icones_capa_opcoes "
                    "WHERE usuario_id = ? AND opcao_id = ? AND ativo = 1",
                    (usuario_id, opcao_id),
                )
                opcao = cursor.fetchone()
                if opcao is None:
                    return False
                if opcao["origem"] == "padrao":
                    cursor.execute(
                        "UPDATE grupo_icones_capa_opcoes SET ativo = 0 "
                        "WHERE usuario_id = ? AND opcao_id = ?",
                        (usuario_id, opcao_id),
                    )
                    cursor.execute(
                        "INSERT IGNORE INTO grupo_icones_capa_ocultos "
                        "(usuario_id, icone) VALUES (?, ?)",
                        (usuario_id, opcao_id),
                    )
                else:
                    cursor.execute(
                        "DELETE FROM grupo_icones_capa_opcoes "
                        "WHERE usuario_id = ? AND opcao_id = ?",
                        (usuario_id, opcao_id),
                    )
                conn.commit()
                return True
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def substituir_ocultos(
        usuario_id,
        icones,
        opcoes_padrao,
        opcoes_disponiveis=AVAILABLE_GROUP_COVER_ICONS,
    ):
        icones_ocultos = set(icones)
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                for icone, nome in opcoes_disponiveis:
                    cursor.execute(
                        """
                        INSERT INTO grupo_icones_capa_opcoes
                            (usuario_id, opcao_id, nome, icone, origem, ativo)
                        VALUES (?, ?, ?, ?, 'padrao', ?)
                        ON DUPLICATE KEY UPDATE
                            icone = VALUES(icone),
                            origem = 'padrao',
                            ativo = VALUES(ativo)
                        """,
                        (
                            usuario_id,
                            icone,
                            nome,
                            icone,
                            int(icone not in icones_ocultos),
                        ),
                    )
                cursor.execute(
                    "DELETE FROM grupo_icones_capa_ocultos WHERE usuario_id = ?",
                    (usuario_id,),
                )
                for icone in sorted(icones_ocultos):
                    cursor.execute(
                        "INSERT INTO grupo_icones_capa_ocultos (usuario_id, icone) "
                        "VALUES (?, ?)",
                        (usuario_id, icone),
                    )
                cursor.execute(
                    """
                    INSERT INTO grupo_icones_capa_opcoes
                        (usuario_id, opcao_id, nome, icone, origem, ativo)
                    VALUES (?, ?, 'Controle do catálogo', ?, 'padrao', 0)
                    ON DUPLICATE KEY UPDATE ativo = 0
                    """,
                    (
                        usuario_id,
                        GROUP_COVER_CATALOG_MARKER,
                        GROUP_COVER_CATALOG_MARKER_ICON,
                    ),
                )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def restaurar_visibilidade(
        usuario_id,
        opcoes_padrao,
        opcoes_disponiveis=AVAILABLE_GROUP_COVER_ICONS,
    ):
        icones_padrao = {icone for icone, _nome in opcoes_padrao}
        ocultos = [
            icone
            for icone, _nome in opcoes_disponiveis
            if icone not in icones_padrao
        ]
        GrupoIconeCapaModel.substituir_ocultos(
            usuario_id,
            ocultos,
            opcoes_padrao,
            opcoes_disponiveis,
        )

    @staticmethod
    def restaurar_padrao(usuario_id, opcoes_padrao):
        GrupoIconeCapaModel.restaurar_visibilidade(
            usuario_id, opcoes_padrao
        )
