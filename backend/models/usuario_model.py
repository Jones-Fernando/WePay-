from contextlib import nullcontext

from database.connection import get_connection_context, cursor_for, fetch_one, fetch_all


class UsuarioModel:
    @staticmethod
    def criar(nome, email, senha_hash, conn=None):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
                    (nome, email, senha_hash),
                )
                usuario_id = cursor.lastrowid
                if conn is None:
                    connection.commit()
                return usuario_id
            finally:
                cursor.close()

    @staticmethod
    def listar_todos(busca=None, limite=20):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                limite = max(1, min(int(limite), 100))
                if busca:
                    termo = f"%{busca.strip().lower()}%"
                    cursor.execute(
                        "SELECT id, nome, email FROM usuarios "
                        "WHERE LOWER(nome) LIKE ? OR LOWER(email) LIKE ? "
                        "ORDER BY nome LIMIT ?",
                        (termo, termo, limite),
                    )
                else:
                    cursor.execute(
                        "SELECT id, nome, email FROM usuarios ORDER BY nome LIMIT ?",
                        (limite,),
                    )
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_id(usuario_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT id, nome, email, telefone FROM usuarios WHERE id = ?",
                    (usuario_id,),
                )
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    def buscar_por_email(email):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute("SELECT * FROM usuarios WHERE email = ?", (email,))
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
                    "UPDATE usuarios SET senha = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (nova_senha_hash, usuario_id),
                )
                if conn is None:
                    connection.commit()
            finally:
                cursor.close()

    @staticmethod
    def atualizar(usuario_id, nome, email, telefone=None, conn=None):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "UPDATE usuarios SET nome = ?, email = ?, telefone = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (nome, email, telefone, usuario_id),
                )
                if conn is None:
                    connection.commit()
            finally:
                cursor.close()

    @staticmethod
    def deletar(usuario_id, conn=None):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute("DELETE FROM usuarios WHERE id = ?", (usuario_id,))
                if conn is None:
                    connection.commit()
            finally:
                cursor.close()
