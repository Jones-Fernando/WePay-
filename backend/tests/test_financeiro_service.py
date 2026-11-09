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


def test_lock_group_rejeita_grupo_inexistente():
    with get_connection_context() as conn:
        with pytest.raises(LookupError, match="Grupo nao encontrado"):
            FinanceiroService.lock_group(conn, 999999999)


def test_participantes_validos_normaliza_ids_e_rejeita_ids_ausentes():
    ids, gid = criar_base()

    with get_connection_context() as conn:
        assert FinanceiroService._participantes_validos(
            conn, gid, [ids[2], ids[0], ids[2]]
        ) == sorted([ids[0], ids[2]])
        with pytest.raises(ValueError, match="Participante\\(s\\) invalido"):
            FinanceiroService._participantes_validos(conn, gid, [999999999])
        with pytest.raises(ValueError, match="O grupo precisa ter participantes"):
            FinanceiroService._participantes_validos(conn, gid, [])


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


def test_simplificar_saldos_preserva_valores_e_ordem_deterministica():
    transferencias = FinanceiroService.simplificar_saldos(
        [
            {"usuario_id": 4, "nome": "Devedor", "saldo": "-8.00"},
            {"usuario_id": 2, "nome": "Credor menor", "saldo": "3.00"},
            {"usuario_id": 1, "nome": "Credor maior", "saldo": "5.00"},
            {"usuario_id": 3, "nome": "Neutro", "saldo": "0.00"},
        ]
    )

    assert transferencias == [
        {
            "devedor_id": 4,
            "devedor": "Devedor",
            "credor_id": 1,
            "credor": "Credor maior",
            "valor": Decimal("5.00"),
        },
        {
            "devedor_id": 4,
            "devedor": "Devedor",
            "credor_id": 2,
            "credor": "Credor menor",
            "valor": Decimal("3.00"),
        },
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
    FinanceiroService.criar_despesa(
        gid, ids[0], "Jantar", 100, participantes=ids, criador_id=ids[0]
    )
    assert saldos_por_usuario(gid) == {ids[0]: Decimal("66.66"), ids[1]: Decimal("-33.33"), ids[2]: Decimal("-33.33")}
    FinanceiroService.registrar_pagamento(gid, ids[1], ids[0], 33.33)
    FinanceiroService.registrar_pagamento(gid, ids[2], ids[0], 33.33)
    assert saldos_por_usuario(gid) == {ids[0]: Decimal("0.00"), ids[1]: Decimal("0.00"), ids[2]: Decimal("0.00")}


def test_pagamentos_concorrentes_nao_usam_o_mesmo_saldo_devedor():
    ids, gid = criar_base()
    FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 50, participantes=ids, criador_id=ids[0]
    )
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
    FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 50, participantes=ids, criador_id=ids[0]
    )
    monkeypatch.setattr(
        FinanceiroService,
        "recalcular_saldos",
        staticmethod(lambda *_: pytest.fail("saldo não deve ser recalculado")),
    )
    FinanceiroService.registrar_pagamento(gid, ids[1], ids[0], 16.67)

    assert saldos_por_usuario(gid)[ids[1]] == Decimal("0.00")


def test_listar_pagamentos_preserva_paginacao_e_ordem():
    ids, gid = criar_base()
    FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 60, participantes=ids, criador_id=ids[0]
    )
    FinanceiroService.registrar_pagamento(
        gid, ids[1], ids[0], 5, data_pagamento="2026-01-01"
    )
    FinanceiroService.registrar_pagamento(
        gid, ids[2], ids[0], 5, data_pagamento="2026-01-02"
    )

    primeira_pagina, primeira_paginacao = FinanceiroService.listar_pagamentos(
        gid, limit=1, offset=0
    )
    segunda_pagina, segunda_paginacao = FinanceiroService.listar_pagamentos(
        gid, limit=1, offset=1
    )

    assert [item["pagador_id"] for item in primeira_pagina] == [ids[2]]
    assert [item["pagador_id"] for item in segunda_pagina] == [ids[1]]
    assert primeira_paginacao == {
        "limit": 1,
        "offset": 0,
        "total": 2,
        "has_more": True,
    }
    assert segunda_paginacao == {
        "limit": 1,
        "offset": 1,
        "total": 2,
        "has_more": False,
    }


def test_pagamento_reverte_insert_quando_atualizacao_de_saldo_falha(monkeypatch):
    ids, gid = criar_base()
    FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 60, participantes=ids, criador_id=ids[0]
    )

    def falhar_atualizacao(*_args):
        raise RuntimeError("falha simulada ao atualizar saldos")

    monkeypatch.setattr(
        FinanceiroService,
        "_aplicar_delta_saldos",
        staticmethod(falhar_atualizacao),
    )

    with pytest.raises(RuntimeError, match="falha simulada"):
        FinanceiroService.registrar_pagamento(gid, ids[1], ids[0], 5)

    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("40.00"),
        ids[1]: Decimal("-20.00"),
        ids[2]: Decimal("-20.00"),
    }
    pagamentos, paginacao = FinanceiroService.listar_pagamentos(gid)
    assert pagamentos == []
    assert paginacao["total"] == 0


def test_exclusao_de_despesa_reverte_os_deltas_de_saldo():
    ids, gid = criar_base()
    despesa_id = FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 60, participantes=ids, criador_id=ids[0]
    )
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("40.00"),
        ids[1]: Decimal("-20.00"),
        ids[2]: Decimal("-20.00"),
    }

    FinanceiroService.deletar_despesa(despesa_id, ids[0])

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

    def enviar_push(lote):
        mensagens.extend(lote)
        return [
            {"status": "ok", "id": f"finance-ticket-{index}"}
            for index, _ in enumerate(lote)
        ]

    monkeypatch.setattr(
        NotificacaoService,
        "_enviar_lote_push",
        staticmethod(enviar_push),
    )

    FinanceiroService.criar_despesa(
        gid, ids[0], "Mercado", 25, participantes=ids, criador_id=ids[0]
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
                SELECT o.status, o.tentativas, d.status AS destino_status
                FROM push_outbox o
                JOIN notificacoes n ON n.id = o.notificacao_id
                JOIN push_outbox_destinatarios d ON d.outbox_id = o.id
                WHERE n.usuario_id = ?
                ORDER BY n.id DESC LIMIT 1
                """,
                (ids[1],),
            )
            assert cursor.fetchone() == {
                "status": "pending",
                "tentativas": 0,
                "destino_status": "ticketed",
            }
        finally:
            cursor.close()


def test_edicao_aplica_deltas_sem_duplicar_despesa():
    ids, gid = criar_base()
    did = FinanceiroService.criar_despesa(
        gid, ids[0], "Jantar", 100, participantes=ids, criador_id=ids[0]
    )
    FinanceiroService.atualizar_despesa(
        did, "Jantar 2", 120, ids[0], participantes=ids, ator_id=ids[0]
    )
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
        gid, ids[0], "Conta", 90, participantes=ids, criador_id=ids[0]
    )
    assert FinanceiroService.reconciliar_saldos(
        gid, corrigir=False
    )["divergencias"] == []

    FinanceiroService.atualizar_despesa(
        despesa_id,
        "Conta atualizada",
        120,
        ids[1],
        participantes=ids,
        ator_id=ids[0],
    )
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("-40.00"),
        ids[1]: Decimal("80.00"),
        ids[2]: Decimal("-40.00"),
    }
    assert FinanceiroService.reconciliar_saldos(
        gid, corrigir=False
    )["divergencias"] == []

    FinanceiroService.deletar_despesa(despesa_id, ids[0])
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("0.00"),
        ids[1]: Decimal("0.00"),
        ids[2]: Decimal("0.00"),
    }
    assert FinanceiroService.reconciliar_saldos(
        gid, corrigir=False
    )["divergencias"] == []


def test_reconciliacao_detecta_corrige_e_eh_idempotente():
    ids, gid = criar_base()
    FinanceiroService.criar_despesa(
        gid, ids[0], "Conta", 90, participantes=ids, criador_id=ids[0]
    )
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "INSERT INTO usuarios (nome, email, senha) "
                "VALUES ('Saldo órfão', 'saldo-orphao@example.com', 'hash')"
            )
            saldo_orfao_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO saldos (grupo_id, usuario_id, saldo) "
                "VALUES (?, ?, ?)",
                (gid, saldo_orfao_id, 12),
            )
            conn.commit()
        finally:
            cursor.close()
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
    assert [item["usuario_id"] for item in verificacao["divergencias"]] == sorted(
        [ids[0], ids[2], saldo_orfao_id]
    )
    assert verificacao["corrigidas"] is False
    assert saldos_por_usuario(gid)[ids[0]] == Decimal("999.00")

    reparo = FinanceiroService.reconciliar_saldos(gid)
    assert len(reparo["divergencias"]) == 3
    assert reparo["corrigidas"] is True
    assert saldos_por_usuario(gid) == {
        ids[0]: Decimal("60.00"),
        ids[1]: Decimal("-30.00"),
        ids[2]: Decimal("-30.00"),
    }
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM saldos "
                "WHERE grupo_id = ? AND usuario_id = ?",
                (gid, saldo_orfao_id),
            )
            assert cursor.fetchone()["total"] == 0
        finally:
            cursor.close()

    assert FinanceiroService.reconciliar_saldos(gid)["divergencias"] == []


def test_reconciliacao_remove_saldos_quando_livro_nao_tem_participantes():
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "INSERT INTO usuarios (nome, email, senha) "
                "VALUES ('Saldo vazio', 'saldo-vazio@example.com', 'hash')"
            )
            usuario_id = cursor.lastrowid
            grupo_id = GrupoModel.criar(
                "Grupo sem participantes", None, usuario_id, conn
            )
            cursor.execute(
                "INSERT INTO saldos (grupo_id, usuario_id, saldo) "
                "VALUES (?, ?, ?)",
                (grupo_id, usuario_id, 7),
            )
            conn.commit()
        finally:
            cursor.close()

    resultado = FinanceiroService.reconciliar_saldos(grupo_id)

    assert resultado["divergencias"] == [
        {
            "usuario_id": usuario_id,
            "esperado": Decimal("0.00"),
            "armazenado": Decimal("7.00"),
        }
    ]
    assert resultado["corrigidas"] is True
    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM saldos WHERE grupo_id = ?",
                (grupo_id,),
            )
            assert cursor.fetchone()["total"] == 0
        finally:
            cursor.close()


def test_criar_despesa_reverte_insert_quando_divisao_falha():
    ids, gid = criar_base()

    with pytest.raises(ValueError, match="A soma dos percentuais deve ser 100%"):
        FinanceiroService.criar_despesa(
            gid,
            ids[0],
            "Despesa inválida",
            90,
            divisao_tipo="porcentagem",
            participantes=ids,
            percentuais={str(ids[0]): 50, str(ids[1]): 49, str(ids[2]): 0},
            criador_id=ids[0],
        )

    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM despesas "
                "WHERE grupo_id = ? AND descricao = ?",
                (gid, "Despesa inválida"),
            )
            assert cursor.fetchone()["total"] == 0
        finally:
            cursor.close()
    assert saldos_por_usuario(gid) == {
        usuario_id: Decimal("0.00") for usuario_id in ids
    }


def test_criar_despesa_rejeita_pagador_que_nao_participa_do_grupo():
    ids, gid = criar_base()

    with pytest.raises(
        ValueError, match="Pagador deve ser participante ativo do grupo"
    ):
        FinanceiroService.criar_despesa(
            gid,
            999999999,
            "Pagador inválido",
            90,
            participantes=ids,
            criador_id=ids[0],
        )

    with get_connection_context() as conn:
        cursor = cursor_for(conn)
        try:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM despesas "
                "WHERE grupo_id = ? AND descricao = ?",
                (gid, "Pagador inválido"),
            )
            assert cursor.fetchone()["total"] == 0
        finally:
            cursor.close()
    assert saldos_por_usuario(gid) == {
        usuario_id: Decimal("0.00") for usuario_id in ids
    }


def test_edicao_invalida_reverte_despesa_divisoes_e_saldos():
    ids, gid = criar_base()
    despesa_id = FinanceiroService.criar_despesa(
        gid,
        ids[0],
        "Despesa original",
        90,
        participantes=ids,
        criador_id=ids[0],
    )
    saldos_anteriores = saldos_por_usuario(gid)

    with pytest.raises(ValueError, match="A soma dos percentuais deve ser 100%"):
        FinanceiroService.atualizar_despesa(
            despesa_id,
            "Alteração inválida",
            120,
            ids[0],
            divisao_tipo="porcentagem",
            participantes=ids,
            percentuais={str(ids[0]): 50, str(ids[1]): 49, str(ids[2]): 0},
            ator_id=ids[0],
        )

    despesa = DespesaModel.buscar_por_id(despesa_id)
    assert despesa["descricao"] == "Despesa original"
    assert sum(
        (row["valor"] for row in despesa["divisoes"]),
        Decimal("0"),
    ) == Decimal("90.00")
    assert saldos_por_usuario(gid) == saldos_anteriores


def test_edicao_rejeita_pagador_que_nao_participa_do_grupo():
    ids, gid = criar_base()
    despesa_id = FinanceiroService.criar_despesa(
        gid,
        ids[0],
        "Despesa original",
        90,
        participantes=ids,
        criador_id=ids[0],
    )
    saldos_anteriores = saldos_por_usuario(gid)

    with pytest.raises(
        ValueError, match="Pagador deve ser participante ativo do grupo"
    ):
        FinanceiroService.atualizar_despesa(
            despesa_id,
            "Alteração inválida",
            120,
            999999999,
            participantes=ids,
            ator_id=ids[0],
        )

    despesa = DespesaModel.buscar_por_id(despesa_id)
    assert despesa["descricao"] == "Despesa original"
    assert despesa["pagador_id"] == ids[0]
    assert sum(
        (row["valor"] for row in despesa["divisoes"]),
        Decimal("0"),
    ) == Decimal("90.00")
    assert saldos_por_usuario(gid) == saldos_anteriores


def test_despesa_pessoal_com_data_e_receita():
    ids, _ = criar_base()
    DespesaPessoalModel.criar(ids[0], "Mercado", 210, "Alimentação", "despesa", "2026-10-03")
    DespesaPessoalModel.criar(ids[0], "Salario", 1000, "Renda", "receita", "2026-10-03")
    resumo = DespesaPessoalModel.resumo_periodo(ids[0], "2026-10-01", "2026-10-31")
    assert Decimal(str(resumo["despesas"])) == Decimal("210.00")
    assert Decimal(str(resumo["receitas"])) == Decimal("1000.00")
    assert Decimal(str(resumo["saldo"])) == Decimal("790.00")
