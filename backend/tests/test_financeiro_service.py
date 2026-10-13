"""Testes das regras financeiras usando MySQL."""

from decimal import Decimal

from database.connection import cursor_for, get_connection_context
from models.despesa_model import DespesaModel
from models.despesa_pessoal_model import DespesaPessoalModel
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from services.financeiro_service import FinanceiroService


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


def test_edicao_recalcula_sem_duplicar_despesa():
    ids, gid = criar_base()
    did = FinanceiroService.criar_despesa(gid, ids[0], "Jantar", 100, participantes=ids)
    FinanceiroService.atualizar_despesa(did, "Jantar 2", 120, ids[0], participantes=ids)
    assert len(DespesaModel.buscar_por_id(did)["divisoes"]) == 3
    assert sum((row["valor"] for row in DespesaModel.buscar_por_id(did)["divisoes"]), Decimal("0")) == Decimal("120.00")


def test_despesa_pessoal_com_data_e_receita():
    ids, _ = criar_base()
    DespesaPessoalModel.criar(ids[0], "Mercado", 210, "Alimentação", "despesa", "2026-10-03")
    DespesaPessoalModel.criar(ids[0], "Salario", 1000, "Renda", "receita", "2026-10-03")
    resumo = DespesaPessoalModel.resumo_periodo(ids[0], "2026-10-01", "2026-10-31")
    assert Decimal(str(resumo["despesas"])) == Decimal("210.00")
    assert Decimal(str(resumo["receitas"])) == Decimal("1000.00")
    assert Decimal(str(resumo["saldo"])) == Decimal("790.00")
