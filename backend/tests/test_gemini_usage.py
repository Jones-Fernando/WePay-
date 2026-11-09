from config import Config
from database.connection import cursor_for, get_connection_context
from models.gemini_usage_model import GeminiUsageModel


def test_usage_daily_records_user_and_global_totals_and_alerts_once(
    monkeypatch, caplog
):
    caplog.set_level("WARNING")
    monkeypatch.setattr(Config, "GEMINI_DAILY_ALERT_REQUESTS", 2)

    GeminiUsageModel.registrar_solicitacao(900001, "test-model", 100)
    GeminiUsageModel.registrar_solicitacao(900001, "test-model", 250)
    GeminiUsageModel.registrar_solicitacao(900002, "test-model", 50)

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT usuario_id, solicitacoes, bytes_imagem, alerta_emitido
                FROM gemini_usage_diaria
                WHERE modelo = 'test-model'
                ORDER BY usuario_id
                """
            )
            linhas = cursor.fetchall()
        finally:
            cursor.close()

    assert linhas == [
        {
            "usuario_id": 0,
            "solicitacoes": 3,
            "bytes_imagem": 400,
            "alerta_emitido": 1,
        },
        {
            "usuario_id": 900001,
            "solicitacoes": 2,
            "bytes_imagem": 350,
            "alerta_emitido": 0,
        },
        {
            "usuario_id": 900002,
            "solicitacoes": 1,
            "bytes_imagem": 50,
            "alerta_emitido": 0,
        },
    ]
    assert sum(
        "Alerta de consumo Gemini" in record.message
        for record in caplog.records
    ) == 1
    assert GeminiUsageModel.resumo(1)[0]["solicitacoes"] == 3
