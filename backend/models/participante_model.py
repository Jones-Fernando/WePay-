from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all


class ParticipanteModel:
    @staticmethod
    def adicionar(grupo_id, usuario_id, papel="participante", conn=None):
        if conn is not None:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    INSERT INTO participantes (grupo_id, usuario_id, papel, ativo)
                    VALUES (?, ?, ?, 1)
                    ON DUPLICATE KEY UPDATE ativo = 1, papel = VALUES(papel), removido_em = NULL
                    """,
                    (grupo_id, usuario_id, papel),
                )
            finally:
                cursor.close()
            return

        with get_connection_context() as connection:
            ParticipanteModel.adicionar(grupo_id, usuario_id, papel, connection)
            connection.commit()

    @staticmethod
    def buscar(grupo_id, usuario_id, apenas_ativo=True):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = "SELECT * FROM participantes WHERE grupo_id = ? AND usuario_id = ?"
                params = [grupo_id, usuario_id]
                if apenas_ativo:
                    query += " AND ativo = 1"
                cursor.execute(query, tuple(params))
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_id(participante_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute("SELECT * FROM participantes WHERE id = ?", (participante_id,))
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    def listar_por_grupo(grupo_id, incluir_inativos=False):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = """
                    SELECT p.id, p.grupo_id, p.usuario_id, p.papel,
                           p.criado_em, p.removido_em,
                           CASE WHEN u.excluido_em IS NULL THEN u.nome
                                ELSE 'Usuário excluído' END AS nome,
                           CASE WHEN u.excluido_em IS NULL THEN u.email
                                ELSE NULL END AS email,
                           CASE WHEN u.excluido_em IS NULL THEN p.ativo
                                ELSE 0 END AS ativo
                    FROM participantes p
                    JOIN usuarios u ON p.usuario_id = u.id
                    WHERE p.grupo_id = ?
                """
                if not incluir_inativos:
                    query += " AND p.ativo = 1"
                query += " ORDER BY ativo DESC, u.nome"
                cursor.execute(query, (grupo_id,))
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def listar_por_grupo_paginado(grupo_id, limit=50, offset=0):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT COUNT(*) AS total FROM participantes p "
                    "JOIN usuarios u ON p.usuario_id = u.id "
                    "WHERE p.grupo_id = ? AND p.ativo = 1",
                    (grupo_id,),
                )
                total = int(fetch_one(cursor)["total"])
                cursor.execute(
                    """
                    SELECT p.id, p.grupo_id, p.usuario_id, p.papel,
                           p.criado_em, p.removido_em,
                           CASE WHEN u.excluido_em IS NULL THEN u.nome
                                ELSE 'Usuário excluído' END AS nome,
                           CASE WHEN u.excluido_em IS NULL THEN u.email
                                ELSE NULL END AS email,
                           CASE WHEN u.excluido_em IS NULL THEN p.ativo
                                ELSE 0 END AS ativo
                    FROM participantes p
                    JOIN usuarios u ON p.usuario_id = u.id
                    WHERE p.grupo_id = ? AND p.ativo = 1
                    ORDER BY ativo DESC, u.nome, p.id
                    LIMIT ? OFFSET ?
                    """,
                    (grupo_id, limit, offset),
                )
                return fetch_all(cursor), {
                    "limit": limit,
                    "offset": offset,
                    "total": total,
                    "has_more": offset + limit < total,
                }
            finally:
                cursor.close()

    @staticmethod
    def remover_por_id(participante_id, conn=None):
        query = (
            "UPDATE participantes SET ativo = 0, removido_em = CURRENT_TIMESTAMP WHERE id = ?"
        )
        if conn is not None:
            cursor = cursor_for(conn)
            try:
                cursor.execute(query, (participante_id,))
            finally:
                cursor.close()
            return
        with get_connection_context() as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(query, (participante_id,))
                connection.commit()
            finally:
                cursor.close()
