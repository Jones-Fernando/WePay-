"""Cálculos financeiros puros, sem acesso ao banco de dados."""

from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_UP

CENT = Decimal("0.01")
ZERO = Decimal("0.00")


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


class FinanceiroCalculoService:
    @staticmethod
    def delta_despesa(pagador_id, valor, divisoes, multiplicador=1):
        deltas = defaultdict(lambda: ZERO)
        deltas[int(pagador_id)] += money(valor) * multiplicador
        for divisao in divisoes:
            deltas[int(divisao["usuario_id"])] -= (
                money(divisao["valor"]) * multiplicador
            )
        return deltas

    @staticmethod
    def dividir_igualmente(valor_total, ids):
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
    def dividir_por_valores(valor_total, ids, valores):
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
    def validar_percentuais(ids, percentuais):
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
    def dividir_por_percentual(valor_total, ids, percentuais, soma):
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
    def calcular_divisoes(
        valor_total,
        participantes_ids,
        tipo="igual",
        percentuais=None,
        valores=None,
    ):
        valor_total = money(valor_total)
        ids = sorted({int(item) for item in participantes_ids})
        if not ids:
            raise ValueError("Selecione pelo menos um participante.")

        tipo = tipo or "igual"
        if tipo not in {"igual", "porcentagem", "valores"}:
            raise ValueError("Tipo de divisao invalido.")

        if tipo == "igual":
            return FinanceiroCalculoService.dividir_igualmente(valor_total, ids)

        if tipo == "valores":
            return FinanceiroCalculoService.dividir_por_valores(
                valor_total, ids, valores
            )

        percentuais_decimal, soma = (
            FinanceiroCalculoService.validar_percentuais(ids, percentuais)
        )
        return FinanceiroCalculoService.dividir_por_percentual(
            valor_total, ids, percentuais_decimal, soma
        )
