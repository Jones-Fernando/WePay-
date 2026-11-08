"""Testes das regras financeiras usando MySQL."""

import pytest
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from database.connection import cursor_for, get_connection_context
from models.despesa_model import DespesaModel
from models.despesa_pessoal_model import DespesaPessoalModel
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from services.financeiro_service import FinanceiroService
from services.notificacao_service import NotificacaoService
from services.push_outbox_worker import processar_proxima


def criar_base():
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            ids = []
            for i in range(1, 4):
                cursor.execute("INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)", (f"Usuario {i}", f"u{i}@teste.com", "hash"))
                ids.append(cursor.lastrowid)
            gid = GrupoModel.criar("Teste", "Grupo", ids[0], conn)
            ParticipanteModel.adicionar(gid, ids[0], "admin", conn)
            ParticipanteModel.adicionar(gid, ids[1], "participante", conn)
            ParticipanteModel.adicionar(gid, ids[2], "participante", conn)
            conn.commit()
        finally:
            cursor.close()
    return ids, gid


def saldos_por_usuario(gid):
    return {int(row["usuario_id"]): Decimal(str(row["saldo"])) for row in FinanceiroService.saldos_grupo(gid)}


def test_divisao_igual_fecha_centavos():
    assert [row["valor"] for row in FinanceiroService.calcular_divisoes(100, [1, 2, 3], "igual")] == [Decimal("33.34"), Decimal("33.33"), Decimal("33.33")]


def test_divisao_porcentagem_fecha_exatamente():
    rows = FinanceiroService.calcular_divisoes(100, [1, 2, 3], "porcentagem", {"1": "33.33", "2": "33.33", "3": "33.34"})
    assert sum((row["valor"] for row in rows), Decimal("0")) == Decimal("100.00")


def test_divisao_igual_ordena_participantes_para_distribuir_centavos():
    rows = FinanceiroService.calcular_divisoes(0.02, [3, 1, 2], "igual")

    assert [row["usuario_id"] for row in rows] == [1, 2, 3]
    assert [row["valor"] for row in rows] == [
        Decimal("0.01"),
        Decimal("0.01"),
        Decimal("0.00"),
    ]


@pytest.mark.parametrize(
    ("tipo", "percentuais", "valores", "mensagem"),
    [
        ("desconhecido", None, None, "Tipo de divisao invalido."),
        ("valores", None, None, "Informe os valores individuais."),
        (
            "valores",
            None,
            {"1": "-1", "2": "101"},
            "Os valores individuais nao podem ser negativos.",
        ),
        ("porcentagem", None, None, "Informe os percentuais."),
        (
            "porcentagem",
            {"1": "-1", "2": "101"},
            None,
            "Percentuais nao podem ser negativos.",
        ),
        (
            "porcentagem",
            {"1": "0", "2": "0"},
            None,
            "A soma dos percentuais deve ser 100%.",
        ),
    ],
)
def test_divisao_rejeita_configuracoes_invalidas(
    tipo, percentuais, valores, mensagem
):
    with pytest.raises(ValueError, match=mensagem):
        FinanceiroService.calcular_divisoes(
            100,
            [1, 2],
            tipo,
            percentuais=percentuais,
            valores=valores,
        )


@pytest.mark.parametrize(
    "percentuais",
    [
        {"1": "50.00", "2": "49.99"},
        {"1": "50.00", "2": "50.01"},
    ],
)
def test_divisao_porcentagem_com_tolerancia_fecha_exatamente(percentuais):
    rows = FinanceiroService.calcular_divisoes(
        100000, [1, 2], "porcentagem", percentuais
    )

    assert sum((row["valor"] for row in rows), Decimal("0")) == Decimal("100000.00")


def test_divisao_por_valores_valida_soma():
    rows = FinanceiroService.calcular_divisoes(100, [1, 2, 3], "valores", valores={"1": "10", "2": "20", "3": "70"})
    assert sum((row["valor"] for row in rows), Decimal("0")) == Decimal("100.00")


def test_despesa_e_pagamento_zeram_saldos():
    ids, gid = criar_base()
    FinanceiroService.criar_despesa(gid, ids[0], "Jantar", 100, participantes=ids)
    assert saldos_por_usuario(gid) == {ids[0]: Decimal("66.66"), ids[1]: Decimal("-33.33"), ids[2]: Decimal("-33.33")}
    FinanceiroService.registrar_pagamento(gid, ids[1], ids[0], 33.33)
    FinanceiroService.registrar_pagamento(gid, ids[2], ids[0], 33.33)
    assert saldos_por_usuario(gid) == {ids[0]: Decimal("0.00"), ids[1]: Decimal("0.00"), ids[2]: Decimal("0.00")}


def test_pagamentos_concorrentes_nao_usam_o_mesmo_saldo_devedor():
    ids, gid = criar_base()
    FinanceiroService.criar_despesa(gid, ids[0], "Conta", 50, participantes=ids)
    barreira = Barrier(2)

    def pagar():
        barreira.wait()
        try:
            FinanceiroService.registrar_pagamento(gid, ids[1], ids[0], 16.67)
            return "pago"
        except ValueError:
            return "saldo_insuficiente"

    with ThreadPoolExecutor(max_workers=2) as executor:
        resultados = list(executor.map(lambda _: pagar(), range(2)))

    assert sorted(resultados) == ["pago", "saldo_insuficiente"]
    assert saldos_por_usuario(gid)[ids[1]] == Decimal("0.00")


def test_pagamento_aplica_delta_sem_recalcular_o_grupo(monkeypatch):
    ids, gid = criar_base()
    FinanceiroService.criar_despesa(gid, ids[0], "Conta", 50, participantes=ids)
    monkeypatch.setattr(
        FinanceiroService,
        "recalcular_saldos",
        staticmethod(lambda *_: pytest.fail("saldo não deve ser recalculado")),
    )
    FinanceiroService.registrar_pagamento(gid, ids[1], ids[0], 16.67)

    assert saldos_por_usuario(gid)[ids[1]] == Decimal("0.00")


def test_exclusao_de_despesa_reverte_os_deltas_de_saldo():
    ids, gid = criar_base()
    despesa_id = FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 60, participantes=ids
    )
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("40.00"),
        ids[1]: Decimal("-20.00"),
        ids[2]: Decimal("-20.00"),
    }

    FinanceiroService.deletar_despesa(despesa_id)

    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("0.00"),
        ids[1]: Decimal("0.00"),
        ids[2]: Decimal("0.00"),
    }


def test_nova_despesa_enfileira_push_e_worker_envia_apos_commit(monkeypatch):
    ids, gid = criar_base()
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "UPDATE usuarios SET notificacoes_ativas = 1 "
                "WHERE id = ?",
                (ids[1],),
            )
            cursor.execute(
                "INSERT INTO expo_push_tokens (usuario_id, token, plataforma) "
                "VALUES (?, ?, ?)",
                (ids[1], "ExpoPushToken[finance-test]", "ios"),
            )
            conn.commit()
        finally:
            cursor.close()

    mensagens = []
    monkeypatch.setattr(
        NotificacaoService,
        "_enviar_lote_push",
        staticmethod(lambda lote: mensagens.extend(lote)),
    )

    FinanceiroService.criar_despesa(
        gid, ids[0], "Mercado", 25, participantes=ids
    )

    assert mensagens == []
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                SELECT o.status
                FROM push_outbox o
                JOIN notificacoes n ON n.id = o.notificacao_id
                WHERE n.usuario_id = ?
                """,
                (ids[1],),
            )
            assert cursor.fetchone()["status"] == "pending"
        finally:
            cursor.close()

    assert processar_proxima() is True
    assert len(mensagens) == 1
    assert mensagens[0]["to"] == "ExpoPushToken[finance-test]"
    assert mensagens[0]["data"]["groupId"] == str(gid)
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                SELECT status, tentativas
                FROM push_outbox
                WHERE notificacao_id = (
                    SELECT id FROM notificacoes WHERE usuario_id = ?
                    ORDER BY id DESC LIMIT 1
                )
                """,
                (ids[1],),
            )
            assert cursor.fetchone() == {"status": "sent", "tentativas": 1}
        finally:
            cursor.close()


def test_edicao_aplica_deltas_sem_duplicar_despesa():
    ids, gid = criar_base()
    did = FinanceiroService.criar_despesa(gid, ids[0], "Jantar", 100, participantes=ids)
    FinanceiroService.atualizar_despesa(did, "Jantar 2", 120, ids[0], participantes=ids)
    assert len(DespesaModel.buscar_por_id(did)["divisoes"]) == 3
    assert sum((row["valor"] for row in DespesaModel.buscar_por_id(did)["divisoes"]), Decimal("0")) == Decimal("120.00")
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("80.00"),
        ids[1]: Decimal("-40.00"),
        ids[2]: Decimal("-40.00"),
    }


def test_operacoes_de_despesa_nao_recalculam_todo_o_grupo(monkeypatch):
    ids, gid = criar_base()
    monkeypatch.setattr(
        FinanceiroService,
        "recalcular_saldos",
        staticmethod(lambda *_: pytest.fail("saldo não deve ser recalculado")),
    )

    despesa_id = FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 90, participantes=ids
    )
    FinanceiroService.atualizar_despesa(
        despesa_id, "Conta atualizada", 120, ids[1], participantes=ids
    )
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("-40.00"),
        ids[1]: Decimal("80.00"),
        ids[2]: Decimal("-40.00"),
    }

    FinanceiroService.deletar_despesa(despesa_id)
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("0.00"),
        ids[1]: Decimal("0.00"),
        ids[2]: Decimal("0.00"),
    }


def test_reconciliacao_detecta_corrige_e_eh_idempotente():
    ids, gid = criar_base()
    FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 90, participantes=ids
    )
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "UPDATE saldos SET saldo = 999 WHERE grupo_id = ? AND usuario_id = ?",
                (gid, ids[0]),
            )
            cursor.execute(
                "DELETE FROM saldos WHERE grupo_id = ? AND usuario_id = ?",
                (gid, ids[2]),
            )
            conn.commit()
        finally:
            cursor.close()

    verificacao = FinanceiroService.reconciliar_saldos(gid, corrigir=False)
    assert [item["usuario_id"] for item in verificacao["divergencias"]] == [
        ids[0],
        ids[2],
    ]
    assert verificacao["corrigidas"] is False
    assert saldos_por_usuario(gid)[ids[0]] == Decimal("999.00")

    reparo = FinanceiroService.reconciliar_saldos(gid)
    assert len(reparo["divergencias"]) == 2
    assert reparo["corrigidas"] is True
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("60.00"),
        ids[1]: Decimal("-30.00"),
        ids[2]: Decimal("-30.00"),
    }

    assert FinanceiroService.reconciliar_saldos(gid)["divergencias"] == []


def test_despesa_pessoal_com_data_e_receita():
    ids, _ = criar_base()
    DespesaPessoalModel.criar(ids[0], "Mercado", 210, "Alimentação", "despesa", "2026-10-03")
    DespesaPessoalModel.criar(ids[0], "Salario", 1000, "Renda", "receita", "2026-10-03")
    resumo = DespesaPessoalModel.resumo_periodo(ids[0], "2026-10-01", "2026-10-31")
    assert Decimal(str(resumo["despesas"])) == Decimal("210.00")
    assert Decimal(str(resumo["receitas"])) == Decimal("1000.00")
    assert Decimal(str(resumo["saldo"])) == Decimal("790.00")
