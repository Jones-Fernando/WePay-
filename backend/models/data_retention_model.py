import logging

from database.connection import cursor_for, fetch_one, get_connection_context

logger = logging.getLogger(__name__)

RETENTION_RULES = (
    (
        "refresh_tokens",
        "expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)",
    ),
    (
        "revoked_tokens",
        "expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)",
    ),
    (
        "recuperacao_tokens",
        """
        expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
        AND (usado_em IS NULL OR usado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY))
        """,
    ),
    (
        "convites_grupo",
        """
        expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)
        AND (usado_em IS NULL OR usado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY))
        """,
    ),
    (
        "push_outbox",
        "status = 'sent' AND enviado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)",
    ),
)

RETENTION_QUERIES = {
    "refresh_tokens": (
        "SELECT COUNT(*) AS total FROM refresh_tokens "
        "WHERE expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)",
        """
        DELETE FROM refresh_tokens
        WHERE expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
        ORDER BY id
        LIMIT ?
        """,
    ),
    "revoked_tokens": (
        "SELECT COUNT(*) AS total FROM revoked_tokens "
        "WHERE expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)",
        """
        DELETE FROM revoked_tokens
        WHERE expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
        ORDER BY id
        LIMIT ?
        """,
    ),
    "recuperacao_tokens": (
        """
        SELECT COUNT(*) AS total FROM recuperacao_tokens
        WHERE expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
          AND (usado_em IS NULL OR usado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY))
        """,
        """
        DELETE FROM recuperacao_tokens
        WHERE expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
          AND (usado_em IS NULL OR usado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY))
        ORDER BY id
        LIMIT ?
        """,
    ),
    "convites_grupo": (
        """
        SELECT COUNT(*) AS total FROM convites_grupo
        WHERE expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)
          AND (usado_em IS NULL OR usado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY))
        """,
        """
        DELETE FROM convites_grupo
        WHERE expires_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)
          AND (usado_em IS NULL OR usado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY))
        ORDER BY id
        LIMIT ?
        """,
    ),
    "push_outbox": (
        "SELECT COUNT(*) AS total FROM push_outbox "
        "WHERE status = 'sent' AND enviado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)",
        """
        DELETE FROM push_outbox
        WHERE status = 'sent' AND enviado_em < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY)
        ORDER BY id
        LIMIT ?
        """,
    ),
}


class DataRetentionModel:
    @staticmethod
    def limpar_registros_expirados(batch_size=500, dry_run=False):
        counts = {}
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                for table, _condition in RETENTION_RULES:
                    count_query, delete_query = RETENTION_QUERIES[table]
                    if dry_run:
                        cursor.execute(count_query)
                        row = fetch_one(cursor)
                        counts[table] = int(row["total"])
                        continue

                    deleted = 0
                    while True:
                        cursor.execute(delete_query, (batch_size,))
                        batch_count = int(cursor.rowcount)
                        if batch_count == 0:
                            break
                        conn.commit()
                        deleted += batch_count
                        logger.info(
                            "Lote de retenção removido: tabela=%s registros=%s total=%s",
                            table,
                            batch_count,
                            deleted,
                        )
                        if batch_count < batch_size:
                            break
                    counts[table] = deleted
            finally:
                cursor.close()

        return counts
