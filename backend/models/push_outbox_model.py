from database.connection import cursor_for, fetch_one, get_connection_context


class PushOutboxModel:
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
                    FROM push_outbox
                    """,
                    (timeout_reserva_segundos,),
                )
                return cursor.fetchone()
            finally:
                cursor.close()

    @staticmethod
    def reprocessar_falhos(outbox_id=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                filtro_outbox = "status = 'failed'"
                filtro_destinatario = "o.status = 'failed'"
                params: tuple[int, ...] = ()
                if outbox_id is not None:
                    filtro_outbox += " AND id = ?"
                    filtro_destinatario += " AND o.id = ?"
                    params = (outbox_id,)
                cursor.execute(
                    f"""
                    UPDATE push_outbox_destinatarios d
                    JOIN expo_push_tokens t ON t.token = d.token
                    JOIN push_outbox o ON o.id = d.outbox_id
                    SET d.status = 'pending',
                        d.ticket_id = NULL,
                        d.receipt_check_at = NULL,
                        d.receipt_expires_at = NULL,
                        d.ultimo_erro = NULL
                    WHERE {filtro_destinatario}
                      AND d.status = 'failed'
                    """,
                    params,
                )
                cursor.execute(
                    f"""
                    UPDATE push_outbox
                    SET status = 'pending',
                        tentativas = 0,
                        disponivel_em = CURRENT_TIMESTAMP,
                        reservado_em = NULL,
                        enviado_em = NULL,
                        ultimo_erro = NULL
                    WHERE {filtro_outbox}
                    """,
                    params,
                )
                reprocessados = cursor.rowcount
                conn.commit()
                return reprocessados
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def preparar_destinatarios(outbox_id, dispositivos):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                for dispositivo in dispositivos:
                    cursor.execute(
                        """
                        INSERT IGNORE INTO push_outbox_destinatarios
                            (outbox_id, expo_push_token_id, token)
                        VALUES (?, ?, ?)
                        """,
                        (
                            outbox_id,
                            dispositivo["token_id"],
                            dispositivo["token"],
                        ),
                    )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def marcar_recibos_expirados(outbox_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE push_outbox_destinatarios
                    SET status = 'failed',
                        receipt_check_at = NULL,
                        ultimo_erro = 'Expo nao disponibilizou o recibo em 24 horas.'
                    WHERE outbox_id = ?
                      AND status = 'ticketed'
                      AND receipt_expires_at <= CURRENT_TIMESTAMP
                    """,
                    (outbox_id,),
                )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def listar_destinatarios(outbox_id, status=None):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                query = (
                    "SELECT id, token, status, ticket_id "
                    "FROM push_outbox_destinatarios WHERE outbox_id = ?"
                )
                params = [outbox_id]
                if status is not None:
                    query += " AND status = ?"
                    params.append(status)
                query += " ORDER BY id"
                cursor.execute(query, tuple(params))
                return cursor.fetchall()
            finally:
                cursor.close()

    @staticmethod
    def recibos_pendentes(outbox_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT id, token, ticket_id
                    FROM push_outbox_destinatarios
                    WHERE outbox_id = ?
                      AND status = 'ticketed'
                      AND receipt_check_at <= CURRENT_TIMESTAMP
                    ORDER BY id
                    """,
                    (outbox_id,),
                )
                return cursor.fetchall()
            finally:
                cursor.close()

    @staticmethod
    def registrar_tickets(outbox_id, resultados):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                for resultado in resultados:
                    ticket = resultado["ticket"]
                    if ticket.get("status") == "ok":
                        ticket_id = ticket.get("id")
                        if isinstance(ticket_id, str) and ticket_id:
                            cursor.execute(
                                """
                                UPDATE push_outbox_destinatarios
                                SET status = 'ticketed', ticket_id = ?,
                                    receipt_check_at = DATE_ADD(
                                        CURRENT_TIMESTAMP, INTERVAL 15 MINUTE
                                    ),
                                    receipt_expires_at = DATE_ADD(
                                        CURRENT_TIMESTAMP, INTERVAL 1 DAY
                                    ),
                                    ultimo_erro = NULL
                                WHERE id = ? AND outbox_id = ?
                                  AND status = 'pending'
                                """,
                                (
                                    ticket_id,
                                    resultado["destinatario_id"],
                                    outbox_id,
                                ),
                            )
                            continue
                        erro = "Expo aceitou o push sem retornar um ticket válido."
                        cursor.execute(
                            """
                            UPDATE push_outbox_destinatarios
                            SET status = 'failed', ultimo_erro = ?
                            WHERE id = ? AND outbox_id = ?
                              AND status = 'pending'
                            """,
                            (erro, resultado["destinatario_id"], outbox_id),
                        )
                        continue

                    detalhes = ticket.get("details")
                    codigo = (
                        detalhes.get("error")
                        if isinstance(detalhes, dict)
                        else None
                    )
                    mensagem = str(ticket.get("message") or codigo or "Falha Expo")
                    if codigo == "DeviceNotRegistered":
                        cursor.execute(
                            "DELETE FROM expo_push_tokens WHERE token = ?",
                            (resultado["token"],),
                        )
                        status = "failed"
                    else:
                        status = "pending"
                    cursor.execute(
                        """
                        UPDATE push_outbox_destinatarios
                        SET status = ?, ultimo_erro = ?
                        WHERE id = ? AND outbox_id = ?
                          AND status = 'pending'
                        """,
                        (
                            status,
                            mensagem[:1000],
                            resultado["destinatario_id"],
                            outbox_id,
                        ),
                    )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def registrar_recibos(outbox_id, recibos):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT id, token, ticket_id
                    FROM push_outbox_destinatarios
                    WHERE outbox_id = ?
                      AND status = 'ticketed'
                      AND receipt_check_at <= CURRENT_TIMESTAMP
                    ORDER BY id
                    """,
                    (outbox_id,),
                )
                destinatarios = cursor.fetchall()
                for destinatario in destinatarios:
                    recibo = recibos.get(destinatario["ticket_id"])
                    if recibo is None:
                        cursor.execute(
                            """
                            UPDATE push_outbox_destinatarios
                            SET receipt_check_at = DATE_ADD(
                                CURRENT_TIMESTAMP, INTERVAL 15 MINUTE
                            )
                            WHERE id = ? AND outbox_id = ?
                              AND status = 'ticketed'
                            """,
                            (destinatario["id"], outbox_id),
                        )
                        continue
                    if not isinstance(recibo, dict):
                        raise RuntimeError("Expo retornou recibo inválido.")
                    if recibo.get("status") == "ok":
                        status = "provider_accepted"
                        erro = None
                    elif recibo.get("status") == "error":
                        status = "failed"
                        details = recibo.get("details")
                        codigo = (
                            details.get("error")
                            if isinstance(details, dict)
                            else None
                        )
                        erro = str(
                            recibo.get("message") or codigo or "Falha na entrega"
                        )[:1000]
                        if codigo == "DeviceNotRegistered":
                            cursor.execute(
                                "DELETE FROM expo_push_tokens WHERE token = ?",
                                (destinatario["token"],),
                            )
                    else:
                        raise RuntimeError("Expo retornou recibo inválido.")
                    cursor.execute(
                        """
                        UPDATE push_outbox_destinatarios
                        SET status = ?, ultimo_erro = ?, receipt_check_at = NULL,
                            receipt_expires_at = NULL
                        WHERE id = ? AND outbox_id = ?
                          AND status = 'ticketed'
                        """,
                        (status, erro, destinatario["id"], outbox_id),
                    )
                conn.commit()
            finally:
                cursor.close()

    @staticmethod
    def agendar_recibos(outbox_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    UPDATE push_outbox
                    SET status = 'pending',
                        disponivel_em = (
                            SELECT MIN(d.receipt_check_at)
                            FROM push_outbox_destinatarios d
                            WHERE d.outbox_id = ?
                              AND d.status = 'ticketed'
                        ),
                        reservado_em = NULL
                    WHERE id = ? AND status = 'processing'
                    """,
                    (outbox_id, outbox_id),
                )
                if cursor.rowcount != 1:
                    raise RuntimeError(
                        "A reserva do evento push expirou ao agendar recibos."
                    )
                conn.commit()
            finally:
                cursor.close()

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
                        tentativas = tentativas + 1,
                        reservado_em = NULL,
                        ultimo_erro = COALESCE(
                            ultimo_erro,
                            'Worker encerrou antes de confirmar o envio.'
                        )
                    WHERE status = 'processing'
                      AND reservado_em < DATE_SUB(
                          CURRENT_TIMESTAMP, INTERVAL ? SECOND
                      )
                      AND tentativas + 1 >= ?
                    """,
                    (timeout_reserva_segundos, max_tentativas),
                )
                cursor.execute(
                    """
                    UPDATE push_outbox
                    SET status = 'pending',
                        tentativas = tentativas + 1,
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
                    (timeout_reserva_segundos,),
                )
                cursor.execute(
                    """
                    SELECT id, notificacao_id, tentativas
                    FROM push_outbox
                    WHERE tentativas < ?
                      AND status = 'pending'
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
                    UPDATE push_outbox
                    SET status = 'processing',
                        reservado_em = CURRENT_TIMESTAMP,
                        ultimo_erro = NULL
                    WHERE id = ?
                    """,
                    (job["id"],),
                )
                job["tentativas"] = int(job["tentativas"])
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
        proxima_tentativa = tentativas + 1
        delay_segundos = min(30 * (2 ** max(0, tentativas)), 3600)
        status = "failed" if proxima_tentativa >= max_tentativas else "pending"
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
                        ultimo_erro = ?,
                        tentativas = ?
                    WHERE id = ? AND status = 'processing'
                    """,
                    (
                        status,
                        delay_segundos,
                        str(erro)[:1000],
                        proxima_tentativa,
                        outbox_id,
                    ),
                )
                if cursor.rowcount != 1:
                    raise RuntimeError(
                        "A reserva do evento push expirou ao registrar falha."
                    )
                conn.commit()
            finally:
                cursor.close()
