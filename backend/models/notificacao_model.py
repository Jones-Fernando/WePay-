from contextlib import nullcontext

from database.connection import get_connection_context, cursor_for, fetch_all


class NotificacaoModel:
    @staticmethod
    def criar(usuario_id, grupo_id, tipo, titulo, mensagem, conn=None):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "INSERT INTO notificacoes (usuario_id, grupo_id, tipo, titulo, mensagem) VALUES (?, ?, ?, ?, ?)",
                    (usuario_id, grupo_id, tipo, titulo, mensagem),
                )
                item_id = cursor.lastrowid
                if conn is None:
                    connection.commit()
                return item_id
            finally:
                cursor.close()

    @staticmethod
    def listar(usuario_id, somente_nao_lidas=False):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = (
                    "SELECT id, grupo_id, tipo, titulo, mensagem, lida, criado_em "
                    "FROM notificacoes WHERE usuario_id = ?"
                )
                params = [usuario_id]
                if somente_nao_lidas:
                    query += " AND lida = 0"
                query += " ORDER BY criado_em DESC, id DESC LIMIT 100"
                cursor.execute(query, tuple(params))
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def marcar_lida(usuario_id, notificacao_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "UPDATE notificacoes SET lida = 1 WHERE id = ? AND usuario_id = ?",
                    (notificacao_id, usuario_id),
                )
                atualizado = cursor.rowcount
                conn.commit()
                return atualizado > 0
            finally:
                cursor.close()
