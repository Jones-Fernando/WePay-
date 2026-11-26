from database.category_templates import DEFAULT_CATEGORIES
from database.connection import (
    cursor_for,
    fetch_all,
    fetch_one,
    get_connection_context,
)


class CategoriaModel:
    @staticmethod
    def listar_icones(usuario_id, tipo=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = (
                    "SELECT nome, tipo, icone FROM categorias_icones_usuario "
                    "WHERE usuario_id = ?"
                )
                params = [usuario_id]
                if tipo:
                    query += " AND tipo = ?"
                    params.append(tipo)
                query += " ORDER BY tipo, nome"
                cursor.execute(query, tuple(params))
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def definir_icone_padrao(usuario_id, nome, tipo, icone):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO categorias_icones_usuario "
                    "(usuario_id, tipo, nome, icone) VALUES (?, ?, ?, ?) "
                    "ON DUPLICATE KEY UPDATE icone = VALUES(icone)",
                    (usuario_id, tipo, nome, icone),
                )
                cursor.execute(
                    "UPDATE categorias SET icone = ? "
                    "WHERE usuario_id = ? AND nome = ? "
                    "AND (tipo = ? OR tipo = 'ambos')",
                    (icone, usuario_id, nome, tipo),
                )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def restaurar_icone_padrao(usuario_id, nome, tipo):
        icone_padrao = next(
            (
                icone
                for categoria_nome, icone, categoria_tipo in DEFAULT_CATEGORIES
                if categoria_nome == nome and categoria_tipo == tipo
            ),
            None,
        )
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "DELETE FROM categorias_icones_usuario "
                    "WHERE usuario_id = ? AND tipo = ? AND nome = ?",
                    (usuario_id, tipo, nome),
                )
                if icone_padrao is not None:
                    cursor.execute(
                        "UPDATE categorias SET icone = ? "
                        "WHERE usuario_id = ? AND nome = ? "
                        "AND (tipo = ? OR tipo = 'ambos')",
                        (icone_padrao, usuario_id, nome, tipo),
                    )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def listar(usuario_id, tipo=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = """
                    SELECT c.id, c.usuario_id, c.nome, c.icone, c.tipo, c.origem,
                           c.criado_em,
                           (
                               SELECT COUNT(*)
                               FROM despesas_pessoais dp
                               WHERE (
                                   dp.categoria_id = c.id
                                   OR (
                                       dp.categoria_id IS NULL
                                       AND dp.usuario_id = c.usuario_id
                                       AND CONVERT(dp.categoria USING utf8mb4)
                                               COLLATE utf8mb4_unicode_ci =
                                           CONVERT(c.nome USING utf8mb4)
                                               COLLATE utf8mb4_unicode_ci
                                       AND c.tipo IN ('pessoal', 'ambos')
                                   )
                               )
                           ) + (
                               SELECT COUNT(*)
                               FROM despesas d
                               WHERE (
                                   d.categoria_id = c.id
                                   OR (
                                       d.categoria_id IS NULL
                                       AND CONVERT(d.categoria USING utf8mb4)
                                               COLLATE utf8mb4_unicode_ci =
                                           CONVERT(c.nome USING utf8mb4)
                                               COLLATE utf8mb4_unicode_ci
                                       AND COALESCE(d.criado_por, d.pagador_id) = c.usuario_id
                                       AND c.tipo IN ('grupo', 'ambos')
                                   )
                               )
                           ) AS quantidade_despesas
                    FROM categorias c
                    WHERE c.usuario_id = ?
                """
                params = [usuario_id]
                if tipo:
                    query += " AND (c.tipo = 'ambos' OR c.tipo = ?)"
                    params.append(tipo)
                query += " ORDER BY c.nome, c.id"
                cursor.execute(query, tuple(params))
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def buscar_id(usuario_id, nome, tipo):
        if not nome:
            return None
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT id FROM categorias "
                    "WHERE usuario_id = ? AND nome = ? "
                    "AND (tipo = 'ambos' OR tipo = ?) "
                    "ORDER BY tipo = 'ambos' LIMIT 1",
                    (usuario_id, nome, tipo),
                )
                categoria = fetch_one(cursor)
                return categoria["id"] if categoria else None
            finally:
                cursor.close()

    @staticmethod
    def nome_em_uso(usuario_id, nome, tipo, excluir_id=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT id FROM categorias WHERE usuario_id = ? AND nome = ? "
                    "AND (tipo = ? OR tipo = 'ambos' OR ? = 'ambos') "
                    "AND (? IS NULL OR id <> ?) LIMIT 1",
                    (usuario_id, nome, tipo, tipo, excluir_id, excluir_id),
                )
                return fetch_one(cursor) is not None
            finally:
                cursor.close()

    @staticmethod
    def criar(usuario_id, nome, tipo="ambos", icone="📌"):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO categorias "
                    "(usuario_id, nome, icone, tipo, origem) "
                    "VALUES (?, ?, ?, ?, 'personalizada')",
                    (usuario_id, nome, icone, tipo),
                )
                item_id = cursor.lastrowid
                conn.commit()
                return item_id
            finally:
                cursor.close()

    @staticmethod
    def atualizar(usuario_id, categoria_id, nome, tipo, icone="📌"):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT nome, tipo FROM categorias "
                    "WHERE id = ? AND usuario_id = ? FOR UPDATE",
                    (categoria_id, usuario_id),
                )
                categoria = fetch_one(cursor)
                if not categoria:
                    conn.rollback()
                    return False
                if categoria["tipo"] != tipo:
                    cursor.execute(
                        """
                        SELECT
                            (
                                SELECT COUNT(*) FROM despesas_pessoais
                                WHERE categoria_id = ?
                                   OR (
                                       categoria_id IS NULL
                                       AND usuario_id = ?
                                       AND categoria = ?
                                       AND ? IN ('pessoal', 'ambos')
                                   )
                            ) + (
                                SELECT COUNT(*) FROM despesas
                                WHERE categoria_id = ?
                                   OR (
                                       categoria_id IS NULL
                                       AND categoria = ?
                                       AND COALESCE(criado_por, pagador_id) = ?
                                       AND ? IN ('grupo', 'ambos')
                                   )
                            ) AS total
                        """,
                        (
                            categoria_id,
                            usuario_id,
                            categoria["nome"],
                            categoria["tipo"],
                            categoria_id,
                            categoria["nome"],
                            usuario_id,
                            categoria["tipo"],
                        ),
                    )
                    if int(fetch_one(cursor)["total"]):
                        conn.rollback()
                        return "tipo_em_uso"

                cursor.execute(
                    "UPDATE categorias SET nome = ?, icone = ?, tipo = ? "
                    "WHERE id = ? AND usuario_id = ?",
                    (nome, icone, tipo, categoria_id, usuario_id),
                )
                atualizado = cursor.rowcount
                if atualizado:
                    cursor.execute(
                        """
                        UPDATE despesas_pessoais
                        SET categoria = ?, categoria_id = ?
                        WHERE categoria_id = ?
                           OR (
                               categoria_id IS NULL
                               AND usuario_id = ?
                               AND categoria = ?
                               AND ? IN ('pessoal', 'ambos')
                           )
                        """,
                        (
                            nome,
                            categoria_id,
                            categoria_id,
                            usuario_id,
                            categoria["nome"],
                            categoria["tipo"],
                        ),
                    )
                    cursor.execute(
                        """
                        UPDATE despesas
                        SET categoria = ?, categoria_id = ?
                        WHERE categoria_id = ?
                           OR (
                               categoria_id IS NULL
                               AND categoria = ?
                               AND COALESCE(criado_por, pagador_id) = ?
                               AND ? IN ('grupo', 'ambos')
                           )
                        """,
                        (
                            nome,
                            categoria_id,
                            categoria_id,
                            categoria["nome"],
                            usuario_id,
                            categoria["tipo"],
                        ),
                    )
                conn.commit()
                return atualizado > 0
            finally:
                cursor.close()

    @staticmethod
    def deletar(usuario_id, categoria_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT id, nome, tipo FROM categorias "
                    "WHERE id = ? AND usuario_id = ? FOR UPDATE",
                    (categoria_id, usuario_id),
                )
                categoria = fetch_one(cursor)
                if not categoria:
                    conn.rollback()
                    return None

                cursor.execute(
                    """
                    SELECT
                        (
                            SELECT COUNT(*)
                            FROM despesas_pessoais dp
                            WHERE dp.categoria_id = ?
                               OR (
                                   dp.categoria_id IS NULL
                                   AND dp.usuario_id = ?
                                   AND dp.categoria = ?
                                   AND ? IN ('pessoal', 'ambos')
                               )
                        ) + (
                            SELECT COUNT(*)
                            FROM despesas d
                            WHERE d.categoria_id = ?
                               OR (
                                   d.categoria_id IS NULL
                                   AND d.categoria = ?
                                   AND COALESCE(d.criado_por, d.pagador_id) = ?
                                   AND ? IN ('grupo', 'ambos')
                               )
                        ) AS total
                    """,
                    (
                        categoria_id,
                        usuario_id,
                        categoria["nome"],
                        categoria["tipo"],
                        categoria_id,
                        categoria["nome"],
                        usuario_id,
                        categoria["tipo"],
                    ),
                )
                usos = int(fetch_one(cursor)["total"])
                if usos:
                    conn.rollback()
                    return usos

                cursor.execute(
                    "DELETE FROM categorias WHERE id = ? AND usuario_id = ?",
                    (categoria_id, usuario_id),
                )
                removido = cursor.rowcount > 0
                conn.commit()
                return 0 if removido else None
            finally:
                cursor.close()
