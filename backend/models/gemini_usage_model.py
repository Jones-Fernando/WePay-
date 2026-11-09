import logging
from datetime import datetime, timedelta, timezone

from config import Config
from database.connection import cursor_for, fetch_all, fetch_one, get_connection_context

_LOGGER = logging.getLogger(__name__)


class GeminiUsageModel:
    @staticmethod
    def registrar_solicitacao(usuario_id, modelo, bytes_imagem):
        data_utc = datetime.now(timezone.utc).date()
        disparar_alerta = False
        total_solicitacoes = 0

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    INSERT INTO gemini_usage_diaria
                        (data_utc, usuario_id, modelo, solicitacoes, bytes_imagem)
                    VALUES (?, 0, ?, 1, ?)
                    ON DUPLICATE KEY UPDATE
                        solicitacoes = solicitacoes + 1,
                        bytes_imagem = bytes_imagem + VALUES(bytes_imagem)
                    """,
                    (data_utc, modelo, bytes_imagem),
                )
                cursor.execute(
                    """
                    SELECT solicitacoes, alerta_emitido
                    FROM gemini_usage_diaria
                    WHERE data_utc = ? AND usuario_id = 0 AND modelo = ?
                    FOR UPDATE
                    """,
                    (data_utc, modelo),
                )
                global_usage = fetch_one(cursor)
                total_solicitacoes = int(global_usage["solicitacoes"])
                if (
                    total_solicitacoes >= Config.GEMINI_DAILY_ALERT_REQUESTS
                    and not bool(global_usage["alerta_emitido"])
                ):
                    cursor.execute(
                        """
                        UPDATE gemini_usage_diaria
                        SET alerta_emitido = 1
                        WHERE data_utc = ? AND usuario_id = 0 AND modelo = ?
                        """,
                        (data_utc, modelo),
                    )
                    disparar_alerta = True

                cursor.execute(
                    """
                    INSERT INTO gemini_usage_diaria
                        (data_utc, usuario_id, modelo, solicitacoes, bytes_imagem)
                    VALUES (?, ?, ?, 1, ?)
                    ON DUPLICATE KEY UPDATE
                        solicitacoes = solicitacoes + 1,
                        bytes_imagem = bytes_imagem + VALUES(bytes_imagem)
                    """,
                    (data_utc, usuario_id, modelo, bytes_imagem),
                )
                conn.commit()
            finally:
                cursor.close()

        if disparar_alerta:
            _LOGGER.warning(
                "Alerta de consumo Gemini: %s solicitações do modelo %s "
                "registradas em %s; limite de alerta diário=%s.",
                total_solicitacoes,
                modelo,
                data_utc.isoformat(),
                Config.GEMINI_DAILY_ALERT_REQUESTS,
            )
        return data_utc

    @staticmethod
    def resumo(dias=7):
        data_inicio = (
            datetime.now(timezone.utc).date() - timedelta(days=dias - 1)
        )
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT data_utc, modelo, solicitacoes, bytes_imagem,
                           alerta_emitido
                    FROM gemini_usage_diaria
                    WHERE usuario_id = 0 AND data_utc >= ?
                    ORDER BY data_utc DESC, modelo
                    """,
                    (data_inicio,),
                )
                return fetch_all(cursor)
            finally:
                cursor.close()
