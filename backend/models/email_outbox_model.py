from contextlib import contextmanager

from database.connection import cursor_for, fetch_one, get_connection_context
from utils.email_token_cipher import encrypt_recovery_token


class EmailOutboxModel:
    @staticmethod
    def enfileirar(
        usuario_id: int,
        recuperacao_token_id: int,
        email_destino: str,
        token: str,
        connection,
    ) -> None:
        token_cifrado = encrypt_recovery_token(token)
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                UPDATE password_reset_email_outbox o
                JOIN recuperacao_tokens r
                  ON r.id = o.recuperacao_token_id
                SET o.status = 'cancelled',
                    o.token_cifrado = NULL,
                    o.reservado_em = NULL,
                    o.falhou_em = NULL,
                    o.ultimo_erro = 'Solicitação substituída por um token mais recente.'
                WHERE r.usuario_id = ?
                  AND r.id <> ?
                  AND o.status IN ('pending', 'processing', 'failed')
                """,
                (usuario_id, recuperacao_token_id),
            )
            cursor.execute(
                """
                INSERT INTO password_reset_email_outbox
                    (recuperacao_token_id, email_destino, token_cifrado)
                VALUES (?, ?, ?)
                """,
                (recuperacao_token_id, email_destino, token_cifrado),
            )
        finally:
            cursor.close()

    @staticmethod
    def health_snapshot(timeout_reserva_segundos=300):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT
                        COALESCE(SUM(status = 'pending'), 0) AS pending,
                        COALESCE(SUM(status = 'processing'), 0) AS processing,
                        COALESCE(SUM(status = 'failed'), 0) AS failed,
                        COALESCE(SUM(status = 'sent'), 0) AS sent,
                        COALESCE(SUM(status = 'cancelled'), 0) AS cancelled,
                        COALESCE(
                            TIMESTAMPDIFF(
                                SECOND,
                                MIN(CASE WHEN status = 'pending' THEN criado_em END),
                                CURRENT_TIMESTAMP
                            ),
                            0
                        ) AS oldest_pending_age_seconds,
                        COALESCE(
                            SUM(
                                status = 'processing'
                                AND reservado_em < DATE_SUB(
                                    CURRENT_TIMESTAMP, INTERVAL ? SECOND
                                )
                            ),
                            0
                        ) AS stale_processing
                    FROM password_reset_email_outbox
                    """,
                    (timeout_reserva_segundos,),
                )
                return cursor.fetchone()
            finally:
                cursor.close()

    @staticmethod
    def reivindicar_proxima(max_tentativas=8, timeout_reserva_segundos=300):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE password_reset_email_outbox
                    SET status = CASE
                            WHEN tentativas >= ? THEN 'failed'
                            ELSE 'pending'
                        END,
                        falhou_em = CASE
                            WHEN tentativas >= ? THEN CURRENT_TIMESTAMP
                            ELSE NULL
                        END,
                        disponivel_em = CURRENT_TIMESTAMP,
                        reservado_em = NULL,
                        ultimo_erro = COALESCE(
                            ultimo_erro,
                            'Worker encerrou antes de confirmar o envio.'
                        )
                    WHERE status = 'processing'
                      AND reservado_em < DATE_SUB(
                          CURRENT_TIMESTAMP, INTERVAL ? SECOND
                      )
                    """,
                    (
                        max_tentativas,
                        max_tentativas,
                        timeout_reserva_segundos,
                    ),
                )
                cursor.execute(
                    """
                    SELECT id, recuperacao_token_id, email_destino, token_cifrado,
                           tentativas
                    FROM password_reset_email_outbox
                    WHERE status = 'pending'
                      AND tentativas < ?
                      AND disponivel_em <= CURRENT_TIMESTAMP
                    ORDER BY id
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """,
                    (max_tentativas,),
                )
                job = fetch_one(cursor)
                if job is None:
                    conn.commit()
                    return None

                cursor.execute(
                    """
                    UPDATE password_reset_email_outbox
                    SET status = 'processing',
                        tentativas = tentativas + 1,
                        reservado_em = CURRENT_TIMESTAMP,
                        ultimo_erro = NULL
                    WHERE id = ? AND status = 'pending'
                    """,
                    (job["id"],),
                )
                job["tentativas"] = int(job["tentativas"]) + 1
                conn.commit()
                return job
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def token_recuperacao_ativo(recuperacao_token_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT usado_em,
                           expires_at > CURRENT_TIMESTAMP AS nao_expirado
                    FROM recuperacao_tokens
                    WHERE id = ?
                    """,
                    (recuperacao_token_id,),
                )
                return fetch_one(cursor)
            finally:
                cursor.close()

    @staticmethod
    @contextmanager
    def bloquear_token_para_envio(recuperacao_token_id):
        """Serializa o envio com novas solicitações de recuperação do usuário."""
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT usuario_id FROM recuperacao_tokens WHERE id = ?",
                    (recuperacao_token_id,),
                )
                referencia = fetch_one(cursor)
                token = None
                if referencia:
                    cursor.execute(
                        "SELECT id FROM usuarios WHERE id = ? FOR UPDATE",
                        (referencia["usuario_id"],),
                    )
                    if fetch_one(cursor):
                        cursor.execute(
                            """
                            SELECT usado_em,
                                   expires_at > CURRENT_TIMESTAMP AS nao_expirado
                            FROM recuperacao_tokens
                            WHERE id = ? FOR UPDATE
                            """,
                            (recuperacao_token_id,),
                        )
                        token = fetch_one(cursor)
            finally:
                cursor.close()

            try:
                yield token
                conn.commit()
            except Exception:
                conn.rollback()
                raise

    @staticmethod
    def marcar_token_indisponivel(outbox_id, expirado):
        status = "failed" if expirado else "cancelled"
        erro = (
            "Token de recuperação expirou antes do envio."
            if expirado
            else "Token de recuperação foi substituído ou utilizado."
        )
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE password_reset_email_outbox
                    SET status = ?,
                        falhou_em = IF(? = 'failed', CURRENT_TIMESTAMP, NULL),
                        reservado_em = NULL,
                        token_cifrado = NULL,
                        ultimo_erro = ?
                    WHERE id = ? AND status = 'processing'
                    """,
                    (status, status, erro, outbox_id),
                )
                conn.commit()
                return cursor.rowcount == 1
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def marcar_enviado(outbox_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE password_reset_email_outbox
                    SET status = 'sent',
                        enviado_em = CURRENT_TIMESTAMP,
                        reservado_em = NULL,
                        token_cifrado = NULL,
                        ultimo_erro = NULL
                    WHERE id = ? AND status = 'processing'
                    """,
                    (outbox_id,),
                )
                conn.commit()
                return cursor.rowcount == 1
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def registrar_falha(outbox_id, tentativas, erro, max_tentativas=8):
        status = "failed" if tentativas >= max_tentativas else "pending"
        delay_segundos = min(30 * (2 ** max(0, tentativas - 1)), 300)
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE password_reset_email_outbox
                    SET status = ?,
                        disponivel_em = DATE_ADD(
                            CURRENT_TIMESTAMP, INTERVAL ? SECOND
                        ),
                        reservado_em = NULL,
                        falhou_em = IF(? = 'failed', CURRENT_TIMESTAMP, NULL),
                        ultimo_erro = ?
                    WHERE id = ? AND status = 'processing'
                    """,
                    (
                        status,
                        delay_segundos,
                        status,
                        str(erro)[:1000],
                        outbox_id,
                    ),
                )
                conn.commit()
                return cursor.rowcount == 1
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def reprocessar_falhos(outbox_id=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = """
                    UPDATE password_reset_email_outbox o
                    JOIN recuperacao_tokens r
                      ON r.id = o.recuperacao_token_id
                    SET o.status = 'pending',
                        o.tentativas = 0,
                        o.disponivel_em = CURRENT_TIMESTAMP,
                        o.reservado_em = NULL,
                        o.falhou_em = NULL,
                        o.ultimo_erro = NULL
                    WHERE o.status = 'failed'
                      AND o.token_cifrado IS NOT NULL
                      AND r.usado_em IS NULL
                      AND r.expires_at > CURRENT_TIMESTAMP
                """
                params = ()
                if outbox_id is not None:
                    query += " AND o.id = ?"
                    params = (outbox_id,)
                cursor.execute(query, params)
                reprocessados = cursor.rowcount
                conn.commit()
                return reprocessados
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()
