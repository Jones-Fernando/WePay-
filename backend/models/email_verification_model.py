from contextlib import nullcontext

from database.connection import cursor_for, fetch_one, get_connection_context


class EmailVerificationModel:
    @staticmethod
    def criar(usuario_id, token_hash, expires_at, conn=None):
        context = nullcontext(conn) if conn is not None else get_connection_context()
        with context as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "INSERT INTO email_verification_tokens "
                    "(usuario_id, token_hash, expires_at) VALUES (?, ?, ?)",
                    (usuario_id, token_hash, expires_at),
                )
                if conn is None:
                    connection.commit()
                return cursor.lastrowid
            finally:
                cursor.close()

    @staticmethod
    def registrar_entrega(token_hash, enviado, erro=None):
        with get_connection_context() as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "SELECT id, usuario_id FROM email_verification_tokens "
                    "WHERE token_hash = ?",
                    (token_hash,),
                )
                token = fetch_one(cursor)
                if not token:
                    return
                cursor.execute(
                    "UPDATE email_verification_tokens "
                    "SET delivery_status = ?, delivery_error = ? "
                    "WHERE id = ?",
                    ("sent" if enviado else "failed", erro, token["id"]),
                )
                if enviado:
                    cursor.execute(
                        "UPDATE email_verification_tokens "
                        "SET usado_em = CURRENT_TIMESTAMP "
                        "WHERE usuario_id = ? AND id < ? AND usado_em IS NULL",
                        (token["usuario_id"], token["id"]),
                    )
                connection.commit()
            finally:
                cursor.close()

    @staticmethod
    def buscar_token_valido(token_hash, conn):
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "SELECT id, usuario_id FROM email_verification_tokens "
                "WHERE token_hash = ? AND usado_em IS NULL "
                "AND expires_at > UTC_TIMESTAMP() FOR UPDATE",
                (token_hash,),
            )
            return fetch_one(cursor)
        finally:
            cursor.close()

    @staticmethod
    def marcar_usado(token_id, usuario_id, conn):
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "UPDATE email_verification_tokens "
                "SET usado_em = CURRENT_TIMESTAMP "
                "WHERE id = ? AND usado_em IS NULL",
                (token_id,),
            )
            if cursor.rowcount != 1:
                return False
            cursor.execute(
                "UPDATE usuarios SET email_verificado = 1 WHERE id = ?",
                (usuario_id,),
            )
            cursor.execute(
                "UPDATE email_verification_tokens "
                "SET usado_em = CURRENT_TIMESTAMP "
                "WHERE usuario_id = ? AND usado_em IS NULL",
                (usuario_id,),
            )
            return True
        finally:
            cursor.close()

    @staticmethod
    def usuario_pendente(email):
        with get_connection_context() as connection:
            cursor = cursor_for(connection)
            try:
                cursor.execute(
                    "SELECT id, email FROM usuarios "
                    "WHERE email = ? AND email_verificado = 0",
                    (email,),
                )
                return fetch_one(cursor)
            finally:
                cursor.close()
