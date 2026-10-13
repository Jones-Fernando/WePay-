from datetime import date, timedelta

from database.connection import get_connection_context, cursor_for, fetch_all
from services.financeiro_service import money


class LembreteService:
    @staticmethod
    def despesas_a_vencer(usuario_id, dias=3):
        dias = max(0, min(int(dias), 365))
        hoje = date.today()
        fim = hoje + timedelta(days=dias)

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT DISTINCT
                        d.id AS despesa_id,
                        d.descricao,
                        d.valor,
                        d.vencimento,
                        d.grupo_id,
                        g.nome AS grupo_nome,
                        COALESCE(s.saldo, 0) AS saldo_no_grupo,
                        CASE WHEN d.pagador_id = ? THEN 1 ELSE 0 END AS sou_pagador
                    FROM despesas d
                    JOIN grupos g ON g.id = d.grupo_id
                    JOIN participantes p ON p.grupo_id = d.grupo_id
                                            AND p.usuario_id = ?
                                            AND p.ativo = 1
                    LEFT JOIN saldos s ON s.grupo_id = d.grupo_id
                                      AND s.usuario_id = ?
                    WHERE d.vencimento IS NOT NULL
                      AND d.vencimento BETWEEN ? AND ?
                      AND COALESCE(s.saldo, 0) <> 0
                    ORDER BY d.vencimento ASC, d.id ASC
                    """,
                    (usuario_id, usuario_id, usuario_id, hoje.isoformat(), fim.isoformat()),
                )
                rows = fetch_all(cursor)
            finally:
                cursor.close()

        resultado = []
        for row in rows:
            row["valor"] = money(row["valor"])
            row["saldo_no_grupo"] = money(row["saldo_no_grupo"])
            row["vencimento"] = str(row["vencimento"])
            row["sou_pagador"] = bool(row["sou_pagador"])
            row["dias_para_vencer"] = (
                date.fromisoformat(row["vencimento"]) - hoje
            ).days
            row["status"] = "a_receber" if row["saldo_no_grupo"] > 0 else "a_pagar"
            resultado.append(row)
        return resultado
