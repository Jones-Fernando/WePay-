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


class DataRetentionModel:
    @staticmethod
    def limpar_registros_expirados(batch_size=500, dry_run=False):
        counts = {}
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                for table, condition in RETENTION_RULES:
                    if dry_run:
                        cursor.execute(
                            f"SELECT COUNT(*) AS total FROM {table} WHERE {condition}"
                        )
                        row = fetch_one(cursor)
                        counts[table] = int(row["total"])
                        continue

                    deleted = 0
                    while True:
                        cursor.execute(
                            f"""
                            DELETE FROM {table}
                            WHERE {condition}
                            ORDER BY id
                            LIMIT ?
                            """,
                            (batch_size,),
                        )
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
