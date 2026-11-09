"""Regras financeiras do WEPAY.

A fonte de verdade é:
    despesas + despesa_divisoes + pagamentos

A tabela saldos funciona apenas como um cache/materialização recalculável.
Valores monetários são tratados com Decimal durante os cálculos.
"""

from database.connection import get_connection_context, cursor_for, fetch_all, fetch_one
from services.financeiro_calculo_service import (
    ZERO,
    FinanceiroCalculoService,
    format_date,
    money,
)
from services.financeiro_pagamento_service import FinanceiroPagamentoService
from services.financeiro_saldo_service import FinanceiroSaldoService

_UNSET = object()


class FinanceiroService:
    @staticmethod
    def lock_group(conn, grupo_id):
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "SELECT id FROM grupos WHERE id = ? FOR UPDATE",
                (grupo_id,),
            )
            if not fetch_one(cursor):
                raise LookupError("Grupo nao encontrado.")
        finally:
            cursor.close()

    @staticmethod
    def _validar_acesso_despesa(conn, grupo_id, ator_id, criador_id):
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                SELECT p.papel
                FROM participantes p
                JOIN usuarios u ON u.id = p.usuario_id
                WHERE p.grupo_id = ?
                  AND p.usuario_id = ?
                  AND p.ativo = 1
                  AND u.excluido_em IS NULL
                FOR UPDATE
                """,
                (grupo_id, ator_id),
            )
            participante = fetch_one(cursor)
        finally:
            cursor.close()

        if not participante or (
            int(ator_id) != int(criador_id or 0)
            and participante["papel"] != "admin"
        ):
            raise PermissionError(
                "Apenas o autor da despesa ou um administrador ativo pode alterá-la."
            )

    @staticmethod
    def _delta_despesa(pagador_id, valor, divisoes, multiplicador=1):
        return FinanceiroCalculoService.delta_despesa(
            pagador_id, valor, divisoes, multiplicador
        )

    @staticmethod
    def _aplicar_delta_saldos(conn, grupo_id, deltas):
        cursor = cursor_for(conn)
        try:
            for usuario_id, delta in deltas.items():
                cursor.execute(
                    """
                    INSERT INTO saldos (grupo_id, usuario_id, saldo)
                    VALUES (?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        saldo = saldo + VALUES(saldo),
                        atualizado_em = CURRENT_TIMESTAMP
                    """,
                    (grupo_id, usuario_id, money(delta)),
                )
        finally:
            cursor.close()

    @staticmethod
    def _dividir_igualmente(valor_total, ids):
        return FinanceiroCalculoService.dividir_igualmente(valor_total, ids)

    @staticmethod
    def _dividir_por_valores(valor_total, ids, valores):
        return FinanceiroCalculoService.dividir_por_valores(
            valor_total, ids, valores
        )

    @staticmethod
    def _validar_percentuais(ids, percentuais):
        return FinanceiroCalculoService.validar_percentuais(ids, percentuais)

    @staticmethod
    def _dividir_por_percentual(valor_total, ids, percentuais, soma):
        return FinanceiroCalculoService.dividir_por_percentual(
            valor_total, ids, percentuais, soma
        )

    @staticmethod
    def calcular_divisoes(valor_total, participantes_ids, tipo="igual", percentuais=None, valores=None):
        return FinanceiroCalculoService.calcular_divisoes(
            valor_total, participantes_ids, tipo, percentuais, valores
        )

    @staticmethod
    def _participantes_validos(conn, grupo_id, participantes_ids):
        ids = sorted({int(item) for item in participantes_ids})
        if not ids:
            raise ValueError("O grupo precisa ter participantes.")
        placeholders = ",".join(["?"] * len(ids))
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                f"""
                SELECT p.usuario_id
                FROM participantes p
                JOIN usuarios u ON u.id = p.usuario_id
                WHERE p.grupo_id = ?
                  AND p.ativo = 1
                  AND u.excluido_em IS NULL
                  AND p.usuario_id IN ({placeholders})
                """,
                (grupo_id, *ids),
            )
            rows = fetch_all(cursor)
            encontrados = {int(row["usuario_id"]) for row in rows}
        finally:
            cursor.close()
        if encontrados != set(ids):
            faltantes = sorted(set(ids) - encontrados)
            raise ValueError(f"Participante(s) invalido(s): {', '.join(map(str, faltantes))}.")
        return ids

    @staticmethod
    def _validar_pagador(conn, grupo_id, pagador_id):
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                SELECT p.usuario_id
                FROM participantes p
                JOIN usuarios u ON u.id = p.usuario_id
                WHERE p.grupo_id = ?
                  AND p.usuario_id = ?
                  AND p.ativo = 1
                  AND u.excluido_em IS NULL
                FOR UPDATE
                """,
                (grupo_id, pagador_id),
            )
            if not fetch_one(cursor):
                raise ValueError("Pagador deve ser participante ativo do grupo.")
        finally:
            cursor.close()

    @staticmethod
    def criar_despesa(
        grupo_id,
        pagador_id,
        descricao,
        valor,
        categoria=None,
        data_despesa=None,
        vencimento=None,
        divisao_tipo="igual",
        participantes=None,
        percentuais=None,
        valores=None,
        observacao=None,
        *,
        criador_id,
    ):
        valor = money(valor)
        if valor <= ZERO:
            raise ValueError("Valor deve ser maior que zero.")
        descricao = (descricao or "").strip()
        if not descricao:
            raise ValueError("Descricao eh obrigatoria.")
        observacao = (observacao or "").strip() or None
        if observacao is not None and len(observacao) > 500:
            raise ValueError("Observacao nao pode exceder 500 caracteres.")

        data_despesa = format_date(data_despesa)

        usuarios_notificados = []
        with get_connection_context() as conn:
            FinanceiroService.lock_group(conn, grupo_id)
            FinanceiroService._validar_acesso_despesa(
                conn, grupo_id, criador_id, criador_id
            )
            FinanceiroService._validar_pagador(conn, grupo_id, pagador_id)
            ids = FinanceiroService._participantes_validos(
                conn,
                grupo_id,
                participantes or [],
            )

            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO despesas "
                    "(grupo_id, pagador_id, criado_por, descricao, categoria, observacao, valor, data_despesa, vencimento) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        grupo_id,
                        pagador_id,
                        criador_id,
                        descricao,
                        categoria,
                        observacao,
                        valor,
                        data_despesa,
                        vencimento,
                    ),
                )
                despesa_id = cursor.lastrowid

                divisoes = FinanceiroService.calcular_divisoes(
                    valor,
                    ids,
                    divisao_tipo,
                    percentuais,
                    valores,
                )

                for divisao in divisoes:
                    cursor.execute(
                        "INSERT INTO despesa_divisoes "
                        "(despesa_id, usuario_id, tipo, percentual, valor) VALUES (?, ?, ?, ?, ?)",
                        (
                            despesa_id,
                            divisao["usuario_id"],
                            divisao["tipo"],
                            divisao["percentual"],
                            divisao["valor"],
                        ),
                    )

                # Notificacoes internas fazem parte da mesma transacao da despesa.
                from services.notificacao_service import NotificacaoService
                NotificacaoService.notificar_nova_despesa(
                    grupo_id, pagador_id, descricao, valor, conn
                )
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

            FinanceiroService._aplicar_delta_saldos(
                conn,
                grupo_id,
                FinanceiroService._delta_despesa(
                    pagador_id, valor, divisoes
                ),
            )
            conn.commit()
        return despesa_id

    @staticmethod
    def atualizar_despesa(
        despesa_id,
        descricao,
        valor,
        pagador_id,
        categoria=None,
        data_despesa=None,
        vencimento=None,
        divisao_tipo="igual",
        participantes=None,
        percentuais=None,
        valores=None,
        observacao=_UNSET,
        *,
        ator_id,
    ):
        valor = money(valor)
        descricao = (descricao or "").strip()
        if not descricao:
            raise ValueError("Descricao eh obrigatoria.")
        if valor <= ZERO:
            raise ValueError("Valor deve ser maior que zero.")

        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT grupo_id FROM despesas WHERE id = ?",
                    (despesa_id,),
                )
                referencia = fetch_one(cursor)
                if not referencia:
                    raise LookupError("Despesa nao encontrada.")

                grupo_id = referencia["grupo_id"]
                FinanceiroService.lock_group(conn, grupo_id)
                cursor.execute(
                    "SELECT * FROM despesas WHERE id = ? FOR UPDATE",
                    (despesa_id,),
                )
                despesa = fetch_one(cursor)
                if not despesa:
                    raise LookupError("Despesa nao encontrada.")
                grupo_id = despesa["grupo_id"]
                FinanceiroService._validar_acesso_despesa(
                    conn,
                    grupo_id,
                    ator_id,
                    despesa.get("criado_por"),
                )
                FinanceiroService._validar_pagador(conn, grupo_id, pagador_id)
                cursor.execute(
                    "SELECT usuario_id, valor FROM despesa_divisoes "
                    "WHERE despesa_id = ?",
                    (despesa_id,),
                )
                divisoes_anteriores = fetch_all(cursor)
                if observacao is _UNSET:
                    observacao_atual = despesa.get("observacao")
                elif observacao is None:
                    observacao_atual = None
                elif isinstance(observacao, str):
                    observacao_atual = observacao.strip() or None
                    if observacao_atual is not None and len(observacao_atual) > 500:
                        raise ValueError("Observacao nao pode exceder 500 caracteres.")
                else:
                    raise ValueError("Observacao deve ser um texto.")
                ids = FinanceiroService._participantes_validos(
                    conn,
                    grupo_id,
                    participantes or [],
                )

                cursor.execute(
                    "UPDATE despesas SET pagador_id = ?, descricao = ?, categoria = ?, "
                    "observacao = ?, valor = ?, data_despesa = ?, vencimento = ?, "
                    "atualizado_em = CURRENT_TIMESTAMP WHERE id = ?",
                    (
                        pagador_id,
                        descricao,
                        categoria,
                        observacao_atual,
                        valor,
                        data_despesa or despesa["data_despesa"],
                        vencimento,
                        despesa_id,
                    ),
                )

                cursor.execute("DELETE FROM despesa_divisoes WHERE despesa_id = ?", (despesa_id,))
                divisoes = FinanceiroService.calcular_divisoes(
                    valor,
                    ids,
                    divisao_tipo,
                    percentuais,
                    valores,
                )
                for divisao in divisoes:
                    cursor.execute(
                        "INSERT INTO despesa_divisoes "
                        "(despesa_id, usuario_id, tipo, percentual, valor) VALUES (?, ?, ?, ?, ?)",
                        (
                            despesa_id,
                            divisao["usuario_id"],
                            divisao["tipo"],
                            divisao["percentual"],
                            divisao["valor"],
                        ),
                    )

                deltas = FinanceiroService._delta_despesa(
                    despesa["pagador_id"],
                    despesa["valor"],
                    divisoes_anteriores,
                    -1,
                )
                for usuario_id, delta in FinanceiroService._delta_despesa(
                    pagador_id, valor, divisoes
                ).items():
                    deltas[usuario_id] += delta
                FinanceiroService._aplicar_delta_saldos(
                    conn, grupo_id, deltas
                )
                conn.commit()
                return grupo_id
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def deletar_despesa(despesa_id, ator_id):
        with get_connection_context() as conn:
            cursor = cursor_for(conn)
            try:
                cursor.execute("SELECT grupo_id FROM despesas WHERE id = ?", (despesa_id,))
                referencia = fetch_one(cursor)
                if not referencia:
                    raise LookupError("Despesa nao encontrada.")
                grupo_id = referencia["grupo_id"]
                FinanceiroService.lock_group(conn, grupo_id)
                cursor.execute(
                    "SELECT pagador_id, criado_por, valor FROM despesas "
                    "WHERE id = ? FOR UPDATE",
                    (despesa_id,),
                )
                despesa = fetch_one(cursor)
                if not despesa:
                    raise LookupError("Despesa nao encontrada.")
                FinanceiroService._validar_acesso_despesa(
                    conn,
                    grupo_id,
                    ator_id,
                    despesa.get("criado_por"),
                )
                cursor.execute(
                    "SELECT usuario_id, valor FROM despesa_divisoes "
                    "WHERE despesa_id = ?",
                    (despesa_id,),
                )
                divisoes = fetch_all(cursor)
                cursor.execute("DELETE FROM despesas WHERE id = ?", (despesa_id,))
                FinanceiroService._aplicar_delta_saldos(
                    conn,
                    grupo_id,
                    FinanceiroService._delta_despesa(
                        despesa["pagador_id"],
                        despesa["valor"],
                        divisoes,
                        -1,
                    ),
                )
                conn.commit()
                return grupo_id
            except Exception:
                conn.rollback()
                raise
            finally:
                cursor.close()

    @staticmethod
    def _calcular_saldos_esperados(conn, grupo_id):
        return FinanceiroSaldoService.calcular_saldos_esperados(conn, grupo_id)

    @staticmethod
    def recalcular_saldos(conn, grupo_id):
        return FinanceiroSaldoService.recalcular_saldos(conn, grupo_id)

    @staticmethod
    def reconciliar_saldos(grupo_id, corrigir=True):
        return FinanceiroSaldoService.reconciliar_saldos(
            grupo_id,
            corrigir,
            lock_group=FinanceiroService.lock_group,
            recalcular_saldos=FinanceiroService.recalcular_saldos,
        )

    @staticmethod
    def registrar_pagamento(
        grupo_id,
        pagador_id,
        recebedor_id,
        valor,
        data_pagamento=None,
        metodo=None,
        observacao=None,
    ):
        return FinanceiroPagamentoService.registrar_pagamento(
            grupo_id,
            pagador_id,
            recebedor_id,
            valor,
            data_pagamento,
            metodo,
            observacao,
            lock_group=FinanceiroService.lock_group,
            aplicar_delta_saldos=FinanceiroService._aplicar_delta_saldos,
        )

    @staticmethod
    def listar_pagamentos(grupo_id, limit=50, offset=0):
        return FinanceiroPagamentoService.listar_pagamentos(
            grupo_id, limit, offset
        )

    @staticmethod
    def saldos_grupo(grupo_id):
        return FinanceiroSaldoService.listar_saldos(grupo_id)

    @staticmethod
    def simplificar_saldos(saldos):
        return FinanceiroSaldoService.simplificar_saldos(saldos)
