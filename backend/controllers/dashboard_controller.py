from decimal import Decimal
from utils.response_utils import ResponseUtils
from database.connection import get_connection_context, cursor_for, fetch_one
from services.lembrete_service import LembreteService
from services.financeiro_service import FinanceiroService, money


class DashboardController:
    @staticmethod
    def obter_dados(current_user_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT
                      COALESCE(SUM(CASE WHEN saldo > 0 THEN saldo ELSE 0 END), 0) AS receber,
                      COALESCE(SUM(CASE WHEN saldo < 0 THEN ABS(saldo) ELSE 0 END), 0) AS pagar
                    FROM saldos
                    WHERE usuario_id = ?
                    """,
                    (current_user_id,),
                )
                saldo = fetch_one(cursor) or {"receber": 0, "pagar": 0}

                cursor.execute(
                    "SELECT COUNT(DISTINCT grupo_id) AS qtd FROM participantes WHERE usuario_id = ? AND ativo = 1",
                    (current_user_id,),
                )
                total_grupos = int((fetch_one(cursor) or {"qtd": 0})["qtd"])

                cursor.execute(
                    "SELECT COALESCE(SUM(dd.valor), 0) AS total "
                    "FROM despesa_divisoes dd JOIN despesas d ON d.id = dd.despesa_id "
                    "WHERE dd.usuario_id = ? AND d.grupo_id IN "
                    "(SELECT grupo_id FROM participantes WHERE usuario_id = ? AND ativo = 1)",
                    (current_user_id, current_user_id),
                )
                total_gasto_grupos = money((fetch_one(cursor) or {"total": 0})["total"])

                cursor.execute(
                    "SELECT COALESCE(SUM(valor), 0) AS total FROM despesas_pessoais "
                    "WHERE usuario_id = ? AND tipo = 'despesa'",
                    (current_user_id,),
                )
                total_gasto_pessoal = money((fetch_one(cursor) or {"total": 0})["total"])

                cursor.execute(
                    "SELECT COALESCE(SUM(valor), 0) AS total FROM despesas "
                    "WHERE grupo_id IN (SELECT grupo_id FROM participantes WHERE usuario_id = ? AND ativo = 1)",
                    (current_user_id,),
                )
                total_despesas_grupos = money((fetch_one(cursor) or {"total": 0})["total"])
            finally:
                cursor.close()

        lembretes = LembreteService.despesas_a_vencer(current_user_id, dias=3)
        return ResponseUtils.sucesso(
            dados={
                "receber": saldo["receber"],
                "pagar": saldo["pagar"],
                "total_grupos": total_grupos,
                "total_gasto_grupos": total_gasto_grupos,
                "total_gasto_pessoal": total_gasto_pessoal,
                "total_gasto_geral": total_gasto_grupos + total_gasto_pessoal,
                "total_despesas_grupos": total_despesas_grupos,
                "lembretes_proximos": lembretes,
            }
        )
