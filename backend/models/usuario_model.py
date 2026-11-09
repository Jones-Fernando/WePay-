from contextlib import nullcontext

from database.connection import get_connection_context, cursor_for, fetch_one


class UsuarioModel:
    @staticmethod
    def criar(nome, email, senha_hash, conn=None, email_verificado=True):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "INSERT INTO usuarios (nome, email, senha, email_verificado) "
                    "VALUES (?, ?, ?, ?)",
                    (nome, email, senha_hash, int(email_verificado)),
                )
                usuario_id = cursor.lastrowid
                if conn is None:
                    connection.commit()
                return usuario_id
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_id(usuario_id, incluir_excluido=False):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = (
                    """
                    SELECT id,
                           CASE WHEN excluido_em IS NULL THEN nome
                                ELSE 'Usuário excluído' END AS nome,
                           CASE WHEN excluido_em IS NULL THEN email
                                ELSE NULL END AS email,
                           CASE WHEN excluido_em IS NULL THEN telefone
                                ELSE NULL END AS telefone,
                           (SELECT COALESCE(SUM(s.saldo), 0)
                            FROM saldos s
                            WHERE s.usuario_id = usuarios.id) AS saldo_total
                    FROM usuarios
                    WHERE id = ?
                    """
                )
                if not incluir_excluido:
                    query = """
                        SELECT id,
                               CASE WHEN excluido_em IS NULL THEN nome
                                    ELSE 'Usuário excluído' END AS nome,
                               CASE WHEN excluido_em IS NULL THEN email
                                    ELSE NULL END AS email,
                               CASE WHEN excluido_em IS NULL THEN telefone
                                    ELSE NULL END AS telefone,
                               (SELECT COALESCE(SUM(s.saldo), 0)
                                FROM saldos s
                                WHERE s.usuario_id = usuarios.id) AS saldo_total
                        FROM usuarios
                        WHERE id = ? AND excluido_em IS NULL
                    """
                cursor.execute(query, (usuario_id,))
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_email(email):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT u.*,
                           (SELECT COALESCE(SUM(s.saldo), 0)
                            FROM saldos s
                            WHERE s.usuario_id = u.id) AS saldo_total
                    FROM usuarios u
                    WHERE u.email = ? AND u.excluido_em IS NULL
                    """,
                    (email,),
                )
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    def atualizar_senha(usuario_id, nova_senha_hash, conn=None):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "UPDATE usuarios SET senha = ?, auth_version = auth_version + 1, "
                    "atualizado_em = CURRENT_TIMESTAMP "
                    "WHERE id = ? AND excluido_em IS NULL",
                    (nova_senha_hash, usuario_id),
                )
                if conn is None:
                    connection.commit()
            finally:
                cursor.close()

    @staticmethod
    def atualizar_hash_senha_legado(usuario_id, hash_atual, novo_hash):
        with get_connection_context() as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "UPDATE usuarios SET senha = ?, atualizado_em = CURRENT_TIMESTAMP "
                    "WHERE id = ? AND senha = ? AND excluido_em IS NULL",
                    (novo_hash, usuario_id, hash_atual),
                )
                atualizado = cursor.rowcount == 1
                connection.commit()
                return atualizado
            finally:
                cursor.close()

    @staticmethod
    def atualizar(usuario_id, nome, email, telefone=None, conn=None):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "UPDATE usuarios SET nome = ?, email = ?, telefone = ?, "
                    "atualizado_em = CURRENT_TIMESTAMP "
                    "WHERE id = ? AND excluido_em IS NULL",
                    (nome, email, telefone, usuario_id),
                )
                if conn is None:
                    connection.commit()
            finally:
                cursor.close()

    @staticmethod
    def anonimizar(usuario_id, email_anonimo, senha_hash, conn):
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                UPDATE usuarios
                SET nome = 'Usuário excluído',
                    email = ?,
                    telefone = NULL,
                    senha = ?,
                    email_verificado = 1,
                    auth_version = auth_version + 1,
                    excluido_em = CURRENT_TIMESTAMP,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ? AND excluido_em IS NULL
                """,
                (email_anonimo, senha_hash, usuario_id),
            )
            return cursor.rowcount
        finally:
            cursor.close()
