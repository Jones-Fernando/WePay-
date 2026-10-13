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
                    SELECT p.id, p.grupo_id, p.usuario_id, p.papel, p.ativo,
                           p.criado_em, p.removido_em, u.nome, u.email
                    FROM participantes p
                    JOIN usuarios u ON p.usuario_id = u.id
                    WHERE p.grupo_id = ?
                """
                if not incluir_inativos:
                    query += " AND p.ativo = 1"
                query += " ORDER BY p.ativo DESC, u.nome"
                cursor.execute(query, (grupo_id,))
                return fetch_all(cursor)
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
