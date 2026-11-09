"""Fluxos de registro e consulta de pagamentos de grupo."""

from datetime import date
from decimal import ROUND_HALF_UP

from database.connection import cursor_for, fetch_all, fetch_one, get_connection_context
from services.financeiro_calculo_service import CENT, ZERO, money


class FinanceiroPagamentoService:
    @staticmethod
    def registrar_pagamento(
        grupo_id,
        pagador_id,
        recebedor_id,
        valor,
        data_pagamento=None,
        metodo=None,
        observacao=None,
        *,
        lock_group,
        aplicar_delta_saldos,
    ):
        valor = money(valor)
        if valor <= ZERO:
            raise ValueError("Valor do pagamento deve ser maior que zero.")
        if int(pagador_id) == int(recebedor_id):
            raise ValueError("Pagador e recebedor devem ser diferentes.")

        with get_connection_context() as conn:
            lock_group(conn, grupo_id)
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT usuario_id, ativo FROM participantes "
                    "WHERE grupo_id = ? AND usuario_id IN (?, ?) FOR UPDATE",
                    (grupo_id, pagador_id, recebedor_id),
                )
                participantes = fetch_all(cursor)
                estados = {
                    int(row["usuario_id"]): int(row["ativo"])
                    for row in participantes
                }
                if (
                    estados.get(int(pagador_id)) != 1
                    or estados.get(int(recebedor_id)) != 1
                ):
                    raise ValueError(
                        "Pagador e recebedor precisam ser participantes ativos do grupo."
                    )

                cursor.execute(
                    "SELECT saldo FROM saldos "
                    "WHERE grupo_id = ? AND usuario_id = ? FOR UPDATE",
                    (grupo_id, pagador_id),
                )
                saldo_pagador = money((fetch_one(cursor) or {}).get("saldo", 0))
                cursor.execute(
                    "SELECT saldo FROM saldos "
                    "WHERE grupo_id = ? AND usuario_id = ? FOR UPDATE",
                    (grupo_id, recebedor_id),
                )
                saldo_recebedor = money((fetch_one(cursor) or {}).get("saldo", 0))

                if saldo_pagador >= ZERO:
                    raise ValueError("O pagador nao possui saldo devedor neste grupo.")
                if saldo_recebedor <= ZERO:
                    raise ValueError("O recebedor nao possui saldo a receber neste grupo.")

                limite = min(-saldo_pagador, saldo_recebedor)
                if valor > limite:
                    raise ValueError(
                        f"O pagamento nao pode exceder "
                        f"{limite.quantize(CENT, rounding=ROUND_HALF_UP)} "
                        "para manter os saldos consistentes."
                    )

                cursor.execute(
                    "INSERT INTO pagamentos "
                    "(grupo_id, pagador_id, recebedor_id, valor, data_pagamento, metodo, observacao) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (
                        grupo_id,
                        pagador_id,
                        recebedor_id,
                        valor,
                        data_pagamento or date.today().isoformat(),
                        metodo,
                        observacao,
                    ),
                )
                pagamento_id = cursor.lastrowid
                aplicar_delta_saldos(
                    conn,
                    grupo_id,
                    {
                        int(pagador_id): valor,
                        int(recebedor_id): -valor,
                    },
                )
                conn.commit()
                return pagamento_id
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def listar_pagamentos(grupo_id, limit=50, offset=0):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT COUNT(*) AS total FROM pagamentos WHERE grupo_id = ?",
                    (grupo_id,),
                )
                total = int(fetch_one(cursor)["total"])
                cursor.execute(
                    """
                    SELECT p.id, p.grupo_id, p.pagador_id, p.recebedor_id,
                           p.valor, p.data_pagamento, p.metodo, p.observacao,
                           u1.nome AS pagador, u2.nome AS recebedor
                    FROM pagamentos p
                    JOIN usuarios u1 ON u1.id = p.pagador_id
                    JOIN usuarios u2 ON u2.id = p.recebedor_id
                    WHERE p.grupo_id = ?
                    ORDER BY p.data_pagamento DESC, p.id DESC
                    LIMIT ? OFFSET ?
                    """,
                    (grupo_id, limit, offset),
                )
                dados = fetch_all(cursor)
                return dados, {
                    "limit": limit,
                    "offset": offset,
                    "total": total,
                    "has_more": offset + len(dados) < total,
                }
            finally:
                cursor.close()
