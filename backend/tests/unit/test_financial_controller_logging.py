from app import create_app
from controllers.despesa_controller import DespesaController
from controllers.pagamento_controller import PagamentoController
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from services.financeiro_service import FinanceiroService


app = create_app()


def test_expense_creation_logs_unexpected_error_without_exposing_it(
    monkeypatch, caplog
):
    monkeypatch.setattr(GrupoModel, "buscar_por_id", lambda *_: {"id": 1})
    monkeypatch.setattr(ParticipanteModel, "buscar", lambda *_: {"id": 1})
    monkeypatch.setattr(
        ParticipanteModel,
        "listar_por_grupo",
        lambda *_: [{"usuario_id": 7}],
    )

    def fail_create(**_kwargs):
        raise RuntimeError("database internals")

    monkeypatch.setattr(FinanceiroService, "criar_despesa", fail_create)

    with app.test_request_context(
        "/api/despesas",
        method="POST",
        json={
            "grupo_id": 1,
            "pagador_id": 7,
            "descricao": "Conta",
            "valor": 10,
        },
    ):
        response, status = DespesaController.criar(current_user_id=7)

    assert status == 500
    assert response.get_json()["mensagem"] == "Nao foi possivel registrar a despesa."
    assert "Falha ao criar despesa (grupo_id=1, usuario_id=7)." in caplog.text
    assert "database internals" in caplog.text
    assert "database internals" not in response.get_data(as_text=True)


def test_payment_creation_logs_unexpected_error_without_exposing_it(
    monkeypatch, caplog
):
    monkeypatch.setattr(GrupoModel, "buscar_por_id", lambda *_: {"id": 1})
    monkeypatch.setattr(ParticipanteModel, "buscar", lambda *_: {"id": 1})

    def fail_payment(**_kwargs):
        raise RuntimeError("database internals")

    monkeypatch.setattr(FinanceiroService, "registrar_pagamento", fail_payment)

    with app.test_request_context(
        "/api/pagamentos",
        method="POST",
        json={"grupo_id": 1, "recebedor_id": 8, "valor": 10},
    ):
        response, status = PagamentoController.criar(current_user_id=7)

    assert status == 500
    assert response.get_json()["mensagem"] == "Nao foi possivel registrar o pagamento."
    assert "Falha ao registrar pagamento (grupo_id=1, usuario_id=7)." in caplog.text
    assert "database internals" in caplog.text
    assert "database internals" not in response.get_data(as_text=True)
