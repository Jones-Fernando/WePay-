from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all


class CategoriaModel:
    @staticmethod
    def listar(usuario_id, tipo=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = (
                    "SELECT id, usuario_id, nome, tipo, criado_em FROM categorias "
                    "WHERE (usuario_id IS NULL OR usuario_id = ?)"
                )
                params = [usuario_id]
                if tipo:
                    query += " AND (tipo = 'ambos' OR tipo = ?)"
                    params.append(tipo)
                query += " ORDER BY usuario_id IS NOT NULL, nome"
                cursor.execute(query, tuple(params))
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def criar(usuario_id, nome, tipo="ambos"):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO categorias (usuario_id, nome, tipo) VALUES (?, ?, ?)",
                    (usuario_id, nome, tipo),
                )
                item_id = cursor.lastrowid
                conn.commit()
                return item_id
            finally:
                cursor.close()

    @staticmethod
    def atualizar(usuario_id, categoria_id, nome, tipo):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "UPDATE categorias SET nome = ?, tipo = ? WHERE id = ? AND usuario_id = ?",
                    (nome, tipo, categoria_id, usuario_id),
                )
                atualizado = cursor.rowcount
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
                    "DELETE FROM categorias WHERE id = ? AND usuario_id = ?",
                    (categoria_id, usuario_id),
                )
                removido = cursor.rowcount
                conn.commit()
                return removido > 0
            finally:
                cursor.close()
