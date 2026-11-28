from contextlib import nullcontext

from database.connection import (
    get_connection_context,
    cursor_for,
    fetch_all,
    fetch_one,
)
from database.category_templates import DEFAULT_CATEGORIES

_PIX_KEY_NOT_PROVIDED = object()


class UsuarioModel:
    @staticmethod
    def criar(nome, email, senha_hash, conn=None, email_verificado=True):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "INSERT INTO usuarios "
                    "(nome, email, senha, email_verificado, categorias_inicializadas) "
                    "VALUES (?, ?, ?, ?, 0)",
                    (nome, email, senha_hash, int(email_verificado)),
                )
                usuario_id = cursor.lastrowid
                for categoria_nome, categoria_icone, categoria_tipo in DEFAULT_CATEGORIES:
                    cursor.execute(
                        "INSERT INTO categorias "
                        "(usuario_id, nome, icone, tipo, origem) "
                        "VALUES (?, ?, ?, ?, 'padrao')",
                        (
                            usuario_id,
                            categoria_nome,
                            categoria_icone,
                            categoria_tipo,
                        ),
                    )
                cursor.execute(
                    "UPDATE usuarios SET categorias_inicializadas = 1 WHERE id = ?",
                    (usuario_id,),
                )
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
                           CASE WHEN excluido_em IS NULL THEN pix_chave
                                ELSE NULL END AS pix_chave,
                           CASE WHEN excluido_em IS NULL THEN avatar_url
                                ELSE NULL END AS avatar_url,
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
                               pix_chave,
                               CASE WHEN excluido_em IS NULL THEN avatar_url
                                    ELSE NULL END AS avatar_url,
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
    def buscar_chaves_pix(usuario_ids):
        ids = sorted({int(usuario_id) for usuario_id in usuario_ids})
        if not ids:
            return {}

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                placeholders = ",".join(["?"] * len(ids))
                cursor.execute(
                    "SELECT id, pix_chave FROM usuarios "
                    f"WHERE id IN ({placeholders}) AND excluido_em IS NULL",
                    tuple(ids),
                )
                return {
                    int(row["id"]): row["pix_chave"] for row in fetch_all(cursor)
                }
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
                connection.commit()
                return cursor.rowcount == 1
            finally:
                cursor.close()

    @staticmethod
    def atualizar(
        usuario_id,
        nome,
        email,
        telefone=None,
        conn=None,
        pix_chave=_PIX_KEY_NOT_PROVIDED,
    ):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                if pix_chave is _PIX_KEY_NOT_PROVIDED:
                    cursor.execute(
                        "UPDATE usuarios SET nome = ?, email = ?, telefone = ?, "
                        "atualizado_em = CURRENT_TIMESTAMP "
                        "WHERE id = ? AND excluido_em IS NULL",
                        (nome, email, telefone, usuario_id),
                    )
                else:
                    cursor.execute(
                        "UPDATE usuarios SET nome = ?, email = ?, telefone = ?, "
                        "pix_chave = ?, atualizado_em = CURRENT_TIMESTAMP "
                        "WHERE id = ? AND excluido_em IS NULL",
                        (nome, email, telefone, pix_chave, usuario_id),
                    )
                if conn is None:
                    connection.commit()
            finally:
                cursor.close()

    @staticmethod
    def atualizar_avatar(usuario_id, avatar_url):
        with get_connection_context() as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "SELECT id FROM usuarios WHERE id = ? AND excluido_em IS NULL",
                    (usuario_id,),
                )
                if not fetch_one(cursor):
                    return False

                cursor.execute(
                    "UPDATE usuarios SET avatar_url = ?, "
                    "atualizado_em = CURRENT_TIMESTAMP "
                    "WHERE id = ? AND excluido_em IS NULL",
                    (avatar_url, usuario_id),
                )
                connection.commit()
                return True
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
                    pix_chave = NULL,
                    avatar_url = NULL,
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
