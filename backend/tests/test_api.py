import pytest
from datetime import date, timedelta
from io import BytesIO

from app import create_app
from database.connection import cursor_for, get_connection_context, initialize_database
from utils.password_utils import hash_password

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

    assert invalid_create.status_code == 400
    assert invalid_update.status_code == 400


def test_auth_required(client):
    response = client.get("/api/grupos")
    assert response.status_code == 401


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
        headers=debtor_headers,
    )
    assert pagamento.status_code == 201
    pagamento_id = pagamento.get_json()["data"]["id"]

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
    invalid_payloads = [
        [],
        {"nome": []},
        {"nome": " "},
        {"nome": "x" * 101},
        {"nome": "Viagem", "tipo": 1},
        {"nome": "Viagem", "tipo": "invalido"},
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
        json={"nome": "Viagem", "tipo": "pessoal"},
        headers=owner_headers,
    )
    assert criada.status_code == 201
    categoria_id = criada.get_json()["data"]["id"]
    duplicada = client.post(
        "/api/categorias",
        json={"nome": "Viagem", "tipo": "pessoal"},
        headers=owner_headers,
    )
    assert duplicada.status_code == 409

    criada_ambos = client.post(
        "/api/categorias",
        json={"nome": "Casa", "tipo": "ambos"},
        headers=owner_headers,
    )
    assert criada_ambos.status_code == 201
    listagem_pessoal = client.get(
        "/api/categorias?tipo=pessoal", headers=owner_headers
    ).get_json()["data"]
    assert {item["nome"] for item in listagem_pessoal} >= {"Viagem", "Casa"}
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
        json={"nome": "Viagens", "tipo": "ambos"},
        headers=owner_headers,
    )
    assert atualizada.status_code == 200
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
        f"/api/despesas-pessoais/{despesa_id}", headers=owner_headers
    ).status_code == 404
    assert client.get(
        f"/api/despesas-pessoais/{receita_id}", headers=owner_headers
    ).status_code == 200
    assert client.get(
        f"/api/despesas-pessoais/{despesa_outro}", headers=owner_headers
    ).status_code == 403


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
        {"nome": "Grupo", "descricao": []},
        {"nome": "Grupo", "participantes": "invalid"},
        {"nome": "Grupo", "participantes": [user_ids[2], "invalid"]},
        {"nome": "Grupo", "participantes": [999999]},
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
    assert len(client.get("/api/grupos", headers=owner_headers).get_json()["data"]) == 1
    assert client.get(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).status_code == 200
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
    for payload in ([], {"nome": 2}, {"nome": ""}, {"nome": "A"}, {"nome": "Ok", "descricao": []}):
        assert client.put(
            f"/api/grupos/{grupo_id}", json=payload, headers=owner_headers
        ).status_code == 400
    atualizado = client.put(
        f"/api/grupos/{grupo_id}",
        json={"nome": "Grupo atualizado", "descricao": ""},
        headers=owner_headers,
    )
    assert atualizado.status_code == 200
    detalhes = client.get(
        f"/api/grupos/{grupo_id}", headers=owner_headers
    ).get_json()["data"]
    assert detalhes["nome"] == "Grupo atualizado"
    assert detalhes["descricao"] is None

    assert client.delete(
        f"/api/grupos/{grupo_id}", headers=member_headers
    ).status_code == 403
    assert client.delete(
        "/api/grupos/999999", headers=owner_headers
    ).status_code == 404
    assert client.delete(
        f"/api/grupos/{grupo_id}", headers=owner_headers
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


def test_global_user_directory_is_not_exposed(client):
    response = client.get("/api/usuarios")
    assert response.status_code == 404


def test_signup_and_login(client):
    email = "api-test@example.com"
    response = cadastrar_usuario(client, "API Test", email)
    assert "Conta criada com sucesso" in response.get_json()["message"]
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


def test_duplicate_signup_returns_conflict(client):
    payload = {"nome": "Dup", "email": "dup@example.com", "senha": "SenhaSegura123!"}
    assert client.post("/api/auth/cadastro", json=payload).status_code == 201
    assert client.post("/api/auth/cadastro", json=payload).status_code == 409


def test_signup_rejects_password_below_the_minimum_length(client):
    resposta = client.post(
        "/api/auth/cadastro",
        json={
            "nome": "Senha Curta",
            "email": "senha-curta@example.com",
            "senha": "curta123",
        },
    )

    assert resposta.status_code == 400
    assert "12 caracteres" in resposta.get_json()["message"]


def test_update_profile_and_password(client):
    email = "profile-test@example.com"
    cadastrar_usuario(client, "Profile Test", email)
    login = client.post("/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"})
    token = login.get_json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert client.put(
        "/api/auth/atualizar",
        json={"nome": "Nome Atualizado", "email": email, "telefone": "11999999999"},
        headers=headers,
    ).status_code == 200
    assert client.put(
        "/api/auth/alterar-senha",
        json={"senha_atual": "SenhaSegura123!", "nova_senha": "NovaSenha456!"},
        headers=headers,
    ).status_code == 200
    assert client.post("/api/auth/login", json={"email": email, "senha": "NovaSenha456!"}).status_code == 200


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
                "SELECT nome, email, telefone, excluido_em "
                "FROM usuarios WHERE id = ?",
                (owner_id,),
            )
            usuario = cursor.fetchone()
            assert usuario["nome"] == "Usuário excluído"
            assert usuario["email"] == f"excluido+{owner_id}@deleted.invalid"
            assert usuario["telefone"] is None
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
