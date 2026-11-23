from contextlib import nullcontext
from unittest.mock import Mock

from services.financeiro_saldo_service import FinanceiroSaldoService


class FakeCursor:
    def __init__(self):
        self.query = ""

    def execute(self, query, _params=()):
        self.query = " ".join(query.split())

    def close(self):
        return None


def test_listar_pendencias_inclui_avatar_das_pessoas_envolvidas(monkeypatch):
    rows = [
        {
            "grupo_id": 10,
            "grupo_nome": "Casa",
            "usuario_id": 1,
            "saldo": -50,
            "nome": "Conta atual",
            "avatar_url": "data:image/png;base64,own",
        },
        {
            "grupo_id": 10,
            "grupo_nome": "Casa",
            "usuario_id": 2,
            "saldo": 50,
            "nome": "Credora",
            "avatar_url": "data:image/png;base64,creditor",
        },
        {
            "grupo_id": 20,
            "grupo_nome": "Viagem",
            "usuario_id": 1,
            "saldo": 40,
            "nome": "Conta atual",
            "avatar_url": "data:image/png;base64,own",
        },
        {
            "grupo_id": 20,
            "grupo_nome": "Viagem",
            "usuario_id": 3,
            "saldo": -40,
            "nome": "Devedora",
            "avatar_url": "data:image/png;base64,debtor",
        },
    ]
    cursor = FakeCursor()
    connection = Mock()
    monkeypatch.setattr(
        "services.financeiro_saldo_service.get_connection_context",
        lambda: nullcontext(connection),
    )
    monkeypatch.setattr(
        "services.financeiro_saldo_service.cursor_for",
        lambda _connection: cursor,
    )
    monkeypatch.setattr(
        "services.financeiro_saldo_service.fetch_all",
        lambda _cursor: rows,
    )

    resultado = FinanceiroSaldoService.listar_pendencias_usuario(1)

    assert "AS avatar_url" in cursor.query
    assert resultado["a_pagar"][0]["pessoa_avatar_url"] == (
        "data:image/png;base64,creditor"
    )
    assert resultado["a_receber"][0]["pessoa_avatar_url"] == (
        "data:image/png;base64,debtor"
    )
