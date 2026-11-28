import pytest
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from contextlib import nullcontext
from io import BytesIO
from threading import Barrier

from app import create_app
from database.connection import cursor_for, get_connection_context, initialize_database
from database.group_cover_icons import (
    AVAILABLE_GROUP_COVER_ICONS,
    DEFAULT_GROUP_COVER_ICONS,
)
from utils.password_utils import hash_password
from utils.rate_limiter import limiter

app = create_app()


@pytest.fixture()
def client():
    app.config.update(TESTING=True)
    return app.test_client()


def cadastrar_usuario(client, nome, email, senha="SenhaSegura123!"):
    cadastro = client.post(
        "/api/auth/cadastro",
        json={"nome": nome, "email": email, "senha": senha},
    )
    assert cadastro.status_code == 201
    return cadastro


def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.get_json()["projeto"] == "wepay"


def test_installment_creation_endpoint_is_removed(client):
    response = client.post("/api/parcelamentos/pessoais", json={})

    assert response.status_code == 404


def test_liveness_does_not_query_dependencies(client, monkeypatch):
    monkeypatch.setattr(
        "app.get_connection_context",
        lambda: pytest.fail("Liveness must not connect to the database."),
    )
    monkeypatch.setattr(
        type(limiter.storage),
        "check",
        lambda _storage: pytest.fail("Liveness must not check rate-limit storage."),
    )

    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.get_json() == {"status": "Online"}


def test_readiness_checks_database_and_rate_limit_storage(client, monkeypatch):
    class Cursor:
        def __init__(self):
            self.query = None

        def execute(self, query):
            self.query = query

        def fetchone(self):
            return (1,)

        def close(self):
            return None

    class Connection:
        def __init__(self):
            self.cursor_instance = Cursor()

        def cursor(self):
            return self.cursor_instance

    connection = Connection()
    storage_checks = []
    monkeypatch.setattr(
        "app.get_connection_context",
        lambda: nullcontext(connection),
    )
    monkeypatch.setattr(
        type(limiter.storage),
        "check",
        lambda _storage: storage_checks.append(True) or True,
    )

    response = client.get("/health/ready")
    legacy_response = client.get("/health")

    assert response.status_code == 200
    assert legacy_response.status_code == 200
    assert response.get_json() == {
        "status": "Online",
        "database": "Online",
        "rate_limit_storage": "Online",
    }
    assert legacy_response.get_json() == response.get_json()
    assert connection.cursor_instance.query == "SELECT 1"
    assert storage_checks == [True, True]


@pytest.mark.parametrize("failed_dependency", ["database", "rate_limit_storage"])
def test_readiness_returns_503_when_required_dependency_fails(
    client, monkeypatch, failed_dependency
):
    class Cursor:
        def execute(self, _query):
            return None

        def fetchone(self):
            return (1,)

        def close(self):
            return None

    class Connection:
        def cursor(self):
            return Cursor()

    if failed_dependency == "database":
        def fail_database():
            raise OSError("database unavailable")

        monkeypatch.setattr("app.get_connection_context", fail_database)
    else:
        monkeypatch.setattr(
            "app.get_connection_context",
            lambda: nullcontext(Connection()),
        )

    storage_ok = failed_dependency != "rate_limit_storage"
    monkeypatch.setattr(
        type(limiter.storage),
        "check",
        lambda _storage: storage_ok,
    )

    response = client.get("/health/ready")

    assert response.status_code == 503
    assert response.get_json() == {
        "status": "indisponivel",
        "database": "erro" if failed_dependency == "database" else "Online",
        "rate_limit_storage": "erro" if not storage_ok else "Online",
    }


def test_group_creation_rejects_malformed_participant_ids(client):
    email = "invalid-group-participant@example.com"
    cadastrar_usuario(client, "Group Owner", email)
    login = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    headers = {"Authorization": f"Bearer {login['token']}"}

    for participant in ("not-an-id", 0, True, None):
        response = client.post(
            "/api/grupos",
            json={"nome": "Grupo válido", "participantes": [participant]},
            headers=headers,
        )
        assert response.status_code == 400

    invalid_body = client.post(
        "/api/grupos",
        json=[],
        headers=headers,
    )
    assert invalid_body.status_code == 400


def test_personal_expense_endpoints_reject_non_object_json(client):
    email = "invalid-personal-expense-body@example.com"
    cadastrar_usuario(client, "Personal Expense", email)
    login = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    headers = {"Authorization": f"Bearer {login['token']}"}

    created = client.post(
        "/api/despesas-pessoais",
        json={
            "descricao": "Despesa válida",
            "valor": 10,
            "tipo": "despesa",
            "data_despesa": "2026-11-07",
        },
        headers=headers,
    )
    assert created.status_code == 201
    expense_id = created.get_json()["data"]["id"]

    invalid_create = client.post(
        "/api/despesas-pessoais",
        json=[],
        headers=headers,
    )
    invalid_update = client.put(
        f"/api/despesas-pessoais/{expense_id}",
        json=[],
        headers=headers,
    )
    invalid_amounts = [
        client.post(
            "/api/despesas-pessoais",
            json={
                "descricao": "Valor fora do intervalo",
                "valor": "10000000000.00",
                "tipo": "despesa",
            },
            headers=headers,
        ),
        client.post(
            "/api/despesas-pessoais",
            json={
                "descricao": "Precisao fora do contexto",
                "valor": "1e1000",
                "tipo": "despesa",
            },
            headers=headers,
        ),
    ]

    assert invalid_create.status_code == 400
    assert invalid_update.status_code == 400
    assert [response.status_code for response in invalid_amounts] == [400, 400]


def test_auth_required(client):
    response = client.get("/api/grupos")
    assert response.status_code == 401
    assert client.delete("/api/grupos/999999").status_code == 401


def test_payment_routes_require_authentication_for_create_and_list(
    client, monkeypatch
):
    def controller_must_not_run(*_args, **_kwargs):
        pytest.fail("Payment controller must not run without authentication.")

    monkeypatch.setattr(
        "routes.pagamento_routes.PagamentoController.criar",
        staticmethod(controller_must_not_run),
    )
    monkeypatch.setattr(
        "routes.pagamento_routes.PagamentoController.listar",
        staticmethod(controller_must_not_run),
    )

    create_response = client.post(
        "/api/pagamentos",
        json={"grupo_id": 1, "recebedor_id": 2, "valor": 10},
    )
    list_response = client.get("/api/pagamentos/grupo/1")

    assert create_response.status_code == 401
    assert list_response.status_code == 401


def test_invalid_expense_and_payment_ids_return_400(client):
    email = "invalid-financial-ids@example.com"
    cadastrar_usuario(client, "Invalid IDs", email)
    login = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "SenhaSegura123!"},
    )
    headers = {
        "Authorization": f"Bearer {login.get_json()['data']['token']}"
    }
    user_id = login.get_json()["data"]["user"]["id"]
    group = client.post(
        "/api/grupos",
        json={"nome": "Grupo validação despesas"},
        headers=headers,
    )
    group_id = group.get_json()["data"]["id"]

    invalid_expense_group = client.post(
        "/api/despesas",
        json={"grupo_id": "not-an-id", "descricao": "Teste"},
        headers=headers,
    )
    invalid_expense_payer = client.post(
        "/api/despesas",
        json={"grupo_id": 1, "pagador_id": "not-an-id", "descricao": "Teste"},
        headers=headers,
    )
    invalid_payment_recipient = client.post(
        "/api/pagamentos",
        json={"grupo_id": 1, "recebedor_id": "not-an-id"},
        headers=headers,
    )
    invalid_participant_group = client.post(
        "/api/participantes",
        json={"grupo_id": "not-an-id", "usuario_id": 1},
        headers=headers,
    )
    invalid_invitation_group = client.post(
        "/api/participantes/convite",
        json={"grupo_id": "not-an-id", "email": "valid@example.com"},
        headers=headers,
    )
    invalid_invitation_token = client.post(
        "/api/participantes/convite/aceitar",
        json={"token": []},
        headers=headers,
    )
    invalid_participant_update_body = client.put(
        "/api/participantes/1",
        json=[],
        headers=headers,
    )
    invalid_expense_participants = client.post(
        "/api/despesas",
        json={
            "grupo_id": group_id,
            "descricao": "Despesa inválida",
            "valor": 10,
            "participantes": {"id": user_id},
        },
        headers=headers,
    )
    invalid_expense_description = client.post(
        "/api/despesas",
        json={
            "grupo_id": group_id,
            "descricao": ["Despesa"],
            "valor": 10,
            "participantes": [user_id],
        },
        headers=headers,
    )
    valid_expense = client.post(
        "/api/despesas",
        json={
            "grupo_id": group_id,
            "descricao": "Despesa para teste de edição",
            "valor": 10,
            "participantes": [user_id],
        },
        headers=headers,
    )
    invalid_expense_update = client.put(
        f"/api/despesas/{valid_expense.get_json()['data']['id']}",
        json={
            "descricao": "Despesa para teste de edição",
            "valor": 10,
            "participantes": "invalid",
        },
        headers=headers,
    )

    assert invalid_expense_group.status_code == 400
    assert invalid_expense_payer.status_code == 400
    assert invalid_payment_recipient.status_code == 400
    assert invalid_participant_group.status_code == 400
    assert invalid_invitation_group.status_code == 400
    assert invalid_invitation_token.status_code == 400
    assert invalid_participant_update_body.status_code == 400
    assert invalid_expense_participants.status_code == 400
    assert invalid_expense_description.status_code == 400
    assert valid_expense.status_code == 201
    assert invalid_expense_update.status_code == 400


def test_payment_api_records_and_lists_group_payment(client):
    emails = ("payment-owner@example.com", "payment-debtor@example.com")
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Payment User {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    debtor_headers = {"Authorization": f"Bearer {tokens[1]}"}
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo pagamento", "participantes": [user_ids[1]]},
        headers=owner_headers,
    )
    assert grupo.status_code == 201
    grupo_id = grupo.get_json()["data"]["id"]

    despesa = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo_id,
            "pagador_id": user_ids[0],
            "descricao": "Conta compartilhada",
            "valor": 100,
            "participantes": user_ids,
        },
        headers=owner_headers,
    )
    assert despesa.status_code == 201

    pagamento = client.post(
        "/api/pagamentos",
        json={
            "grupo_id": grupo_id,
            "recebedor_id": user_ids[0],
            "valor": 50,
            "data_pagamento": date.today().isoformat(),
            "metodo": "Pix",
            "observacao": "Pagamento da conta compartilhada",
        },
        headers={
            **debtor_headers,
            "Idempotency-Key": "payment-api-retry-001",
        },
    )
    assert pagamento.status_code == 201
    pagamento_id = pagamento.get_json()["data"]["id"]
    repetido = client.post(
        "/api/pagamentos",
        json={
            "grupo_id": grupo_id,
            "recebedor_id": user_ids[0],
            "valor": 50,
            "data_pagamento": date.today().isoformat(),
            "metodo": "Pix",
            "observacao": "Pagamento da conta compartilhada",
        },
        headers={
            **debtor_headers,
            "Idempotency-Key": "payment-api-retry-001",
        },
    )
    conflito = client.post(
        "/api/pagamentos",
        json={
            "grupo_id": grupo_id,
            "recebedor_id": user_ids[0],
            "valor": 49,
            "data_pagamento": date.today().isoformat(),
            "metodo": "Pix",
            "observacao": "Pagamento da conta compartilhada",
        },
        headers={
            **debtor_headers,
            "Idempotency-Key": "payment-api-retry-001",
        },
    )
    assert repetido.status_code == 201
    assert repetido.get_json() == pagamento.get_json()
    assert conflito.status_code == 409

    historico = client.get(
        f"/api/pagamentos/grupo/{grupo_id}", headers=owner_headers
    )
    assert historico.status_code == 200
    assert historico.get_json()["paginacao"] == {
        "limit": 50,
        "offset": 0,
        "total": 1,
        "has_more": False,
    }
    pagamento_listado = historico.get_json()["data"][0]
    assert {
        chave: valor
        for chave, valor in pagamento_listado.items()
        if chave != "data_pagamento"
    } == {
        "id": pagamento_id,
        "grupo_id": grupo_id,
        "pagador_id": user_ids[1],
        "recebedor_id": user_ids[0],
        "valor": 50.0,
        "metodo": "Pix",
        "observacao": "Pagamento da conta compartilhada",
        "pagador": "Payment User 1",
        "recebedor": "Payment User 0",
    }
    assert pagamento_listado["data_pagamento"] == (
        f"{date.today().strftime('%a, %d %b %Y')} 00:00:00 GMT"
    )
    pagina_vazia = client.get(
        f"/api/pagamentos/grupo/{grupo_id}?limit=1&offset=1",
        headers=owner_headers,
    )
    assert pagina_vazia.get_json()["data"] == []
    assert pagina_vazia.get_json()["paginacao"]["has_more"] is False
    assert client.get(
        f"/api/pagamentos/grupo/{grupo_id}?limit=101",
        headers=owner_headers,
    ).status_code == 400

    saldos = client.get(
        f"/api/saldos/grupo/{grupo_id}", headers=debtor_headers
    )
    assert saldos.status_code == 200
    assert all(
        saldo["saldo"] == 0
        for saldo in saldos.get_json()["data"]["saldos"]
    )


def test_concurrent_payment_api_requests_with_same_key_create_once(client):
    emails = ("payment-concurrent-owner@example.com", "payment-concurrent-debtor@example.com")
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Concurrent Payment User {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    debtor_headers = {"Authorization": f"Bearer {tokens[1]}"}
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo pagamento concorrente", "participantes": [user_ids[1]]},
        headers=owner_headers,
    )
    assert grupo.status_code == 201
    grupo_id = grupo.get_json()["data"]["id"]

    despesa = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo_id,
            "pagador_id": user_ids[0],
            "descricao": "Despesa concorrente",
            "valor": 60,
            "participantes": user_ids,
        },
        headers=owner_headers,
    )
    assert despesa.status_code == 201

    payload = {
        "grupo_id": grupo_id,
        "recebedor_id": user_ids[0],
        "valor": 10,
        "data_pagamento": date.today().isoformat(),
        "metodo": "Pix",
        "observacao": "Pagamento idempotente concorrente",
    }
    headers = {
        **debtor_headers,
        "Idempotency-Key": "payment-api-concurrent-001",
    }
    barrier = Barrier(2)

    def submit_payment(_):
        request_client = create_app().test_client()
        barrier.wait(timeout=5)
        response = request_client.post(
            "/api/pagamentos",
            json=payload,
            headers=headers,
        )
        return response.status_code, response.get_json()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(submit_payment, range(2)))

    assert [status for status, _ in results] == [201, 201]
    assert results[0][1] == results[1][1]

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT COUNT(*) AS total
                FROM pagamentos
                WHERE grupo_id = ? AND pagador_id = ?
                  AND idempotency_key = ?
                """,
                (grupo_id, user_ids[1], headers["Idempotency-Key"]),
            )
            assert cursor.fetchone()["total"] == 1
            cursor.execute(
                "SELECT saldo FROM saldos WHERE grupo_id = ? AND usuario_id = ?",
                (grupo_id, user_ids[1]),
            )
            assert cursor.fetchone()["saldo"] == -20
        finally:
            cursor.close()


def test_payment_api_rejects_malformed_idempotency_keys(client):
    email = "invalid-idempotency-key@example.com"
    cadastrar_usuario(client, "Invalid Idempotency Key", email)
    login = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    response = client.post(
        "/api/pagamentos",
        json={"grupo_id": 1, "recebedor_id": 2, "valor": 10},
        headers={
            "Authorization": f"Bearer {login['token']}",
            "Idempotency-Key": "invalid key",
        },
    )

    assert response.status_code == 400


def test_payment_api_rejects_invalid_fields_and_membership(client):
    emails = (
        "payment-field-owner@example.com",
        "payment-field-member@example.com",
        "payment-field-outsider@example.com",
    )
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Payment Field {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    member_headers = {"Authorization": f"Bearer {tokens[1]}"}
    outsider_headers = {"Authorization": f"Bearer {tokens[2]}"}
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo validação pagamento", "participantes": [user_ids[1]]},
        headers=owner_headers,
    ).get_json()["data"]["id"]

    payload_valido = {
        "grupo_id": grupo,
        "recebedor_id": user_ids[0],
        "valor": 10,
    }
    invalid_payloads = [
        [],
        {**payload_valido, "valor": "invalido"},
        {**payload_valido, "valor": 0},
        {**payload_valido, "data_pagamento": "07/11/2026"},
        {**payload_valido, "metodo": 123},
        {**payload_valido, "metodo": "x" * 51},
        {**payload_valido, "observacao": []},
        {**payload_valido, "observacao": "x" * 501},
        {**payload_valido, "recebedor_id": user_ids[2]},
    ]
    for payload in invalid_payloads:
        response = client.post(
            "/api/pagamentos",
            json=payload,
            headers=member_headers,
        )
        assert response.status_code == 400

    grupo_inexistente = client.get(
        "/api/pagamentos/grupo/999999", headers=owner_headers
    )
    grupo_nao_participante = client.get(
        f"/api/pagamentos/grupo/{grupo}", headers=outsider_headers
    )
    pagamento_nao_participante = client.post(
        "/api/pagamentos",
        json={**payload_valido, "grupo_id": 999999},
        headers=outsider_headers,
    )
    assert grupo_inexistente.status_code == 404
    assert grupo_nao_participante.status_code == 403
    assert pagamento_nao_participante.status_code == 404


def test_dashboard_and_due_reminders_include_group_and_personal_expenses(client):
    emails = ("dashboard-owner@example.com", "dashboard-member@example.com")
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Dashboard User {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    member_headers = {"Authorization": f"Bearer {tokens[1]}"}
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo dashboard", "participantes": [user_ids[1]]},
        headers=owner_headers,
    ).get_json()["data"]["id"]
    hoje = date.today()
    vencimento = (hoje + timedelta(days=2)).isoformat()
    despesa = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo,
            "pagador_id": user_ids[0],
            "descricao": "Despesa a vencer",
            "valor": 100,
            "data_despesa": hoje.isoformat(),
            "vencimento": vencimento,
            "participantes": user_ids,
        },
        headers=owner_headers,
    )
    assert despesa.status_code == 201
    pessoal = client.post(
        "/api/despesas-pessoais",
        json={
            "descricao": "Despesa pessoal do membro",
            "valor": 12,
            "tipo": "despesa",
            "data_despesa": hoje.isoformat(),
        },
        headers=member_headers,
    )
    assert pessoal.status_code == 201

    dashboard = client.get("/api/dashboard", headers=member_headers)
    assert dashboard.status_code == 200
    dados = dashboard.get_json()["data"]
    assert dados["receber"] == 0
    assert dados["pagar"] == 50
    assert dados["total_grupos"] == 1
    assert dados["total_gasto_grupos"] == 50
    assert dados["total_gasto_pessoal"] == 12
    assert dados["total_gasto_geral"] == 62
    assert dados["total_despesas_grupos"] == 100
    assert len(dados["lembretes_proximos"]) == 1
    assert dados["lembretes_proximos"][0]["status"] == "a_pagar"
    assert dados["lembretes_proximos"][0]["dias_para_vencer"] == 2
    assert dados["lembretes_proximos"][0]["sou_pagador"] is False

    lembretes = client.get("/api/lembretes?dias=2", headers=member_headers)
    assert lembretes.status_code == 200
    assert lembretes.get_json()["data"] == dados["lembretes_proximos"]
    assert lembretes.get_json()["paginacao"] == {
        "limit": 50,
        "offset": 0,
        "total": 1,
        "has_more": False,
    }
    assert client.get(
        "/api/lembretes?dias=2&limit=1&offset=1",
        headers=member_headers,
    ).get_json()["data"] == []
    assert client.get(
        "/api/lembretes?dias=1", headers=member_headers
    ).get_json()["data"] == []
    for dias in ("invalid", "-1", "366"):
        assert client.get(
            f"/api/lembretes?dias={dias}", headers=member_headers
        ).status_code == 400


def test_dashboard_pendencias_separates_receivables_and_payables_by_group(client):
    emails = (
        "dashboard-pendencias-owner@example.com",
        "dashboard-pendencias-member@example.com",
    )
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Pendencias User {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    member_headers = {"Authorization": f"Bearer {tokens[1]}"}
    hoje = date.today().isoformat()

    grupo_receber = client.post(
        "/api/grupos",
        json={"nome": "Grupo a receber", "participantes": [user_ids[1]]},
        headers=owner_headers,
    ).get_json()["data"]["id"]
    despesa_receber = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo_receber,
            "pagador_id": user_ids[0],
            "descricao": "Despesa paga pelo usuário",
            "valor": 100,
            "data_despesa": hoje,
            "participantes": user_ids,
        },
        headers=owner_headers,
    )
    assert despesa_receber.status_code == 201

    grupo_pagar = client.post(
        "/api/grupos",
        json={"nome": "Grupo a pagar", "participantes": [user_ids[0]]},
        headers=member_headers,
    ).get_json()["data"]["id"]
    despesa_pagar = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo_pagar,
            "pagador_id": user_ids[1],
            "descricao": "Despesa paga pelo participante",
            "valor": 60,
            "data_despesa": hoje,
            "participantes": user_ids,
        },
        headers=member_headers,
    )
    assert despesa_pagar.status_code == 201

    dashboard = client.get("/api/dashboard", headers=owner_headers)
    pendencias = client.get("/api/dashboard/pendencias", headers=owner_headers)
    assert dashboard.status_code == 200
    assert pendencias.status_code == 200
    totais = dashboard.get_json()["data"]
    detalhes = pendencias.get_json()["data"]

    assert float(totais["receber"]) == 50
    assert float(totais["pagar"]) == 30
    assert len(detalhes["a_receber"]) == 1
    assert len(detalhes["a_pagar"]) == 1

    receber = detalhes["a_receber"][0]
    assert receber["pessoa_id"] == user_ids[1]
    assert receber["pessoa_nome"] == "Pendencias User 1"
    assert receber["grupo_id"] == grupo_receber
    assert receber["grupo_nome"] == "Grupo a receber"
    assert float(receber["valor"]) == 50

    pagar = detalhes["a_pagar"][0]
    assert pagar["pessoa_id"] == user_ids[1]
    assert pagar["pessoa_nome"] == "Pendencias User 1"
    assert pagar["grupo_id"] == grupo_pagar
    assert pagar["grupo_nome"] == "Grupo a pagar"
    assert float(pagar["valor"]) == 30
    assert sum(float(item["valor"]) for item in detalhes["a_receber"]) == float(
        totais["receber"]
    )
    assert sum(float(item["valor"]) for item in detalhes["a_pagar"]) == float(
        totais["pagar"]
    )


def test_category_api_validates_filters_and_enforces_ownership(client):
    emails = ("categories-owner@example.com", "categories-other@example.com")
    tokens = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Category User {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    other_headers = {"Authorization": f"Bearer {tokens[1]}"}
    atualizado_icone = client.put(
        "/api/categorias/icones",
        json={"nome": "Casa", "tipo": "pessoal", "icone": "🛋️"},
        headers=owner_headers,
    )
    assert atualizado_icone.status_code == 200
    icones_owner = client.get(
        "/api/categorias/icones?tipo=pessoal", headers=owner_headers
    ).get_json()["data"]
    assert icones_owner == [
        {"nome": "Casa", "tipo": "pessoal", "icone": "🛋️"}
    ]
    assert client.get(
        "/api/categorias/icones", headers=other_headers
    ).get_json()["data"] == []
    assert client.put(
        "/api/categorias/icones",
        json={"nome": "Casa", "tipo": "pessoal", "icone": "invalido"},
        headers=owner_headers,
    ).status_code == 400
    assert client.get(
        "/api/categorias/icones?tipo=invalido", headers=owner_headers
    ).status_code == 400
    assert client.delete(
        "/api/categorias/icones?nome=Casa&tipo=pessoal",
        headers=owner_headers,
    ).status_code == 200
    assert client.get(
        "/api/categorias/icones", headers=owner_headers
    ).get_json()["data"] == []

    invalid_payloads = [
        [],
        {"nome": []},
        {"nome": " "},
        {"nome": "x" * 101},
        {"nome": "Viagem", "tipo": 1},
        {"nome": "Viagem", "tipo": "invalido"},
        {"nome": "Viagem", "icone": "não permitido"},
    ]
    for payload in invalid_payloads:
        assert client.post(
            "/api/categorias", json=payload, headers=owner_headers
        ).status_code == 400
    assert client.get(
        "/api/categorias?tipo=invalido", headers=owner_headers
    ).status_code == 400

    criada = client.post(
        "/api/categorias",
        json={"nome": "Viagem de teste", "tipo": "pessoal", "icone": "✈️"},
        headers=owner_headers,
    )
    assert criada.status_code == 201
    categoria_id = criada.get_json()["data"]["id"]
    duplicada = client.post(
        "/api/categorias",
        json={"nome": "Viagem de teste", "tipo": "pessoal"},
        headers=owner_headers,
    )
    assert duplicada.status_code == 409

    casa_padrao = next(
        item
        for item in client.get(
            "/api/categorias?tipo=pessoal", headers=owner_headers
        ).get_json()["data"]
        if item["nome"] == "Casa"
    )
    casa_atualizada = client.put(
        f"/api/categorias/{casa_padrao['id']}",
        json={"nome": "Casa", "tipo": "pessoal", "icone": "🛋️"},
        headers=owner_headers,
    )
    assert casa_atualizada.status_code == 200

    criada_ambos = client.post(
        "/api/categorias",
        json={"nome": "Categoria ampla de teste", "tipo": "ambos", "icone": "🛋️"},
        headers=owner_headers,
    )
    assert criada_ambos.status_code == 201
    criada_pessoal = client.post(
        "/api/categorias",
        json={"nome": "Cuidados pessoais", "tipo": "pessoal", "icone": "🧴"},
        headers=owner_headers,
    )
    assert criada_pessoal.status_code == 201
    listagem_pessoal = client.get(
        "/api/categorias?tipo=pessoal", headers=owner_headers
    ).get_json()["data"]
    assert {item["nome"] for item in listagem_pessoal} >= {
        "Viagem de teste",
        "Casa",
        "Cuidados pessoais",
    }
    assert next(item for item in listagem_pessoal if item["nome"] == "Casa")[
        "icone"
    ] == "🛋️"
    assert next(
        item for item in listagem_pessoal if item["nome"] == "Cuidados pessoais"
    )["icone"] == "🧴"
    assert next(
        item for item in listagem_pessoal if item["nome"] == "Viagem de teste"
    )["icone"] == "✈️"
    listagem_grupo = client.get(
        "/api/categorias?tipo=grupo", headers=owner_headers
    ).get_json()["data"]
    assert "Viagem" not in {item["nome"] for item in listagem_grupo}
    assert "Casa" in {item["nome"] for item in listagem_grupo}

    for payload in invalid_payloads:
        assert client.put(
            f"/api/categorias/{categoria_id}",
            json=payload,
            headers=owner_headers,
        ).status_code == 400
    atualizada = client.put(
        f"/api/categorias/{categoria_id}",
        json={"nome": "Viagens", "tipo": "ambos", "icone": "🧳"},
        headers=owner_headers,
    )
    assert atualizada.status_code == 200
    listagem_atualizada = client.get(
        "/api/categorias?tipo=grupo", headers=owner_headers
    ).get_json()["data"]
    assert next(item for item in listagem_atualizada if item["nome"] == "Viagens")[
        "icone"
    ] == "🧳"
    assert client.put(
        f"/api/categorias/{categoria_id}",
        json={"nome": "Outro nome"},
        headers=other_headers,
    ).status_code == 404
    assert client.put(
        "/api/categorias/999999",
        json={"nome": "Inexistente"},
        headers=owner_headers,
    ).status_code == 404
    assert client.delete(
        f"/api/categorias/{categoria_id}", headers=owner_headers
    ).status_code == 200
    assert client.delete(
        f"/api/categorias/{categoria_id}", headers=owner_headers
    ).status_code == 404
    assert client.delete(
        f"/api/categorias/{criada_ambos.get_json()['data']['id']}",
        headers=other_headers,
    ).status_code == 404


def test_personal_expense_api_covers_crud_filters_and_monthly_totals(client):
    emails = ("personal-crud-owner@example.com", "personal-crud-other@example.com")
    tokens = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Personal CRUD {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    other_headers = {"Authorization": f"Bearer {tokens[1]}"}
    hoje = date.today().isoformat()
    invalid_payloads = [
        [],
        {"descricao": 10, "valor": 5},
        {"descricao": " ", "valor": 5},
        {"descricao": "Teste", "categoria": []},
        {"descricao": "Teste", "tipo": 1},
        {"descricao": "Teste", "tipo": "invalido"},
        {"descricao": "Teste", "valor": "invalido"},
        {"descricao": "Teste", "valor": 0},
        {"descricao": "Teste", "valor": 5, "data_despesa": "01/01/2026"},
        {
            "descricao": "Teste",
            "valor": 5,
            "data_despesa": (date.today() + timedelta(days=1)).isoformat(),
        },
    ]
    for payload in invalid_payloads:
        assert client.post(
            "/api/despesas-pessoais", json=payload, headers=owner_headers
        ).status_code == 400

    despesa = client.post(
        "/api/despesas-pessoais",
        json={
            "descricao": "Mercado",
            "valor": 20,
            "categoria": "Alimentação",
            "tipo": "despesa",
            "data_despesa": hoje,
        },
        headers=owner_headers,
    )
    receita = client.post(
        "/api/despesas-pessoais",
        json={
            "descricao": "Salário",
            "valor": 35,
            "categoria": "Renda",
            "tipo": "receita",
            "data": hoje,
        },
        headers=owner_headers,
    )
    assert despesa.status_code == receita.status_code == 201
    despesa_id = despesa.get_json()["data"]["id"]
    receita_id = receita.get_json()["data"]["id"]
    categoria_renda = client.post(
        "/api/categorias",
        json={"nome": "Renda", "tipo": "pessoal"},
        headers=owner_headers,
    )
    assert categoria_renda.status_code == 201
    categoria_renda_id = categoria_renda.get_json()["data"]["id"]
    renda_em_uso = next(
        item
        for item in client.get(
            "/api/categorias?tipo=pessoal", headers=owner_headers
        ).get_json()["data"]
        if item["id"] == categoria_renda_id
    )
    assert renda_em_uso["quantidade_despesas"] == 1
    assert client.put(
        f"/api/categorias/{categoria_renda_id}",
        json={"nome": "Renda mensal", "tipo": "pessoal", "icone": "💰"},
        headers=owner_headers,
    ).status_code == 200
    assert client.get(
        f"/api/despesas-pessoais/{receita_id}", headers=owner_headers
    ).get_json()["data"]["categoria"] == "Renda mensal"
    assert client.delete(
        f"/api/categorias/{categoria_renda_id}", headers=owner_headers
    ).status_code == 409
    despesa_outro = client.post(
        "/api/despesas-pessoais",
        json={
            "descricao": "Despesa alheia",
            "valor": 100,
            "data_despesa": hoje,
        },
        headers=other_headers,
    ).get_json()["data"]["id"]

    detalhes = client.get(
        f"/api/despesas-pessoais/{despesa_id}", headers=owner_headers
    )
    assert detalhes.status_code == 200
    assert detalhes.get_json()["data"]["categoria"] == "Alimentação"
    assert client.get(
        f"/api/despesas-pessoais/{despesa_id}", headers=other_headers
    ).status_code == 403
    assert client.get(
        "/api/despesas-pessoais/999999", headers=owner_headers
    ).status_code == 404

    filtros = client.get(
        "/api/despesas-pessoais?categoria=Alimenta%C3%A7%C3%A3o&tipo=despesa"
        f"&data_inicio={hoje}&data_fim={hoje}&limit=1&offset=0",
        headers=owner_headers,
    )
    assert filtros.status_code == 200
    assert filtros.get_json()["paginacao"]["total"] == 1
    assert len(filtros.get_json()["data"]) == 1
    assert client.get(
        "/api/despesas-pessoais?tipo=invalido", headers=owner_headers
    ).status_code == 400
    for query in (
        "?data_inicio=01/01/2026",
        "?limit=0",
        "?limit=101",
        "?offset=-1",
    ):
        assert client.get(
            f"/api/despesas-pessoais{query}", headers=owner_headers
        ).status_code == 400

    for payload in ([], {"descricao": "Atualizada"}, {"descricao": "", "valor": 4}):
        assert client.put(
            f"/api/despesas-pessoais/{despesa_id}",
            json=payload,
            headers=owner_headers,
        ).status_code == 400
    assert client.put(
        f"/api/despesas-pessoais/{despesa_id}",
        json={"descricao": "Mercado atualizado", "valor": 25},
        headers=other_headers,
    ).status_code == 403
    assert client.put(
        "/api/despesas-pessoais/999999",
        json={"descricao": "Inexistente", "valor": 1},
        headers=owner_headers,
    ).status_code == 404
    atualizada = client.put(
        f"/api/despesas-pessoais/{despesa_id}",
        json={"descricao": "Mercado atualizado", "valor": 25},
        headers=owner_headers,
    )
    assert atualizada.status_code == 200
    detalhe_atualizado = client.get(
        f"/api/despesas-pessoais/{despesa_id}", headers=owner_headers
    ).get_json()["data"]
    assert detalhe_atualizado["categoria"] == "Alimentação"
    assert detalhe_atualizado["tipo"] == "despesa"
    assert detalhe_atualizado["valor"] == 25

    categoria_alimentacao = next(
        item
        for item in client.get(
            "/api/categorias?tipo=pessoal", headers=owner_headers
        ).get_json()["data"]
        if item["nome"] == "Alimentação"
    )
    renomeada = client.put(
        f"/api/categorias/{categoria_alimentacao['id']}",
        json={
            "nome": "Alimentação da casa",
            "tipo": "pessoal",
            "icone": "🍽️",
        },
        headers=owner_headers,
    )
    assert renomeada.status_code == 200
    detalhe_renomeado = client.get(
        f"/api/despesas-pessoais/{despesa_id}", headers=owner_headers
    ).get_json()["data"]
    assert detalhe_renomeado["categoria"] == "Alimentação da casa"
    assert client.delete(
        f"/api/categorias/{categoria_alimentacao['id']}",
        headers=owner_headers,
    ).status_code == 409

    total_mes = client.get(
        f"/api/despesas-pessoais/total-mes?ano={date.today().year}"
        f"&mes={date.today().month}",
        headers=owner_headers,
    )
    assert total_mes.status_code == 200
    resumo = total_mes.get_json()["data"]
    assert resumo["total_despesas"] == resumo["despesas"] == 25
    assert resumo["total_receitas"] == resumo["receitas"] == 35
    assert resumo["saldo"] == 10
    for query in (
        "?mes=0",
        "?mes=13",
        "?mes=invalid",
        "?ano=invalid",
        "?ano=0",
        "?ano=10000",
    ):
        assert client.get(
            f"/api/despesas-pessoais/total-mes{query}",
            headers=owner_headers,
        ).status_code == 400

    assert client.delete(
        f"/api/despesas-pessoais/{despesa_id}", headers=other_headers
    ).status_code == 403
    assert client.delete(
        f"/api/despesas-pessoais/{despesa_id}", headers=owner_headers
    ).status_code == 200
    assert client.delete(
        f"/api/categorias/{categoria_alimentacao['id']}",
        headers=owner_headers,
    ).status_code == 200
    assert client.delete(
        f"/api/despesas-pessoais/{despesa_id}", headers=owner_headers
    ).status_code == 404
    assert client.get(
        f"/api/despesas-pessoais/{receita_id}", headers=owner_headers
    ).status_code == 200
    assert client.get(
        f"/api/despesas-pessoais/{despesa_outro}", headers=owner_headers
    ).status_code == 403


def test_group_cover_icon_preferences_are_user_scoped_and_validated(client):
    emails = ("cover-icons-owner@example.com", "cover-icons-other@example.com")
    tokens = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Cover Icon User {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    other_headers = {"Authorization": f"Bearer {tokens[1]}"}
    endpoint = "/api/grupos/icones-capa"

    assert client.get(endpoint).status_code == 401
    initial_data = client.get(endpoint, headers=owner_headers).get_json()["data"]
    icones_padrao = {icone for icone, _nome in DEFAULT_GROUP_COVER_ICONS}
    ocultos_padrao = {
        icone
        for icone, _nome in AVAILABLE_GROUP_COVER_ICONS
        if icone not in icones_padrao
    }
    assert set(initial_data["ocultos"]) == ocultos_padrao
    assert {
        opcao["icone"]
        for opcao in initial_data["icones"]
        if opcao["origem"] == "padrao"
    } == icones_padrao

    atualizada = client.put(
        endpoint,
        json={"ocultos": ["✈️", "🏠"]},
        headers=owner_headers,
    )
    assert atualizada.status_code == 200
    atualizada_data = client.get(endpoint, headers=owner_headers).get_json()["data"]
    assert set(atualizada_data["ocultos"]) == {"🏠", "✈️"}
    assert "🏖️" in {
        opcao["icone"]
        for opcao in atualizada_data["icones"]
        if opcao["origem"] == "padrao"
    }
    other_data = client.get(endpoint, headers=other_headers).get_json()["data"]
    assert set(other_data["ocultos"]) == ocultos_padrao
    assert len(other_data["icones"]) == len(initial_data["icones"])

    criada = client.post(
        endpoint,
        json={"nome": "Grupo personalizado", "icone": "🏖️"},
        headers=owner_headers,
    )
    assert criada.status_code == 201
    opcao_id = criada.get_json()["data"]["id"]
    assert any(
        opcao["id"] == opcao_id and opcao["nome"] == "Grupo personalizado"
        for opcao in client.get(endpoint, headers=owner_headers).get_json()["data"]["icones"]
    )
    assert client.put(
        f"{endpoint}/{opcao_id}",
        json={"nome": "Férias", "icone": "✈️"},
        headers=other_headers,
    ).status_code == 404
    assert client.delete(
        f"{endpoint}/{opcao_id}", headers=other_headers
    ).status_code == 404
    assert client.post(
        endpoint,
        json={"nome": "Ícone inválido", "icone": "🔮"},
        headers=owner_headers,
    ).status_code == 400

    editada = client.put(
        f"{endpoint}/{opcao_id}",
        json={"nome": "Férias", "icone": "✈️"},
        headers=owner_headers,
    )
    assert editada.status_code == 200
    assert any(
        opcao["id"] == opcao_id
        and opcao["nome"] == "Férias"
        and opcao["icone"] == "✈️"
        for opcao in client.get(endpoint, headers=owner_headers).get_json()["data"]["icones"]
    )
    assert client.delete(
        f"{endpoint}/{opcao_id}", headers=owner_headers
    ).status_code == 200
    assert all(
        opcao["id"] != opcao_id
        for opcao in client.get(endpoint, headers=owner_headers).get_json()["data"]["icones"]
    )
    assert client.put(
        f"{endpoint}/personalizado:missing",
        json={"nome": "Inválido", "icone": "✈️"},
        headers=other_headers,
    ).status_code == 404

    personalizada_restaurada = client.post(
        endpoint,
        json={"nome": "Minha capa", "icone": "🏖️"},
        headers=owner_headers,
    )
    personalizada_id = personalizada_restaurada.get_json()["data"]["id"]
    assert client.post(
        f"{endpoint}/restaurar", headers=owner_headers
    ).status_code == 200
    restored = client.get(endpoint, headers=owner_headers).get_json()["data"]
    assert set(restored["ocultos"]) == ocultos_padrao
    assert len(restored["icones"]) == len(initial_data["icones"]) + 1
    assert any(opcao["id"] == personalizada_id for opcao in restored["icones"])

    for ocultos in ("✈️", ["invalido"], ["🏠", "🏠"]):
        assert client.put(
            endpoint,
            json={"ocultos": ocultos},
            headers=owner_headers,
        ).status_code == 400

    assert client.delete(endpoint, headers=owner_headers).status_code == 200
    assert set(
        client.get(endpoint, headers=owner_headers).get_json()["data"]["ocultos"]
    ) == ocultos_padrao


def test_group_api_covers_membership_and_admin_crud(client):
    emails = (
        "group-crud-owner@example.com",
        "group-crud-member@example.com",
        "group-crud-outsider@example.com",
    )
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Group CRUD {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    member_headers = {"Authorization": f"Bearer {tokens[1]}"}
    outsider_headers = {"Authorization": f"Bearer {tokens[2]}"}
    invalid_payloads = [
        [],
        {"nome": 1},
        {"nome": ""},
        {"nome": "A"},
        {"nome": "G" * 121},
        {"nome": "Grupo", "descricao": []},
        {"nome": "Grupo", "descricao": "D" * 501},
        {"nome": "Grupo", "participantes": "invalid"},
        {"nome": "Grupo", "participantes": [user_ids[2], "invalid"]},
        {"nome": "Grupo", "participantes": [999999]},
        {"nome": "Grupo", "participantes": list(range(1000, 1100))},
    ]
    for payload in invalid_payloads:
        assert client.post(
            "/api/grupos", json=payload, headers=owner_headers
        ).status_code == 400

    criado = client.post(
        "/api/grupos",
        json={
            "nome": "Grupo CRUD",
            "descricao": "Descrição inicial",
            "participantes": [user_ids[1]],
        },
        headers=owner_headers,
    )
    assert criado.status_code == 201
    grupo_id = criado.get_json()["data"]["id"]
    grupo_listado = client.get("/api/grupos", headers=owner_headers).get_json()["data"]
    assert len(grupo_listado) == 1
    assert grupo_listado[0]["icone"] is None
    detalhes_iniciais = client.get(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).get_json()["data"]
    assert detalhes_iniciais["pode_editar"] is True
    assert detalhes_iniciais["icone"] is None
    assert client.get(
        f"/api/grupos/{grupo_id}", headers=member_headers
    ).get_json()["data"]["pode_editar"] is False
    assert client.get(
        f"/api/grupos/{grupo_id}", headers=outsider_headers
    ).status_code == 403
    assert client.get(
        "/api/grupos/999999", headers=owner_headers
    ).status_code == 404

    assert client.put(
        f"/api/grupos/{grupo_id}",
        json={"nome": "Nome alterado"},
        headers=member_headers,
    ).status_code == 403
    for icone_invalido in ("📱", [], 1):
        assert client.put(
            f"/api/grupos/{grupo_id}",
            json={"nome": "Nome válido", "descricao": "", "icone": icone_invalido},
            headers=owner_headers,
        ).status_code == 400
    for payload in (
        [],
        {"nome": 2},
        {"nome": ""},
        {"nome": "A"},
        {"nome": "N" * 121},
        {"nome": "Ok", "descricao": []},
        {"nome": "Ok", "descricao": "D" * 501},
    ):
        assert client.put(
            f"/api/grupos/{grupo_id}", json=payload, headers=owner_headers
        ).status_code == 400
    atualizado = client.put(
        f"/api/grupos/{grupo_id}",
        json={"nome": "Grupo atualizado", "descricao": "", "icone": "✈️"},
        headers=owner_headers,
    )
    assert atualizado.status_code == 200
    detalhes = client.get(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).get_json()["data"]
    assert detalhes["nome"] == "Grupo atualizado"
    assert detalhes["descricao"] is None
    assert detalhes["icone"] == "✈️"
    assert detalhes["pode_editar"] is True
    grupo_listado = client.get("/api/grupos", headers=owner_headers).get_json()["data"]
    assert grupo_listado[0]["icone"] == "✈️"

    preservado = client.put(
        f"/api/grupos/{grupo_id}",
        json={"nome": "Grupo atualizado novamente", "descricao": "Mantido"},
        headers=owner_headers,
    )
    assert preservado.status_code == 200
    assert client.get(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).get_json()["data"]["icone"] == "✈️"

    removido_icone = client.put(
        f"/api/grupos/{grupo_id}",
        json={"nome": "Grupo sem ícone", "descricao": "", "icone": None},
        headers=owner_headers,
    )
    assert removido_icone.status_code == 200
    assert client.get(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).get_json()["data"]["icone"] is None

    assert client.delete(
        f"/api/grupos/{grupo_id}", headers=member_headers
    ).status_code == 403
    assert client.delete(
        "/api/grupos/999999", headers=owner_headers
    ).status_code == 404

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE participantes SET papel = 'participante' "
                "WHERE grupo_id = ? AND usuario_id = ?",
                (grupo_id, user_ids[0]),
            )
            cursor.execute(
                "UPDATE participantes SET papel = 'admin' "
                "WHERE grupo_id = ? AND usuario_id = ?",
                (grupo_id, user_ids[1]),
            )
            connection.commit()
        finally:
            cursor.close()

    assert client.get(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).get_json()["data"]["pode_editar"] is False
    assert client.delete(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).status_code == 403
    assert client.get(
        f"/api/grupos/{grupo_id}", headers=member_headers
    ).get_json()["data"]["pode_editar"] is True
    assert client.delete(
        f"/api/grupos/{grupo_id}", headers=member_headers
    ).status_code == 200
    assert client.get(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).status_code == 404


def test_group_expense_api_validates_crud_and_access(client):
    emails = (
        "group-expense-owner@example.com",
        "group-expense-member@example.com",
        "group-expense-outsider@example.com",
    )
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Group Expense {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
    member_headers = {"Authorization": f"Bearer {tokens[1]}"}
    outsider_headers = {"Authorization": f"Bearer {tokens[2]}"}
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo despesas", "participantes": [user_ids[1]]},
        headers=owner_headers,
    ).get_json()["data"]["id"]
    hoje = date.today().isoformat()
    invalid_payloads = [
        [],
        {"grupo_id": grupo, "descricao": 1, "valor": 5},
        {"grupo_id": grupo, "descricao": " ", "valor": 5},
        {"grupo_id": grupo, "descricao": "Teste", "categoria": []},
        {"grupo_id": grupo, "descricao": "Teste", "categoria": "x" * 101},
        {"grupo_id": grupo, "descricao": "Teste", "observacao": 1},
        {"grupo_id": grupo, "descricao": "Teste", "observacao": "x" * 501},
        {"grupo_id": "invalido", "descricao": "Teste"},
        {"grupo_id": grupo, "pagador_id": "invalido", "descricao": "Teste"},
        {"grupo_id": grupo, "descricao": "Teste", "valor": 0},
        {"grupo_id": grupo, "descricao": "Teste", "valor": 5, "data": "07/11/2026"},
        {
            "grupo_id": grupo,
            "descricao": "Teste",
            "valor": 5,
            "data": (date.today() + timedelta(days=1)).isoformat(),
        },
        {"grupo_id": grupo, "descricao": "Teste", "valor": 5, "vencimento": "inv"},
        {"grupo_id": grupo, "descricao": "Teste", "valor": 5, "divisao_tipo": "inv"},
        {"grupo_id": grupo, "descricao": "Teste", "valor": 5, "participantes": "inv"},
        {
            "grupo_id": grupo,
            "descricao": "Teste",
            "valor": 5,
            "participantes": [True],
        },
        {
            "grupo_id": grupo,
            "descricao": "Teste",
            "valor": 5,
            "divisao_tipo": "porcentagem",
            "percentuais": [],
        },
        {
            "grupo_id": grupo,
            "descricao": "Teste",
            "valor": 5,
            "divisao_tipo": "valores",
            "valores": [],
        },
    ]
    for payload in invalid_payloads:
        assert client.post(
            "/api/despesas", json=payload, headers=owner_headers
        ).status_code == 400
    assert client.post(
        "/api/despesas",
        json={"grupo_id": 999999, "descricao": "Teste", "valor": 5},
        headers=owner_headers,
    ).status_code == 404
    assert client.post(
        "/api/despesas",
        json={"grupo_id": grupo, "descricao": "Teste", "valor": 5},
        headers=outsider_headers,
    ).status_code == 403
    assert client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo,
            "pagador_id": user_ids[2],
            "descricao": "Teste",
            "valor": 5,
        },
        headers=owner_headers,
    ).status_code == 400

    criada = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo,
            "pagador_id": user_ids[0],
            "descricao": "Conta de grupo",
            "categoria": "Casa",
            "valor": 60,
            "data_despesa": hoje,
            "participantes": user_ids[:2],
        },
        headers=owner_headers,
    )
    assert criada.status_code == 201
    despesa_id = criada.get_json()["data"]["id"]
    assert client.get(
        f"/api/despesas/{despesa_id}", headers=owner_headers
    ).status_code == 200
    assert client.get(
        f"/api/despesas/{despesa_id}", headers=outsider_headers
    ).status_code == 403
    assert client.get(
        "/api/despesas/999999", headers=owner_headers
    ).status_code == 404
    assert client.get(
        f"/api/despesas/grupo/{grupo}", headers=member_headers
    ).status_code == 200
    assert client.get(
        "/api/despesas/grupo/999999", headers=owner_headers
    ).status_code == 404
    assert client.get(
        f"/api/despesas/grupo/{grupo}", headers=outsider_headers
    ).status_code == 403
    for query in ("?limit=0", "?limit=101", "?offset=-1"):
        assert client.get(
            f"/api/despesas/grupo/{grupo}{query}", headers=owner_headers
        ).status_code == 400

    payload_valido = {"descricao": "Conta atualizada", "valor": 80}
    for payload in (
        [],
        {"descricao": 1, "valor": 80},
        {"descricao": "", "valor": 80},
        {"descricao": "Teste", "categoria": []},
        {"descricao": "Teste", "categoria": "x" * 101},
        {"descricao": "Teste", "observacao": 1},
        {"descricao": "Teste", "observacao": "x" * 501},
        {"descricao": "Teste", "valor": 0},
        {"descricao": "Teste", "valor": 5, "pagador_id": "inv"},
        {"descricao": "Teste", "valor": 5, "data": "07/11/2026"},
        {"descricao": "Teste", "valor": 5, "data": (date.today() + timedelta(days=1)).isoformat()},
        {"descricao": "Teste", "valor": 5, "divisao_tipo": "inv"},
        {"descricao": "Teste", "valor": 5, "participantes": "inv"},
        {"descricao": "Teste", "valor": 5, "percentuais": []},
        {"descricao": "Teste", "valor": 5, "valores": []},
    ):
        assert client.put(
            f"/api/despesas/{despesa_id}",
            json=payload,
            headers=owner_headers,
        ).status_code == 400
    assert client.put(
        f"/api/despesas/{despesa_id}",
        json=payload_valido,
        headers=outsider_headers,
    ).status_code == 403
    assert client.put(
        "/api/despesas/999999",
        json=payload_valido,
        headers=owner_headers,
    ).status_code == 404
    assert client.put(
        f"/api/despesas/{despesa_id}",
        json={**payload_valido, "pagador_id": user_ids[2]},
        headers=owner_headers,
    ).status_code == 400
    atualizada = client.put(
        f"/api/despesas/{despesa_id}",
        json=payload_valido,
        headers=owner_headers,
    )
    assert atualizada.status_code == 200
    detalhes = client.get(
        f"/api/despesas/{despesa_id}", headers=owner_headers
    ).get_json()["data"]
    assert detalhes["descricao"] == "Conta atualizada"
    assert detalhes["valor"] == 80

    assert client.delete(
        f"/api/despesas/{despesa_id}", headers=outsider_headers
    ).status_code == 403
    assert client.delete(
        "/api/despesas/999999", headers=owner_headers
    ).status_code == 404
    assert client.delete(
        f"/api/despesas/{despesa_id}", headers=member_headers
    ).status_code == 403
    assert client.delete(
        f"/api/despesas/{despesa_id}", headers=owner_headers
    ).status_code == 200
    assert client.delete(
        f"/api/despesas/{despesa_id}", headers=owner_headers
    ).status_code == 404


def test_expense_lists_support_bounded_pagination(client):
    email = "expense-pagination@example.com"
    cadastrar_usuario(client, "Pagination", email)
    login = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "SenhaSegura123!"},
    )
    headers = {
        "Authorization": f"Bearer {login.get_json()['data']['token']}"
    }
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo paginado"},
        headers=headers,
    )
    assert grupo.status_code == 201
    grupo_id = grupo.get_json()["data"]["id"]
    usuario_id = login.get_json()["data"]["user"]["id"]

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            for index in range(3):
                cursor.execute(
                    "INSERT INTO despesas_pessoais "
                    "(usuario_id, descricao, valor, categoria, tipo, data_despesa) "
                    "VALUES (?, ?, ?, ?, 'despesa', ?)",
                    (
                        usuario_id,
                        f"Pessoal {index}",
                        index + 1,
                        "Alimentação",
                        "2026-11-07",
                    ),
                )
                cursor.execute(
                    "INSERT INTO despesas "
                    "(grupo_id, pagador_id, descricao, valor, categoria, data_despesa) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        grupo_id,
                        usuario_id,
                        f"Grupo {index}",
                        index + 1,
                        "Mercado",
                        "2026-11-07",
                    ),
                )
            connection.commit()
        finally:
            cursor.close()

    primeira_pessoal = client.get(
        "/api/despesas-pessoais?limit=2&offset=0", headers=headers
    ).get_json()
    segunda_pessoal = client.get(
        "/api/despesas-pessoais?limit=2&offset=2", headers=headers
    ).get_json()
    primeira_grupo = client.get(
        f"/api/despesas/grupo/{grupo_id}?limit=2&offset=0",
        headers=headers,
    ).get_json()

    assert len(primeira_pessoal["data"]) == 2
    assert primeira_pessoal["paginacao"]["total"] == 3
    assert primeira_pessoal["paginacao"]["has_more"] is True
    assert segunda_pessoal["paginacao"]["has_more"] is False
    assert len(primeira_grupo["data"]) == 2
    assert primeira_grupo["paginacao"]["total"] == 3
    assert primeira_grupo["paginacao"]["categorias"] == [
        {"categoria": "Mercado", "valor": 6.0}
    ]


def test_group_and_participant_lists_support_bounded_pagination(client):
    emails = [
        "group-page-owner@example.com",
        "group-page-member-one@example.com",
        "group-page-member-two@example.com",
    ]
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Pagination User {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        user_ids.append(login["user"]["id"])
        if index == 0:
            owner_headers = {
                "Authorization": "Bearer " + login["token"]
            }

    for index in range(3):
        response = client.post(
            "/api/grupos",
            json={
                "nome": f"Grupo paginação {index}",
                "participantes": user_ids[1:] if index == 0 else [],
            },
            headers=owner_headers,
        )
        assert response.status_code == 201
        if index == 0:
            grupo_id = response.get_json()["data"]["id"]

    grupos = client.get(
        "/api/grupos?limit=2&offset=1", headers=owner_headers
    ).get_json()
    assert len(grupos["data"]) == 2
    assert grupos["paginacao"] == {
        "limit": 2,
        "offset": 1,
        "total": 3,
        "has_more": False,
    }

    participantes = client.get(
        f"/api/participantes/grupo/{grupo_id}?limit=2&offset=1",
        headers=owner_headers,
    ).get_json()
    assert len(participantes["data"]) == 2
    assert participantes["paginacao"] == {
        "limit": 2,
        "offset": 1,
        "total": 3,
        "has_more": False,
    }
    assert client.get(
        "/api/grupos?limit=101", headers=owner_headers
    ).status_code == 400
    assert client.get(
        f"/api/participantes/grupo/{grupo_id}?offset=-1",
        headers=owner_headers,
    ).status_code == 400


def test_group_expense_observation_is_saved_and_returned_in_details(client):
    email = "expense-observation@example.com"
    cadastrar_usuario(client, "Observation", email)
    login = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    headers = {"Authorization": f"Bearer {login['token']}"}
    usuario_id = login["user"]["id"]
    grupo = client.post(
        "/api/grupos", json={"nome": "Grupo observação"}, headers=headers
    ).get_json()["data"]

    criada = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo["id"],
            "descricao": "Despesa com observação",
            "valor": 25,
            "pagador_id": usuario_id,
            "participantes": [usuario_id],
            "observacao": "Cobrar recibo até sexta.",
        },
        headers=headers,
    )

    assert criada.status_code == 201
    detalhes = client.get(
        f"/api/despesas/{criada.get_json()['data']['id']}", headers=headers
    )
    assert detalhes.status_code == 200
    assert detalhes.get_json()["data"]["observacao"] == "Cobrar recibo até sexta."

    despesa_id = criada.get_json()["data"]["id"]
    atualizada = client.put(
        f"/api/despesas/{despesa_id}",
        json={
            "descricao": "Despesa com observação",
            "valor": 25,
            "observacao": "Recibo anexado.",
        },
        headers=headers,
    )
    assert atualizada.status_code == 200
    detalhes = client.get(f"/api/despesas/{despesa_id}", headers=headers)
    assert detalhes.get_json()["data"]["observacao"] == "Recibo anexado."

    limpa = client.put(
        f"/api/despesas/{despesa_id}",
        json={
            "descricao": "Despesa com observação",
            "valor": 25,
            "observacao": "",
        },
        headers=headers,
    )
    assert limpa.status_code == 200
    detalhes = client.get(f"/api/despesas/{despesa_id}", headers=headers)
    assert detalhes.get_json()["data"]["observacao"] is None


def test_group_expense_changes_require_creator_or_active_admin(client):
    emails = (
        "expense-auth-admin@example.com",
        "expense-auth-creator@example.com",
        "expense-auth-member@example.com",
    )
    headers_by_user = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Expense Auth {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        headers_by_user.append(
            {"Authorization": f"Bearer {login['token']}"}
        )
        user_ids.append(login["user"]["id"])

    admin_headers, creator_headers, member_headers = headers_by_user
    resposta_grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo autorização", "participantes": user_ids[1:]},
        headers=admin_headers,
    )
    assert resposta_grupo.status_code == 201, resposta_grupo.get_json()
    grupo = resposta_grupo.get_json()["data"]["id"]
    criada = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo,
            "pagador_id": user_ids[1],
            "descricao": "Despesa original",
            "valor": 30,
            "participantes": user_ids[1:],
        },
        headers=creator_headers,
    )
    assert criada.status_code == 201
    despesa_id = criada.get_json()["data"]["id"]
    detalhes = client.get(
        f"/api/despesas/{despesa_id}", headers=admin_headers
    ).get_json()["data"]
    assert detalhes["criado_por"] == user_ids[1]

    update_payload = {"descricao": "Despesa alterada", "valor": 40}
    assert client.put(
        f"/api/despesas/{despesa_id}",
        json=update_payload,
        headers=member_headers,
    ).status_code == 403
    assert client.delete(
        f"/api/despesas/{despesa_id}", headers=member_headers
    ).status_code == 403
    assert client.get(
        f"/api/despesas/{despesa_id}", headers=admin_headers
    ).get_json()["data"]["descricao"] == "Despesa original"
    assert client.put(
        f"/api/despesas/{despesa_id}",
        json=update_payload,
        headers=creator_headers,
    ).status_code == 200

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE despesas SET criado_por = NULL WHERE id = ?",
                (despesa_id,),
            )
            connection.commit()
        finally:
            cursor.close()

    assert client.put(
        f"/api/despesas/{despesa_id}",
        json={"descricao": "Alteração não autorizada", "valor": 50},
        headers=creator_headers,
    ).status_code == 403
    assert client.put(
        f"/api/despesas/{despesa_id}",
        json={"descricao": "Despesa legada editada", "valor": 50},
        headers=admin_headers,
    ).status_code == 200
    assert client.delete(
        f"/api/despesas/{despesa_id}", headers=member_headers
    ).status_code == 403
    assert client.delete(
        f"/api/despesas/{despesa_id}", headers=admin_headers
    ).status_code == 200


def test_global_user_directory_is_not_exposed(client):
    response = client.get("/api/usuarios")
    assert response.status_code == 404


def test_signup_and_login(client):
    email = "api-test@example.com"
    response = cadastrar_usuario(client, "API Test", email)
    assert "Cadastro solicitado" in response.get_json()["message"]
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT email_verificado FROM usuarios WHERE email = ?",
                (email,),
            )
            assert cursor.fetchone()["email_verificado"] == 1
        finally:
            cursor.close()

    response = client.post("/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"})
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["token"]
    assert data["refresh_token"]


def test_authenticated_request_after_login(client):
    email = "protected-route@example.com"
    cadastrar_usuario(client, "Protected Route", email)
    login = client.post(
        "/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"}
    )
    token = login.get_json()["data"]["token"]

    response = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["email"] == email
    assert response.get_json()["data"]["saldo_total"] == 0


def test_duplicate_signup_has_same_response_as_new_signup(client):
    payload = {"nome": "Dup", "email": "dup@example.com", "senha": "SenhaSegura123!"}
    first_response = client.post("/api/auth/cadastro", json=payload)
    duplicate_response = client.post("/api/auth/cadastro", json=payload)

    assert first_response.status_code == duplicate_response.status_code == 201
    assert first_response.get_json() == duplicate_response.get_json()
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM usuarios WHERE email = ?",
                (payload["email"],),
            )
            assert cursor.fetchone()["total"] == 1
        finally:
            cursor.close()


def test_signup_rejects_password_below_the_minimum_length(client):
    resposta = client.post(
        "/api/auth/cadastro",
        json={
            "nome": "Senha Curta",
            "email": "senha-curta@example.com",
            "senha": "Ab1!cdefghi",
        },
    )

    assert resposta.status_code == 400
    assert "12 caracteres" in resposta.get_json()["message"]


@pytest.mark.parametrize(
    ("senha", "mensagem"),
    [
        ("abcdefghijk!", "letra maiuscula"),
        ("Abcdefgh!jkl", "pelo menos um numero"),
        ("Abcdef123456", "caractere especial"),
        ("Ab1 cdefghij", "caractere especial"),
    ],
)
def test_signup_rejects_password_missing_a_required_character_type(
    client, senha, mensagem
):
    resposta = client.post(
        "/api/auth/cadastro",
        json={
            "nome": "Senha Invalida",
            "email": "senha-invalida@example.com",
            "senha": senha,
        },
    )
    assert resposta.status_code == 400
    assert mensagem in resposta.get_json()["message"]


def test_signup_accepts_password_at_minimum_length(client):
    senha = "Ab1!cdefghij"
    resposta = client.post(
        "/api/auth/cadastro",
        json={
            "nome": "Senha Minima",
            "email": "senha-minima@example.com",
            "senha": senha,
        },
    )

    assert resposta.status_code == 201
    assert client.post(
        "/api/auth/login",
        json={"email": "senha-minima@example.com", "senha": senha},
    ).status_code == 200





def test_update_profile_and_password(client):
    email = "profile-test@example.com"
    cadastrar_usuario(client, "Profile Test", email)
    login = client.post("/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"})
    token = login.get_json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.put(
        "/api/auth/atualizar",
        json={
            "nome": "Nome Atualizado",
            "email": email,
            "telefone": "11999999999",
            "pix_chave": "profile-pix@example.com",
        },
        headers=headers,
    ).status_code == 200
    perfil = client.get("/api/auth/me", headers=headers)
    assert perfil.status_code == 200
    assert perfil.get_json()["data"]["pix_chave"] == "profile-pix@example.com"
    login_com_pix = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "SenhaSegura123!"},
    )
    assert (
        login_com_pix.get_json()["data"]["user"]["pix_chave"]
        == "profile-pix@example.com"
    )
    assert client.put(
        "/api/auth/atualizar",
        json={
            "nome": "Nome Atualizado",
            "email": email,
            "telefone": "11999999999",
        },
        headers=headers,
    ).status_code == 200
    assert client.get(
        "/api/auth/me", headers=headers
    ).get_json()["data"]["pix_chave"] == "profile-pix@example.com"
    chave_longa = client.put(
        "/api/auth/atualizar",
        json={
            "nome": "Nome Atualizado",
            "email": email,
            "telefone": "11999999999",
            "pix_chave": "x" * 78,
        },
        headers=headers,
    )
    assert chave_longa.status_code == 400
    assert client.get(
        "/api/auth/me", headers=headers
    ).get_json()["data"]["pix_chave"] == "profile-pix@example.com"
    assert client.put(
        "/api/auth/atualizar",
        json={
            "nome": "Nome Atualizado",
            "email": email,
            "telefone": "11999999999",
            "pix_chave": "",
        },
        headers=headers,
    ).status_code == 200
    assert client.get(
        "/api/auth/me", headers=headers
    ).get_json()["data"]["pix_chave"] is None
    assert client.put(
        "/api/auth/alterar-senha",
        json={"senha_atual": "SenhaSegura123!", "nova_senha": "NovaSenha456!"},
        headers=headers,
    ).status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "senha": "NovaSenha456!"}).status_code == 200


def test_pix_key_is_returned_only_to_group_debtor(client):
    emails = ("pix-owner@example.com", "pix-debtor@example.com")
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Pix User {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    credor_headers = {"Authorization": f"Bearer {tokens[0]}"}
    devedor_headers = {"Authorization": f"Bearer {tokens[1]}"}
    chave_pix = "pix-receber@example.com"
    assert client.put(
        "/api/auth/atualizar",
        json={
            "nome": "Pix User 0",
            "email": emails[0],
            "pix_chave": chave_pix,
        },
        headers=credor_headers,
    ).status_code == 200
    grupo_id = client.post(
        "/api/grupos",
        json={"nome": "Grupo Pix", "participantes": [user_ids[1]]},
        headers=credor_headers,
    ).get_json()["data"]["id"]
    despesa = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo_id,
            "pagador_id": user_ids[0],
            "descricao": "Despesa Pix",
            "valor": 60,
            "data_despesa": date.today().isoformat(),
            "participantes": user_ids,
        },
        headers=credor_headers,
    )
    assert despesa.status_code == 201

    saldos_devedor = client.get(
        f"/api/saldos/grupo/{grupo_id}", headers=devedor_headers
    ).get_json()["data"]["dividas_simplificadas"]
    assert saldos_devedor[0]["chave_pix"] == chave_pix

    saldos_credor = client.get(
        f"/api/saldos/grupo/{grupo_id}", headers=credor_headers
    ).get_json()["data"]["dividas_simplificadas"]
    assert "chave_pix" not in saldos_credor[0]


def test_account_deletion_requires_the_current_password(client):
    email = "account-delete-password@example.com"
    cadastrar_usuario(client, "Delete Password", email)
    login = client.post(
        "/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"}
    )
    token = login.get_json()["data"]["token"]

    resposta = client.delete(
        "/api/auth/delete",
        json={"senha_atual": "senha-incorreta"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resposta.status_code == 401
    assert client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
    ).status_code == 200


def test_account_deletion_is_blocked_when_user_owes_a_balance(client):
    email = "account-delete-debtor@example.com"
    cadastrar_usuario(client, "Delete Debtor", email)
    login = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    headers = {"Authorization": f"Bearer {login['token']}"}
    usuario_id = login["user"]["id"]

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "INSERT INTO grupos (nome, descricao, criado_por) "
                "VALUES (?, NULL, ?)",
                ("Grupo com dívida", usuario_id),
            )
            grupo_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO participantes "
                "(grupo_id, usuario_id, papel, ativo) "
                "VALUES (?, ?, 'participante', 1)",
                (grupo_id, usuario_id),
            )
            cursor.execute(
                "INSERT INTO saldos (grupo_id, usuario_id, saldo) "
                "VALUES (?, ?, ?)",
                (grupo_id, usuario_id, -25),
            )
            connection.commit()
        finally:
            cursor.close()

    resposta = client.delete(
        "/api/auth/delete",
        json={"senha_atual": "SenhaSegura123!"},
        headers=headers,
    )

    assert resposta.status_code == 409
    assert "saldo em dívida" in resposta.get_json()["mensagem"]
    assert client.get("/api/auth/me", headers=headers).status_code == 200


def test_account_deletion_anonymizes_and_preserves_shared_history(client):
    owner_email = "account-delete-owner@example.com"
    guest_email = "account-delete-guest@example.com"
    cadastrar_usuario(client, "Owner To Delete", owner_email)
    cadastrar_usuario(client, "Active Group Member", guest_email)

    owner_login = client.post(
        "/api/auth/login", json={"email": owner_email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]
    guest_login = client.post(
        "/api/auth/login", json={"email": guest_email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]
    owner_id = owner_login["user"]["id"]
    guest_id = guest_login["user"]["id"]
    owner_headers = {"Authorization": f"Bearer {owner_login['token']}"}
    guest_headers = {"Authorization": f"Bearer {guest_login['token']}"}
    assert client.put(
        "/api/auth/atualizar",
        json={
            "nome": "Owner To Delete",
            "email": owner_email,
            "pix_chave": "pix-owner-to-delete@example.com",
        },
        headers=owner_headers,
    ).status_code == 200

    grupo = client.post(
        "/api/grupos",
        json={"nome": "Histórico compartilhado", "participantes": [guest_id]},
        headers=owner_headers,
    )
    assert grupo.status_code == 201
    grupo_id = grupo.get_json()["data"]["id"]
    grupo_solo = client.post(
        "/api/grupos",
        json={"nome": "Grupo pessoal"},
        headers=owner_headers,
    )
    assert grupo_solo.status_code == 201
    grupo_solo_id = grupo_solo.get_json()["data"]["id"]

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "INSERT INTO despesas "
                "(grupo_id, pagador_id, descricao, valor, data_despesa) "
                "VALUES (?, ?, ?, ?, ?)",
                (grupo_id, owner_id, "Despesa compartilhada", 20, "2026-11-07"),
            )
            despesa_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO despesa_divisoes "
                "(despesa_id, usuario_id, tipo, percentual, valor) "
                "VALUES (?, ?, 'igual', 50, 10), (?, ?, 'igual', 50, 10)",
                (despesa_id, owner_id, despesa_id, guest_id),
            )
            cursor.execute(
                "INSERT INTO despesas_pessoais "
                "(usuario_id, descricao, valor, tipo, data_despesa) "
                "VALUES (?, ?, ?, 'despesa', ?)",
                (owner_id, "Despesa pessoal", 5, "2026-11-07"),
            )
            cursor.execute(
                "INSERT INTO despesas "
                "(grupo_id, pagador_id, descricao, valor, data_despesa) "
                "VALUES (?, ?, ?, ?, ?)",
                (grupo_solo_id, owner_id, "Despesa do grupo pessoal", 7, "2026-11-07"),
            )
            despesa_solo_id = cursor.lastrowid
            cursor.execute(
                "INSERT INTO despesa_divisoes "
                "(despesa_id, usuario_id, tipo, percentual, valor) "
                "VALUES (?, ?, 'igual', 100, 7)",
                (despesa_solo_id, owner_id),
            )
            cursor.execute(
                "INSERT INTO convites_grupo "
                "(grupo_id, email, token_hash, expires_at, criado_por) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    grupo_id,
                    guest_email,
                    "a" * 64,
                    "2099-12-31 00:00:00",
                    owner_id,
                ),
            )
            cursor.execute(
                "INSERT INTO convites_grupo "
                "(grupo_id, email, token_hash, expires_at, criado_por) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    grupo_id,
                    owner_email,
                    "b" * 64,
                    "2099-12-31 00:00:00",
                    guest_id,
                ),
            )
            cursor.execute(
                "INSERT INTO gemini_usage_diaria "
                "(data_utc, usuario_id, modelo, solicitacoes) "
                "VALUES (UTC_DATE(), ?, 'account-delete-user', 1), "
                "(UTC_DATE(), 0, 'account-delete-global', 1)",
                (owner_id,),
            )
            connection.commit()
        finally:
            cursor.close()

    resposta = client.delete(
        "/api/auth/delete",
        json={"senha_atual": "SenhaSegura123!"},
        headers=owner_headers,
    )

    assert resposta.status_code == 200
    assert client.get("/api/auth/me", headers=owner_headers).status_code == 401
    assert client.post(
        "/api/auth/refresh",
        json={"refresh_token": owner_login["refresh_token"]},
    ).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": owner_email, "senha": "SenhaSegura123!"}
    ).status_code == 401

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT nome, email, telefone, pix_chave, excluido_em "
                "FROM usuarios WHERE id = ?",
                (owner_id,),
            )
            usuario = cursor.fetchone()
            assert usuario["nome"] == "Usuário excluído"
            assert usuario["email"] == f"excluido+{owner_id}@deleted.invalid"
            assert usuario["telefone"] is None
            assert usuario["pix_chave"] is None
            assert usuario["excluido_em"] is not None

            cursor.execute("SELECT COUNT(*) AS total FROM despesas WHERE id = ?", (despesa_id,))
            assert cursor.fetchone()["total"] == 1
            cursor.execute(
                "SELECT COUNT(*) AS total FROM despesa_divisoes "
                "WHERE despesa_id = ?",
                (despesa_id,),
            )
            assert cursor.fetchone()["total"] == 2
            cursor.execute(
                "SELECT COUNT(*) AS total FROM despesas_pessoais WHERE usuario_id = ?",
                (owner_id,),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT criado_por FROM grupos WHERE id = ?",
                (grupo_id,),
            )
            assert cursor.fetchone()["criado_por"] == guest_id
            cursor.execute(
                "SELECT COUNT(*) AS total FROM grupos WHERE id = ?",
                (grupo_solo_id,),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT COUNT(*) AS total FROM despesas WHERE id = ?",
                (despesa_solo_id,),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT papel FROM participantes "
                "WHERE grupo_id = ? AND usuario_id = ?",
                (grupo_id, guest_id),
            )
            assert cursor.fetchone()["papel"] == "admin"
            cursor.execute(
                "SELECT COUNT(*) AS total FROM convites_grupo "
                "WHERE criado_por = ?",
                (owner_id,),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT COUNT(*) AS total FROM convites_grupo "
                "WHERE LOWER(email) = LOWER(?)",
                (owner_email,),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT COUNT(*) AS total FROM refresh_tokens WHERE usuario_id = ?",
                (owner_id,),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT COUNT(*) AS total FROM gemini_usage_diaria "
                "WHERE usuario_id = ?",
                (owner_id,),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT COUNT(*) AS total FROM gemini_usage_diaria "
                "WHERE usuario_id = 0 AND modelo = 'account-delete-global'",
            )
            assert cursor.fetchone()["total"] == 1
        finally:
            cursor.close()

    membros = client.get(
        f"/api/participantes/grupo/{grupo_id}",
        headers=guest_headers,
    )
    pessoa_excluida = next(
        item for item in membros.get_json()["data"] if item["usuario_id"] == owner_id
    )
    assert pessoa_excluida["nome"] == "Usuário excluído"
    assert pessoa_excluida["email"] is None
    assert pessoa_excluida["ativo"] == 0

    assert cadastrar_usuario(client, "New Owner", owner_email).status_code == 201


def test_accept_group_invitation(client, monkeypatch):
    emails_enviados = []
    monkeypatch.setattr(
        "controllers.participante_controller.EmailService.enviar_convite",
        lambda email, grupo, token: emails_enviados.append((email, grupo, token))
        or True,
    )
    owner_email = "invite-owner@example.com"
    guest_email = "invite-guest@example.com"
    cadastrar_usuario(client, "Owner", owner_email)
    owner_token = client.post(
        "/api/auth/login", json={"email": owner_email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]["token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}
    grupo = client.post(
        "/api/grupos", json={"nome": "Grupo Convite"}, headers=owner_headers
    )
    assert grupo.status_code == 201
    grupo_id = grupo.get_json()["data"]["id"]

    convite = client.post(
        "/api/participantes/convite",
        json={"grupo_id": grupo_id, "email": guest_email},
        headers=owner_headers,
    )
    assert convite.status_code == 201
    assert convite.get_json()["data"]["email_enviado"] is True
    assert "Convite enviado" in convite.get_json()["message"]
    assert len(emails_enviados) == 1
    assert emails_enviados[0][:2] == (guest_email, "Grupo Convite")
    token_convite = convite.get_json()["data"]["token_teste"]

    cadastrar_usuario(client, "Guest", guest_email)
    guest_token = client.post(
        "/api/auth/login", json={"email": guest_email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]["token"]
    aceitar = client.post(
        "/api/participantes/convite/aceitar",
        json={"token": token_convite},
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert aceitar.status_code == 200
    membros = client.get(
        f"/api/participantes/grupo/{grupo_id}",
        headers={"Authorization": f"Bearer {guest_token}"},
    )
    assert membros.status_code == 200
    assert any(item["email"] == guest_email for item in membros.get_json()["data"])


def test_participant_management_checks_roles_and_access(client):
    emails = (
        "participant-admin@example.com",
        "participant-member@example.com",
        "participant-outsider@example.com",
        "participant-new@example.com",
    )
    tokens = []
    user_ids = []
    for index, email in enumerate(emails):
        cadastrar_usuario(client, f"Participant {index}", email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        ).get_json()["data"]
        tokens.append(login["token"])
        user_ids.append(login["user"]["id"])

    headers = [
        {"Authorization": f"Bearer {token}"}
        for token in tokens
    ]
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo participantes", "participantes": [user_ids[1]]},
        headers=headers[0],
    ).get_json()["data"]["id"]
    membros = client.get(
        f"/api/participantes/grupo/{grupo}", headers=headers[0]
    ).get_json()["data"]
    admin = next(item for item in membros if item["usuario_id"] == user_ids[0])
    membro = next(item for item in membros if item["usuario_id"] == user_ids[1])

    assert client.get(
        f"/api/participantes/{membro['id']}", headers=headers[0]
    ).status_code == 200
    assert client.get(
        f"/api/participantes/{membro['id']}", headers=headers[2]
    ).status_code == 403
    assert client.get(
        "/api/participantes/999999", headers=headers[0]
    ).status_code == 404
    for payload in ([], {"papel": 1}, {"papel": "inválido"}):
        assert client.put(
            f"/api/participantes/{membro['id']}",
            json=payload,
            headers=headers[0],
        ).status_code == 400
    assert client.put(
        "/api/participantes/999999",
        json={"papel": "admin"},
        headers=headers[0],
    ).status_code == 404
    assert client.put(
        f"/api/participantes/{membro['id']}",
        json={"papel": "admin"},
        headers=headers[1],
    ).status_code == 403
    assert client.put(
        f"/api/participantes/{admin['id']}",
        json={"papel": "participante"},
        headers=headers[0],
    ).status_code == 400

    assert client.put(
        f"/api/participantes/{membro['id']}",
        json={"papel": "admin"},
        headers=headers[0],
    ).status_code == 200
    assert client.post(
        "/api/participantes",
        json={"grupo_id": grupo, "usuario_id": user_ids[2]},
        headers=headers[1],
    ).status_code == 201
    assert client.put(
        f"/api/participantes/{membro['id']}",
        json={"papel": "participante"},
        headers=headers[0],
    ).status_code == 200

    invalid_add_payloads = [
        ([], 400),
        ({}, 400),
        ({"grupo_id": "invalid", "usuario_id": user_ids[3]}, 400),
        ({"grupo_id": grupo, "usuario_id": True}, 400),
        ({"grupo_id": 999999, "usuario_id": user_ids[3]}, 404),
        ({"grupo_id": grupo, "usuario_id": 999999}, 404),
    ]
    for payload, expected_status in invalid_add_payloads:
        assert client.post(
            "/api/participantes", json=payload, headers=headers[0]
        ).status_code == expected_status
    assert client.post(
        "/api/participantes",
        json={"grupo_id": grupo, "usuario_id": user_ids[3]},
        headers=headers[1],
    ).status_code == 403
    assert client.post(
        "/api/participantes",
        json={"grupo_id": grupo, "usuario_id": user_ids[3]},
        headers=headers[0],
    ).status_code == 201

    terceiro = client.get(
        f"/api/participantes/grupo/{grupo}", headers=headers[0]
    ).get_json()["data"]
    terceiro = next(item for item in terceiro if item["usuario_id"] == user_ids[2])
    assert client.delete(
        f"/api/participantes/{admin['id']}", headers=headers[0]
    ).status_code == 400
    assert client.delete(
        f"/api/participantes/{terceiro['id']}", headers=headers[1]
    ).status_code == 403
    assert client.delete(
        "/api/participantes/999999", headers=headers[0]
    ).status_code == 404
    assert client.delete(
        f"/api/participantes/{terceiro['id']}", headers=headers[0]
    ).status_code == 200


def test_group_invitation_validation_and_email_failure(client, monkeypatch):
    owner_email = "invite-validation-owner@example.com"
    member_email = "invite-validation-member@example.com"
    cadastrar_usuario(client, "Invite Owner", owner_email)
    cadastrar_usuario(client, "Invite Member", member_email)
    owner = client.post(
        "/api/auth/login",
        json={"email": owner_email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    member = client.post(
        "/api/auth/login",
        json={"email": member_email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    owner_headers = {"Authorization": f"Bearer {owner['token']}"}
    member_headers = {"Authorization": f"Bearer {member['token']}"}
    grupo = client.post(
        "/api/grupos",
        json={
            "nome": "Grupo validar convite",
            "participantes": [member["user"]["id"]],
        },
        headers=owner_headers,
    ).get_json()["data"]["id"]

    for payload in ([], {}, {"grupo_id": "x", "email": "valid@example.com"}):
        assert client.post(
            "/api/participantes/convite", json=payload, headers=owner_headers
        ).status_code == 400
    assert client.post(
        "/api/participantes/convite",
        json={"grupo_id": 999999, "email": "valid@example.com"},
        headers=owner_headers,
    ).status_code == 404
    assert client.post(
        "/api/participantes/convite",
        json={"grupo_id": grupo, "email": "   "},
        headers=owner_headers,
    ).status_code == 400
    assert client.post(
        "/api/participantes/convite",
        json={"grupo_id": grupo, "email": "another@example.com"},
        headers=member_headers,
    ).status_code == 403
    assert client.post(
        "/api/participantes/convite",
        json={"grupo_id": grupo, "email": member_email},
        headers=owner_headers,
    ).status_code == 409

    monkeypatch.setattr(
        "controllers.participante_controller.EmailService.enviar_convite",
        lambda *_args: False,
    )
    convite = client.post(
        "/api/participantes/convite",
        json={"grupo_id": grupo, "email": "new-guest@example.com"},
        headers=owner_headers,
    )
    assert convite.status_code == 201
    assert convite.get_json()["data"]["email_enviado"] is False
    assert "mas o e-mail não foi enviado" in convite.get_json()["message"]
    token = convite.get_json()["data"]["token_teste"]

    assert client.post(
        "/api/participantes/convite/aceitar",
        json={"token": "token-inexistente"},
        headers=member_headers,
    ).status_code == 400
    cadastrar_usuario(client, "Wrong Guest", "wrong-guest@example.com")
    wrong_guest = client.post(
        "/api/auth/login",
        json={"email": "wrong-guest@example.com", "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    assert client.post(
        "/api/participantes/convite/aceitar",
        json={"token": token},
        headers={"Authorization": f"Bearer {wrong_guest['token']}"},
    ).status_code == 403


def test_participant_removal_is_blocked_by_pending_balance(client):
    owner_email = "remove-owner@example.com"
    guest_email = "remove-guest@example.com"
    cadastrar_usuario(client, "Owner", owner_email)
    cadastrar_usuario(client, "Guest", guest_email)
    owner = client.post(
        "/api/auth/login",
        json={"email": owner_email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    guest = client.post(
        "/api/auth/login",
        json={"email": guest_email, "senha": "SenhaSegura123!"},
    ).get_json()["data"]
    owner_headers = {"Authorization": f"Bearer {owner['token']}"}

    grupo = client.post(
        "/api/grupos", json={"nome": "Grupo para remoção"}, headers=owner_headers
    ).get_json()["data"]
    grupo_id = grupo["id"]
    assert client.post(
        "/api/participantes",
        json={"grupo_id": grupo_id, "usuario_id": guest["user"]["id"]},
        headers=owner_headers,
    ).status_code == 201

    participantes = client.get(
        f"/api/participantes/grupo/{grupo_id}", headers=owner_headers
    ).get_json()["data"]
    guest_participant = next(
        item for item in participantes if item["usuario_id"] == guest["user"]["id"]
    )
    despesa = client.post(
        "/api/despesas",
        json={
            "grupo_id": grupo_id,
            "descricao": "Despesa pendente",
            "valor": 20,
            "participantes": [owner["user"]["id"], guest["user"]["id"]],
        },
        headers=owner_headers,
    )
    assert despesa.status_code == 201

    resposta = client.delete(
        f"/api/participantes/{guest_participant['id']}", headers=owner_headers
    )

    assert resposta.status_code == 409
    participantes_apos = client.get(
        f"/api/participantes/grupo/{grupo_id}", headers=owner_headers
    ).get_json()["data"]
    assert any(
        item["id"] == guest_participant["id"] and item["ativo"] == 1
        for item in participantes_apos
    )
    assert client.delete(
        f"/api/despesas/{despesa.get_json()['data']['id']}", headers=owner_headers
    ).status_code == 200
    assert client.delete(
        f"/api/participantes/{guest_participant['id']}", headers=owner_headers
    ).status_code == 200


def test_password_reset_token_is_single_use(client):
    email = "reset-test@example.com"
    cadastrar_usuario(client, "Reset Test", email)
    solicitacao = client.post("/api/auth/esqueci-senha", json={"email": email})
    assert solicitacao.status_code == 200
    token = solicitacao.get_json()["data"]["token_teste"]

    resposta = client.post(
        "/api/auth/redefinir-senha",
        json={"token": token, "nova_senha": "NovaSenha456!"},
    )
    assert resposta.status_code == 200
    assert client.post(
        "/api/auth/login", json={"email": email, "senha": "NovaSenha456!"}
    ).status_code == 200
    assert client.post(
        "/api/auth/redefinir-senha",
        json={"token": token, "nova_senha": "abcdef"},
    ).status_code == 400


def test_delete_account_removes_group_with_only_inactive_members(client):
    owner_email = "inactive-group-owner@example.com"
    member_email = "inactive-group-member@example.com"
    cadastrar_usuario(client, "Owner", owner_email)
    cadastrar_usuario(client, "Inactive", member_email)
    owner = client.post(
        "/api/auth/login", json={"email": owner_email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]
    member = client.post(
        "/api/auth/login", json={"email": member_email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo sem membros ativos"},
        headers={"Authorization": f"Bearer {owner['token']}"},
    ).get_json()["data"]
    grupo_id = grupo["id"]
    assert client.post(
        "/api/participantes",
        json={"grupo_id": grupo_id, "usuario_id": member["user"]["id"]},
        headers={"Authorization": f"Bearer {owner['token']}"},
    ).status_code == 201

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE participantes SET ativo = 0 "
                "WHERE grupo_id = ? AND usuario_id = ?",
                (grupo_id, member["user"]["id"]),
            )
            connection.commit()
        finally:
            cursor.close()

    resposta = client.delete(
        "/api/auth/delete",
        json={"senha_atual": "SenhaSegura123!"},
        headers={"Authorization": f"Bearer {owner['token']}"},
    )

    assert resposta.status_code == 200
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute("SELECT id FROM grupos WHERE id = ?", (grupo_id,))
            assert cursor.fetchone() is None
        finally:
            cursor.close()


def test_receipt_reader_normalizes_ai_response(client, monkeypatch):
    email = "receipt-test@example.com"
    cadastrar_usuario(client, "Receipt Test", email)
    token = client.post(
        "/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]["token"]
    monkeypatch.setattr(
        "routes.recibo_routes.ler_recibo",
        lambda *_: {
            "estabelecimento": " Mercado Central ",
            "data": "2026-10-25",
            "valor_total": "1.234,56",
            "categoria_sugerida": "Inexistente",
        },
    )
    resposta = client.post(
        "/api/recibos/ler",
        data={
            "imagem": (
                BytesIO(b"\xff\xd8\xffconteudo-de-teste"),
                "recibo.jpg",
                "image/jpeg",
            )
        },
        headers={"Authorization": f"Bearer {token}"},
        content_type="multipart/form-data",
    )
    assert resposta.status_code == 200
    dados = resposta.get_json()["data"]
    assert dados == {
        "estabelecimento": "Mercado Central",
        "data": "2026-10-25",
        "valor_total": 1234.56,
        "moeda": "BRL",
        "categoria_sugerida": "Outros",
    }


def test_receipt_rate_limit_is_per_authenticated_user(client, monkeypatch):
    tokens = []
    for nome, email in (
        ("Receipt User One", "receipt-limit-one@example.com"),
        ("Receipt User Two", "receipt-limit-two@example.com"),
    ):
        cadastrar_usuario(client, nome, email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        )
        tokens.append(login.get_json()["data"]["token"])

    monkeypatch.setattr(
        "routes.recibo_routes.ler_recibo",
        lambda *_: {"estabelecimento": "Teste"},
    )

    def enviar(token):
        return client.post(
            "/api/recibos/ler",
            data={
                "imagem": (
                    BytesIO(b"\xff\xd8\xffconteudo-de-teste"),
                    "recibo.jpg",
                    "image/jpeg",
                )
            },
            headers={"Authorization": f"Bearer {token}"},
            content_type="multipart/form-data",
        )

    assert [enviar(tokens[0]).status_code for _ in range(5)] == [200] * 5
    assert enviar(tokens[0]).status_code == 429
    assert enviar(tokens[1]).status_code == 200


def test_refresh_rate_limit_is_per_account(client):
    tokens = []
    for nome, email in (
        ("Refresh User One", "refresh-limit-one@example.com"),
        ("Refresh User Two", "refresh-limit-two@example.com"),
    ):
        cadastrar_usuario(client, nome, email)
        login = client.post(
            "/api/auth/login",
            json={"email": email, "senha": "SenhaSegura123!"},
        )
        tokens.append(login.get_json()["data"]["refresh_token"])

    refresh = tokens[0]
    for _ in range(10):
        resposta = client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert resposta.status_code == 200
        refresh = resposta.get_json()["data"]["refresh_token"]

    assert client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh},
    ).status_code == 429

    assert client.post(
        "/api/auth/refresh",
        json={"refresh_token": tokens[1]},
    ).status_code == 200


def test_receipt_reader_rejects_mime_content_mismatch(client, monkeypatch):
    email = "receipt-mime-test@example.com"
    cadastrar_usuario(client, "Receipt MIME Test", email)
    token = client.post(
        "/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"}
    ).get_json()["data"]["token"]
    monkeypatch.setattr(
        "routes.recibo_routes.ler_recibo",
        lambda *_: pytest.fail("A imagem inválida não deve ser enviada à IA."),
    )

    resposta = client.post(
        "/api/recibos/ler",
        data={"imagem": (BytesIO(b"nao-e-jpeg"), "recibo.jpg", "image/jpeg")},
        headers={"Authorization": f"Bearer {token}"},
        content_type="multipart/form-data",
    )

    assert resposta.status_code == 400
    assert "conteúdo do arquivo" in resposta.get_json()["message"]


def test_email_confirmation_routes_are_removed(client):
    assert client.post(
        "/api/auth/confirmar-email", json={"token": "unused"}
    ).status_code == 404
    assert client.post(
        "/api/auth/reenviar-confirmacao", json={"email": "person@example.com"}
    ).status_code == 404


def test_legacy_user_without_verification_token_can_login(client):
    email = "legacy-account@example.com"
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "INSERT INTO usuarios "
                "(nome, email, senha, email_verificado) VALUES (?, ?, ?, 0)",
                ("Conta antiga", email, hash_password("SenhaSegura123!")),
            )
            connection.commit()
        finally:
            cursor.close()

    initialize_database()

    response = client.post(
        "/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"}
    )
    assert response.status_code == 200
