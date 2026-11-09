"""Consulta, reconciliação e simplificação de saldos de grupo."""

from collections import defaultdict
from decimal import ROUND_HALF_UP

from database.connection import cursor_for, fetch_all, fetch_one, get_connection_context
from services.financeiro_calculo_service import CENT, ZERO, money


class FinanceiroSaldoService:
    @staticmethod
    def calcular_saldos_esperados(conn, grupo_id):
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                SELECT DISTINCT usuario_id FROM participantes WHERE grupo_id = ?
                UNION
                SELECT DISTINCT pagador_id FROM despesas WHERE grupo_id = ?
                UNION
                SELECT DISTINCT dd.usuario_id
                FROM despesa_divisoes dd
                JOIN despesas d ON d.id = dd.despesa_id
                WHERE d.grupo_id = ?
                UNION
                SELECT DISTINCT pagador_id FROM pagamentos WHERE grupo_id = ?
                UNION
                SELECT DISTINCT recebedor_id FROM pagamentos WHERE grupo_id = ?
                """,
                (grupo_id, grupo_id, grupo_id, grupo_id, grupo_id),
            )
            usuarios = {int(row["usuario_id"]) for row in fetch_all(cursor)}

            saldos = defaultdict(lambda: ZERO)

            cursor.execute(
                """
                SELECT d.pagador_id, dd.usuario_id, dd.valor AS valor_dividido
                FROM despesas d
                JOIN despesa_divisoes dd ON dd.despesa_id = d.id
                WHERE d.grupo_id = ?
                """,
                (grupo_id,),
            )
            for row in fetch_all(cursor):
                parte = money(row["valor_dividido"])
                usuario = int(row["usuario_id"])
                saldos[usuario] -= parte

            # O pagador recebe o valor integral da despesa, descontada sua parte acima.
            cursor.execute(
                "SELECT pagador_id, valor FROM despesas WHERE grupo_id = ?",
                (grupo_id,),
            )
            for row in fetch_all(cursor):
                saldos[int(row["pagador_id"])] += money(row["valor"])

            # Pagamento do devedor ao credor reduz a dívida e o crédito.
            cursor.execute(
                "SELECT pagador_id, recebedor_id, valor FROM pagamentos WHERE grupo_id = ?",
                (grupo_id,),
            )
            for row in fetch_all(cursor):
                valor = money(row["valor"])
                saldos[int(row["pagador_id"])] += valor
                saldos[int(row["recebedor_id"])] -= valor

            return {
                uid: saldos[uid].quantize(CENT, rounding=ROUND_HALF_UP)
                for uid in usuarios
            }
        finally:
            cursor.close()

    @staticmethod
    def recalcular_saldos(conn, grupo_id):
        """Reconstrói os saldos materializados a partir das fontes de verdade."""
        saldos = FinanceiroSaldoService.calcular_saldos_esperados(conn, grupo_id)
        cursor = cursor_for(conn)
        try:
            for uid, saldo in saldos.items():
                cursor.execute(
                    "INSERT INTO saldos (grupo_id, usuario_id, saldo) VALUES (?, ?, ?) "
                    "ON DUPLICATE KEY UPDATE saldo = VALUES(saldo), atualizado_em = CURRENT_TIMESTAMP",
                    (grupo_id, uid, saldo),
                )

            if saldos:
                placeholders = ",".join(["?"] * len(saldos))
                cursor.execute(
                    f"DELETE FROM saldos WHERE grupo_id = ? AND usuario_id NOT IN ({placeholders})",
                    (grupo_id, *sorted(saldos)),
                )
            else:
                cursor.execute("DELETE FROM saldos WHERE grupo_id = ?", (grupo_id,))
        finally:
            cursor.close()

    @staticmethod
    def reconciliar_saldos(
        grupo_id,
        corrigir=True,
        *,
        lock_group,
        recalcular_saldos,
    ):
        """Compara saldos armazenados com o livro financeiro e opcionalmente corrige."""
        with get_connection_context() as conn:
            lock_group(conn, grupo_id)
            esperados = FinanceiroSaldoService.calcular_saldos_esperados(
                conn, grupo_id
            )
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT usuario_id, saldo FROM saldos "
                    "WHERE grupo_id = ? FOR UPDATE",
                    (grupo_id,),
                )
                armazenados = {
                    int(row["usuario_id"]): money(row["saldo"])
                    for row in fetch_all(cursor)
                }
            finally:
                cursor.close()

            divergencias = []
            for usuario_id in sorted(set(esperados) | set(armazenados)):
                esperado = esperados.get(usuario_id, ZERO)
                armazenado = armazenados.get(usuario_id, ZERO)
                if (
                    usuario_id not in esperados
                    or usuario_id not in armazenados
                    or esperado != armazenado
                ):
                    divergencias.append(
                        {
                            "usuario_id": usuario_id,
                            "esperado": esperado,
                            "armazenado": armazenado,
                        }
                    )

            if corrigir and divergencias:
                recalcular_saldos(conn, grupo_id)
            conn.commit()
            return {
                "grupo_id": int(grupo_id),
                "divergencias": divergencias,
                "corrigidas": bool(corrigir and divergencias),
            }

    @staticmethod
    def listar_saldos(grupo_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    """
                    SELECT s.id, p.grupo_id, p.usuario_id,
                           COALESCE(s.saldo, 0) AS saldo,
                           CASE WHEN u.excluido_em IS NULL THEN u.nome
                                ELSE 'Usuário excluído' END AS nome,
                           CASE WHEN u.excluido_em IS NULL THEN u.email
                                ELSE NULL END AS email,
                           p.papel,
                           CASE WHEN u.excluido_em IS NULL THEN p.ativo
                                ELSE 0 END AS ativo
                    FROM participantes p
                    JOIN usuarios u ON u.id = p.usuario_id
                    LEFT JOIN saldos s
                      ON s.grupo_id = p.grupo_id
                     AND s.usuario_id = p.usuario_id
                    WHERE p.grupo_id = ?
                    ORDER BY saldo DESC, u.nome
                    """,
                    (grupo_id,),
                )
                return fetch_all(cursor)
            finally:
                cursor.close()

    @staticmethod
    def simplificar_saldos(saldos):
        credores = [
            {
                "usuario_id": int(row["usuario_id"]),
                "nome": row["nome"],
                "valor": money(row["saldo"]),
            }
            for row in saldos
            if money(row["saldo"]) > ZERO
        ]
        devedores = [
            {
                "usuario_id": int(row["usuario_id"]),
                "nome": row["nome"],
                "valor": -money(row["saldo"]),
            }
            for row in saldos
            if money(row["saldo"]) < ZERO
        ]

        credores.sort(key=lambda item: (-item["valor"], item["usuario_id"]))
        devedores.sort(key=lambda item: (-item["valor"], item["usuario_id"]))

        resultado = []
        i = j = 0
        while i < len(devedores) and j < len(credores):
            pagamento = min(devedores[i]["valor"], credores[j]["valor"])
            resultado.append({
                "devedor_id": devedores[i]["usuario_id"],
                "devedor": devedores[i]["nome"],
                "credor_id": credores[j]["usuario_id"],
                "credor": credores[j]["nome"],
                "valor": pagamento,
            })
            devedores[i]["valor"] -= pagamento
            credores[j]["valor"] -= pagamento
            if devedores[i]["valor"] <= CENT / 2:
                i += 1
            if credores[j]["valor"] <= CENT / 2:
                j += 1
        return resultado
