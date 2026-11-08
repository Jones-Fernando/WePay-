from database.connection import cursor_for, fetch_one, get_connection_context


class PushOutboxModel:
    @staticmethod
    def enfileirar(notificacao_id, conn):
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                INSERT INTO push_outbox (notificacao_id)
                VALUES (?)
                """,
                (notificacao_id,),
            )
        finally:
            cursor.close()

    @staticmethod
    def reivindicar_proxima(max_tentativas=8, timeout_reserva_segundos=300):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE push_outbox
                    SET status = 'failed',
                        reservado_em = NULL,
                        ultimo_erro = COALESCE(
                            ultimo_erro,
                            'Worker encerrou antes de confirmar o envio.'
                        )
                    WHERE status = 'processing'
                      AND reservado_em < DATE_SUB(
                          CURRENT_TIMESTAMP, INTERVAL ? SECOND
                      )
                      AND tentativas >= ?
                    """,
                    (timeout_reserva_segundos, max_tentativas),
                )
                cursor.execute(
                    """
                    SELECT id, notificacao_id, tentativas
                    FROM push_outbox
                    WHERE tentativas < ?
                      AND (
                          (status = 'pending'
                           AND disponivel_em <= CURRENT_TIMESTAMP)
                          OR
                          (status = 'processing'
                           AND reservado_em < DATE_SUB(
                               CURRENT_TIMESTAMP, INTERVAL ? SECOND
                           ))
                      )
                    ORDER BY id
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                    """,
                    (max_tentativas, timeout_reserva_segundos),
                )
                job = fetch_one(cursor)
                if job is None:
                    conn.commit()
                    return None

                cursor.execute(
                    """
                    UPDATE push_outbox
                    SET status = 'processing',
                        tentativas = tentativas + 1,
                        reservado_em = CURRENT_TIMESTAMP,
                        ultimo_erro = NULL
                    WHERE id = ?
                    """,
                    (job["id"],),
                )
                job["tentativas"] = int(job["tentativas"]) + 1
                conn.commit()
                return job
            finally:
                cursor.close()

    @staticmethod
    def marcar_enviado(outbox_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE push_outbox
                    SET status = 'sent',
                        enviado_em = CURRENT_TIMESTAMP,
                        reservado_em = NULL,
                        ultimo_erro = NULL
                    WHERE id = ? AND status = 'processing'
                    """,
                    (outbox_id,),
                )
                if cursor.rowcount != 1:
                    raise RuntimeError(
                        "A reserva do evento push expirou antes da confirmação."
                    )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def registrar_falha(outbox_id, tentativas, erro, max_tentativas=8):
        delay_segundos = min(30 * (2 ** max(0, tentativas - 1)), 3600)
        status = "failed" if tentativas >= max_tentativas else "pending"
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE push_outbox
                    SET status = ?,
                        disponivel_em = DATE_ADD(
                            CURRENT_TIMESTAMP, INTERVAL ? SECOND
                        ),
                        reservado_em = NULL,
                        ultimo_erro = ?
                    WHERE id = ? AND status = 'processing'
                    """,
                    (status, delay_segundos, str(erro)[:1000], outbox_id),
                )
                if cursor.rowcount != 1:
                    raise RuntimeError(
                        "A reserva do evento push expirou ao registrar falha."
                    )
                conn.commit()
            finally:
                cursor.close()
