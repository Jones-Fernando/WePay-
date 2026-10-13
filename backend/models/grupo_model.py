from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all


class GrupoModel:
    @staticmethod
    def criar(nome, descricao, criado_por, conn=None):
        if conn is not None:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO grupos (nome, descricao, criado_por) VALUES (?, ?, ?)",
                    (nome, descricao, criado_por),
                )
                return cursor.lastrowid
            finally:
                cursor.close()

        with get_connection_context() as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "INSERT INTO grupos (nome, descricao, criado_por) VALUES (?, ?, ?)",
                    (nome, descricao, criado_por),
                )
                group_id = cursor.lastrowid
                connection.commit()
                return group_id
            finally:
                cursor.close()

    @staticmethod
    def listar_por_usuario(usuario_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT g.id, g.nome, g.descricao, g.criado_por,
                           COALESCE(s.saldo, 0) AS saldo,
                           COUNT(DISTINCT p2.usuario_id) AS participantes
                    FROM grupos g
                    JOIN participantes me
                      ON me.grupo_id = g.id
                     AND me.usuario_id = ?
                     AND me.ativo = 1
                    LEFT JOIN saldos s
                      ON s.grupo_id = g.id
                     AND s.usuario_id = ?
                    LEFT JOIN participantes p2
                      ON p2.grupo_id = g.id
                     AND p2.ativo = 1
                    GROUP BY g.id, g.nome, g.descricao, g.criado_por, s.saldo
                    ORDER BY g.nome
                    """,
                    (usuario_id, usuario_id),
                )
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_id(grupo_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute("SELECT * FROM grupos WHERE id = ?", (grupo_id,))
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    def atualizar(grupo_id, nome, descricao, conn=None):
        if conn is not None:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "UPDATE grupos SET nome = ?, descricao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (nome, descricao, grupo_id),
                )
            finally:
                cursor.close()
            return

        with get_connection_context() as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "UPDATE grupos SET nome = ?, descricao = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (nome, descricao, grupo_id),
                )
                connection.commit()
            finally:
                cursor.close()

    @staticmethod
    def deletar(grupo_id, conn=None):
        if conn is not None:
            cursor = cursor_for(conn)
            try:
                cursor.execute("DELETE FROM grupos WHERE id = ?", (grupo_id,))
            finally:
                cursor.close()
            return

        with get_connection_context() as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute("DELETE FROM grupos WHERE id = ?", (grupo_id,))
                connection.commit()
            finally:
                cursor.close()
