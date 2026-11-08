"""Regras financeiras do WEPAY.

A fonte de verdade é:
    despesas + despesa_divisoes + pagamentos

A tabela saldos funciona apenas como um cache/materialização recalculável.
Valores monetários são tratados com Decimal durante os cálculos.
"""

from collections import defaultdict
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP
from datetime import date

from database.connection import get_connection_context, cursor_for, fetch_all, fetch_one

CENT = Decimal("0.01")
ZERO = Decimal("0.00")
_UNSET = object()


def money(value) -> Decimal:
    if isinstance(value, Decimal):
        return value.quantize(CENT, rounding=ROUND_HALF_UP)
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def decimal_or_zero(value) -> Decimal:
    return money(value or 0)


def format_date(value):
    if value:
        return value
    return date.today().isoformat()


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
    def _delta_despesa(pagador_id, valor, divisoes, multiplicador=1):
        deltas = defaultdict(lambda: ZERO)
        deltas[int(pagador_id)] += money(valor) * multiplicador
        for divisao in divisoes:
            deltas[int(divisao["usuario_id"])] -= (
                money(divisao["valor"]) * multiplicador
            )
        return deltas

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
        total_centavos = int((valor_total * 100).to_integral_value())
        base, restante = divmod(total_centavos, len(ids))
        return [
            {
                "usuario_id": uid,
                "tipo": "igual",
                "percentual": None,
                "valor": Decimal(base + (1 if index < restante else 0)) / 100,
            }
            for index, uid in enumerate(ids)
        ]

    @staticmethod
    def _dividir_por_valores(valor_total, ids, valores):
        if not isinstance(valores, dict):
            raise ValueError("Informe os valores individuais.")
        resultado = []
        total = ZERO
        for uid in ids:
            valor = money(valores.get(str(uid), valores.get(uid, 0)))
            if valor < ZERO:
                raise ValueError("Os valores individuais nao podem ser negativos.")
            total += valor
            resultado.append(
                {
                    "usuario_id": uid,
                    "tipo": "valores",
                    "percentual": None,
                    "valor": valor,
                }
            )
        if total != valor_total:
            raise ValueError(
                "A soma dos valores individuais deve ser igual ao valor da despesa."
            )
        return resultado

    @staticmethod
    def _validar_percentuais(ids, percentuais):
        if not isinstance(percentuais, dict):
            raise ValueError("Informe os percentuais.")

        resultado = {}
        soma = ZERO
        for uid in ids:
            percentual = Decimal(
                str(percentuais.get(str(uid), percentuais.get(uid, 0)))
            )
            if percentual < ZERO:
                raise ValueError("Percentuais nao podem ser negativos.")
            resultado[uid] = percentual
            soma += percentual

        if abs(soma - Decimal("100")) > Decimal("0.01"):
            raise ValueError("A soma dos percentuais deve ser 100%.")
        return resultado, soma

    @staticmethod
    def _dividir_por_percentual(valor_total, ids, percentuais, soma):
        # Método do maior resto: os centavos sempre fecham o valor total.
        total_centavos = int((valor_total * 100).to_integral_value())
        bases = {}
        restos = []
        soma_base = 0
        for uid in ids:
            bruto = (Decimal(total_centavos) * percentuais[uid]) / soma
            base = int(bruto.to_integral_value(rounding=ROUND_FLOOR))
            bases[uid] = base
            soma_base += base
            restos.append((bruto - Decimal(base), uid))

        faltantes = total_centavos - soma_base
        for _, uid in sorted(restos, key=lambda item: (-item[0], item[1]))[:faltantes]:
            bases[uid] += 1

        return [
            {
                "usuario_id": uid,
                "tipo": "porcentagem",
                "percentual": percentuais[uid].quantize(Decimal("0.0001")),
                "valor": Decimal(bases[uid]) / 100,
            }
            for uid in ids
        ]

    @staticmethod
    def calcular_divisoes(valor_total, participantes_ids, tipo="igual", percentuais=None, valores=None):
        valor_total = money(valor_total)
        ids = sorted({int(item) for item in participantes_ids})
        if not ids:
            raise ValueError("Selecione pelo menos um participante.")

        tipo = tipo or "igual"
        if tipo not in {"igual", "porcentagem", "valores"}:
            raise ValueError("Tipo de divisao invalido.")

        if tipo == "igual":
            return FinanceiroService._dividir_igualmente(valor_total, ids)

        if tipo == "valores":
            return FinanceiroService._dividir_por_valores(
                valor_total, ids, valores
            )

        percentuais_decimal, soma = FinanceiroService._validar_percentuais(
            ids, percentuais
        )
        return FinanceiroService._dividir_por_percentual(
            valor_total, ids, percentuais_decimal, soma
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
            ids = FinanceiroService._participantes_validos(
                conn,
                grupo_id,
                participantes or [],
            )

            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "INSERT INTO despesas "
                    "(grupo_id, pagador_id, descricao, categoria, observacao, valor, data_despesa, vencimento) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        grupo_id,
                        pagador_id,
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
    def deletar_despesa(despesa_id):
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
                    "SELECT pagador_id, valor FROM despesas "
                    "WHERE id = ? FOR UPDATE",
                    (despesa_id,),
                )
                despesa = fetch_one(cursor)
                if not despesa:
                    raise LookupError("Despesa nao encontrada.")
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

            # O pagador recebe o valor integral de cada despesa, enquanto sua
            # própria parte já foi descontada acima.
            cursor.execute(
                "SELECT pagador_id, valor FROM despesas WHERE grupo_id = ?",
                (grupo_id,),
            )
            for row in fetch_all(cursor):
                saldos[int(row["pagador_id"])] += money(row["valor"])

            # Pagamento devedor -> credor reduz a dívida do devedor e reduz o
            # crédito do recebedor.
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
        saldos = FinanceiroService._calcular_saldos_esperados(conn, grupo_id)
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
    def reconciliar_saldos(grupo_id, corrigir=True):
        """Compara saldos armazenados com o livro financeiro e opcionalmente corrige."""
        with get_connection_context() as conn:
            FinanceiroService.lock_group(conn, grupo_id)
            esperados = FinanceiroService._calcular_saldos_esperados(
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
                FinanceiroService.recalcular_saldos(conn, grupo_id)
            conn.commit()
            return {
                "grupo_id": int(grupo_id),
                "divergencias": divergencias,
                "corrigidas": bool(corrigir and divergencias),
            }

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
        valor = money(valor)
        if valor <= ZERO:
            raise ValueError("Valor do pagamento deve ser maior que zero.")
        if int(pagador_id) == int(recebedor_id):
            raise ValueError("Pagador e recebedor devem ser diferentes.")

        with get_connection_context() as conn:
            # Serializa alterações no livro do grupo e validações de pagamentos.
            FinanceiroService.lock_group(conn, grupo_id)
            cursor = cursor_for(conn)
            try:
                cursor.execute(
                    "SELECT usuario_id, ativo FROM participantes "
                    "WHERE grupo_id = ? AND usuario_id IN (?, ?) FOR UPDATE",
                    (grupo_id, pagador_id, recebedor_id),
                )
                participantes = fetch_all(cursor)
                estados = {int(row["usuario_id"]): int(row["ativo"]) for row in participantes}
                if estados.get(int(pagador_id)) != 1 or estados.get(int(recebedor_id)) != 1:
                    raise ValueError("Pagador e recebedor precisam ser participantes ativos do grupo.")

                cursor.execute(
                    "SELECT saldo FROM saldos WHERE grupo_id = ? AND usuario_id = ? FOR UPDATE",
                    (grupo_id, pagador_id),
                )
                saldo_pagador = money((fetch_one(cursor) or {}).get("saldo", 0))
                cursor.execute(
                    "SELECT saldo FROM saldos WHERE grupo_id = ? AND usuario_id = ? FOR UPDATE",
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
                        f"O pagamento nao pode exceder {limite.quantize(CENT, rounding=ROUND_HALF_UP)} para manter os saldos consistentes."
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
                FinanceiroService._aplicar_delta_saldos(
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

    @staticmethod
    def saldos_grupo(grupo_id):
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
            {"usuario_id": int(row["usuario_id"]), "nome": row["nome"], "valor": money(row["saldo"])}
            for row in saldos if money(row["saldo"]) > ZERO
        ]
        devedores = [
            {"usuario_id": int(row["usuario_id"]), "nome": row["nome"], "valor": -money(row["saldo"])}
            for row in saldos if money(row["saldo"]) < ZERO
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
