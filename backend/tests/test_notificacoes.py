"""Testes de preferências, dispositivos e envio de notificações push."""

import json

import pytest

from app import create_app
from database.connection import cursor_for, get_connection_context
from models.notificacao_model import NotificacaoModel
from models.push_outbox_model import PushOutboxModel
from services.notificacao_service import NotificacaoService
from services.push_outbox_worker import processar_proxima

app = create_app()


@pytest.fixture()
def client():
    app.config.update(TESTING=True)
    return app.test_client()


def criar_usuario_autenticado(client, email):
    cadastro = client.post(
        "/api/auth/cadastro",
        json={"nome": "Teste Push", "email": email, "senha": "SenhaSegura123!"},
    )
    assert cadastro.status_code == 201
    login = client.post(
        "/api/auth/login", json={"email": email, "senha": "SenhaSegura123!"}
    )
    assert login.status_code == 200
    data = login.get_json()["data"]
    return data, {"Authorization": f"Bearer {data['token']}"}


def _mock_expo_connection(monkeypatch, response_body):
    captured = {}

    class Response:
        status = 200

        def read(self):
            return response_body

    class Connection:
        def __init__(self, host, timeout):
            captured["host"] = host
            captured["timeout"] = timeout

        def request(self, method, path, body, headers):
            captured["method"] = method
            captured["path"] = path
            captured["payload"] = json.loads(body)
            captured["headers"] = headers

        def getresponse(self):
            return Response()

        def close(self):
            pass

    monkeypatch.setattr(
        "services.notificacao_service.HTTPSConnection", Connection
    )
    return captured


def test_preferencias_de_notificacao_sao_persistidas(client):
    _, headers = criar_usuario_autenticado(client, "push-preferences@example.com")

    inicial = client.get(
        "/api/notificacoes/preferencias", headers=headers
    )
    assert inicial.status_code == 200
    assert inicial.get_json()["data"] == {
        "notificacoes": False,
        "sons": True,
    }

    atualizada = client.put(
        "/api/notificacoes/preferencias",
        headers=headers,
        json={"notificacoes": True, "sons": False},
    )

    assert atualizada.status_code == 200
    assert client.get(
        "/api/notificacoes/preferencias", headers=headers
    ).get_json()["data"] == {"notificacoes": True, "sons": False}


def test_preferencias_rejeitam_valores_nao_booleanos(client):
    _, headers = criar_usuario_autenticado(client, "push-invalid@example.com")

    resposta = client.put(
        "/api/notificacoes/preferencias",
        headers=headers,
        json={"notificacoes": "true", "sons": True},
    )

    assert resposta.status_code == 400


def test_endpoints_de_notificacao_rejeitam_json_que_nao_seja_objeto(client):
    _, headers = criar_usuario_autenticado(client, "push-invalid-body@example.com")

    assert client.put(
        "/api/notificacoes/preferencias", headers=headers, json=[]
    ).status_code == 400
    assert client.post(
        "/api/notificacoes/dispositivos", headers=headers, json=[]
    ).status_code == 400
    assert client.delete(
        "/api/notificacoes/dispositivos", headers=headers, json=[]
    ).status_code == 400


def test_dispositivo_push_e_vinculado_e_removido_pelo_usuario(client):
    primeiro, primeiro_headers = criar_usuario_autenticado(
        client, "push-device-one@example.com"
    )
    _, segundo_headers = criar_usuario_autenticado(
        client, "push-device-two@example.com"
    )
    token = "ExpoPushToken[push-device-test]"
    payload = {"token": token, "plataforma": "android"}

    resposta = client.post(
        "/api/notificacoes/dispositivos",
        headers=primeiro_headers,
        json=payload,
    )
    assert resposta.status_code == 200
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT usuario_id FROM expo_push_tokens WHERE token = ?",
                (token,),
            )
            assert cursor.fetchone()["usuario_id"] == primeiro["user"]["id"]
        finally:
            cursor.close()

    assert client.delete(
        "/api/notificacoes/dispositivos",
        headers=segundo_headers,
        json={"token": token},
    ).status_code == 200
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM expo_push_tokens WHERE token = ?",
                (token,),
            )
            assert cursor.fetchone()["total"] == 1

        finally:
            cursor.close()

    assert client.delete(
        "/api/notificacoes/dispositivos",
        headers=primeiro_headers,
        json={"token": token},
    ).status_code == 200
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM expo_push_tokens WHERE token = ?",
                (token,),
            )
            assert cursor.fetchone()["total"] == 0
        finally:
            cursor.close()


def test_dispositivo_rejeita_token_expo_invalido(client):
    _, headers = criar_usuario_autenticado(
        client, "push-invalid-device@example.com"
    )

    resposta = client.post(
        "/api/notificacoes/dispositivos",
        headers=headers,
        json={"token": "token-invalido", "plataforma": "android"},
    )

    assert resposta.status_code == 400


def test_mensagem_push_respeita_som_e_dados_do_grupo():
    mensagem_com_som = NotificacaoService.montar_mensagem_push(
        {
            "titulo": "Nova despesa no grupo",
            "tipo": "nova_despesa",
            "grupo_id": 42,
            "grupo_nome": "Viagem",
        },
        {
            "token": "ExpoPushToken[device-with-sound]",
            "sons_notificacoes_ativos": 1,
        },
    )
    mensagem_silenciosa = NotificacaoService.montar_mensagem_push(
        {
            "titulo": "Nova despesa no grupo",
            "tipo": "nova_despesa",
            "grupo_id": 42,
            "grupo_nome": "Viagem",
        },
        {
            "token": "ExpoPushToken[device-silent]",
            "sons_notificacoes_ativos": 0,
        },
    )

    assert mensagem_com_som["sound"] == "default"
    assert mensagem_silenciosa["sound"] is None
    assert mensagem_com_som["channelId"] == "default"
    assert mensagem_silenciosa["channelId"] == "silent"
    assert mensagem_com_som["data"] == {
        "tipo": "nova_despesa",
        "groupId": "42",
        "grupoNome": "Viagem",
    }


def test_worker_reagenda_push_apos_falha_transitoria(client, monkeypatch):
    dados, _headers = criar_usuario_autenticado(
        client, "push-outbox-retry@example.com"
    )
    usuario_id = dados["user"]["id"]
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE usuarios SET notificacoes_ativas = 1 WHERE id = ?",
                (usuario_id,),
            )
            cursor.execute(
                """
                INSERT INTO expo_push_tokens (usuario_id, token, plataforma)
                VALUES (?, 'ExpoPushToken[outbox-retry]', 'android')
                """,
                (usuario_id,),
            )
            cursor.execute(
                """
                INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem)
                VALUES (?, 'nova_despesa', 'Teste', 'Mensagem')
                """,
                (usuario_id,),
            )
            notificacao_id = cursor.lastrowid
            PushOutboxModel.enfileirar(notificacao_id, connection)
            connection.commit()
        finally:
            cursor.close()

    def falhar(_mensagens):
        raise RuntimeError("Expo indisponível")

    monkeypatch.setattr(
        NotificacaoService, "_enviar_lote_push", staticmethod(falhar)
    )
    assert processar_proxima() is True

    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT status, tentativas, ultimo_erro
                FROM push_outbox WHERE notificacao_id = ?
                """,
                (notificacao_id,),
            )
            evento = cursor.fetchone()
        finally:
            cursor.close()

    assert evento["status"] == "pending"
    assert evento["tentativas"] == 1
    assert "Expo indisponível" in evento["ultimo_erro"]


def test_push_request_usa_servico_expo(monkeypatch):
    capturado = _mock_expo_connection(
        monkeypatch, b'{"data":[{"status":"ok"}]}'
    )
    monkeypatch.setattr(
        "services.notificacao_service.Config.EXPO_ACCESS_TOKEN",
        "expo-test-access",
    )

    NotificacaoService._enviar_lote_push(
        [{"to": "ExpoPushToken[device]", "title": "Teste"}]
    )

    assert capturado["host"] == "exp.host"
    assert capturado["path"] == "/--/api/v2/push/send"
    assert capturado["method"] == "POST"
    assert capturado["payload"][0]["title"] == "Teste"
    assert capturado["timeout"] == 5
    assert capturado["headers"]["Authorization"] == "Bearer expo-test-access"


def test_push_rejeita_ticket_com_falha_do_expo(monkeypatch):
    _mock_expo_connection(
        monkeypatch,
        b'{"data":[{"status":"error","message":"DeviceNotRegistered"}]}',
    )
    tickets = NotificacaoService._enviar_lote_push(
        [{"to": "ExpoPushToken[device]", "title": "Teste"}]
    )
    assert tickets[0]["message"] == "DeviceNotRegistered"


def test_push_consulta_recibos_com_endpoint_do_expo(monkeypatch):
    capturado = _mock_expo_connection(
        monkeypatch, b'{"data":{"ticket-1":{"status":"ok"}}}'
    )
    recibos = NotificacaoService._consultar_recibos(["ticket-1"])

    assert capturado["host"] == "exp.host"
    assert capturado["path"] == "/--/api/v2/push/getReceipts"
    assert capturado["method"] == "POST"
    assert capturado["payload"] == {"ids": ["ticket-1"]}
    assert capturado["timeout"] == 5
    assert recibos == {"ticket-1": {"status": "ok"}}


def test_push_rejeita_endpoint_expo_nao_permitido():
    with pytest.raises(ValueError, match="Endpoint Expo invalido"):
        NotificacaoService._post_expo_json(
            "https://example.invalid/", {}, {}
        )


def test_notificacoes_sao_listadas_e_marcadas_com_escopo_do_usuario(client):
    primeiro, primeiro_headers = criar_usuario_autenticado(
        client, "push-notification-owner@example.com"
    )
    _, segundo_headers = criar_usuario_autenticado(
        client, "push-notification-other@example.com"
    )
    primeiro_id = NotificacaoModel.criar(
        primeiro["user"]["id"],
        None,
        "teste",
        "Notificação não lida",
        "Mensagem de teste",
    )
    segundo_id = NotificacaoModel.criar(
        primeiro["user"]["id"],
        None,
        "teste",
        "Notificação já lida",
        "Outra mensagem",
    )
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE notificacoes SET lida = 1 WHERE id = ?", (segundo_id,)
            )
            connection.commit()
        finally:
            cursor.close()

    todas = client.get("/api/notificacoes", headers=primeiro_headers)
    assert todas.status_code == 200
    assert {item["id"] for item in todas.get_json()["data"]} == {
        primeiro_id,
        segundo_id,
    }
    nao_lidas = client.get(
        "/api/notificacoes?nao_lidas=true", headers=primeiro_headers
    )
    assert nao_lidas.status_code == 200
    assert [item["id"] for item in nao_lidas.get_json()["data"]] == [primeiro_id]

    assert client.put(
        f"/api/notificacoes/{primeiro_id}/ler", headers=segundo_headers
    ).status_code == 404
    assert client.put(
        "/api/notificacoes/999999/ler", headers=primeiro_headers
    ).status_code == 404
    assert client.put(
        f"/api/notificacoes/{primeiro_id}/ler", headers=primeiro_headers
    ).status_code == 200
    assert client.get(
        "/api/notificacoes?nao_lidas=true", headers=primeiro_headers
    ).get_json()["data"] == []


def test_notificacoes_suportam_paginacao_e_filtro_nao_lidas(client):
    dados, headers = criar_usuario_autenticado(
        client, "push-pagination@example.com"
    )
    usuario_id = dados["user"]["id"]
    for indice in range(3):
        NotificacaoModel.criar(
            usuario_id,
            None,
            "teste",
            f"Notificação {indice}",
            "Mensagem de teste",
        )
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE notificacoes SET lida = 1 "
                "WHERE usuario_id = ? AND titulo = ?",
                (usuario_id, "Notificação 0"),
            )
            connection.commit()
        finally:
            cursor.close()

    primeira = client.get(
        "/api/notificacoes?limit=2&offset=0", headers=headers
    ).get_json()
    segunda = client.get(
        "/api/notificacoes?limit=2&offset=2", headers=headers
    ).get_json()
    nao_lidas = client.get(
        "/api/notificacoes?nao_lidas=true&limit=2", headers=headers
    ).get_json()

    assert len(primeira["data"]) == 2
    assert primeira["paginacao"]["total"] == 3
    assert primeira["paginacao"]["has_more"] is True
    assert len(segunda["data"]) == 1
    assert segunda["paginacao"]["has_more"] is False
    assert nao_lidas["paginacao"]["total"] == 2
    assert all(notificacao["lida"] in (False, 0) for notificacao in nao_lidas["data"])
    assert client.get(
        "/api/notificacoes?limit=101", headers=headers
    ).status_code == 400


def test_modelo_notificacao_devolve_none_para_usuario_ausente():
    assert NotificacaoModel.obter_preferencias(999999) is None
    assert NotificacaoModel.atualizar_preferencias(999999, True, False) is False
    assert NotificacaoModel.remover_push_token(999999, "missing-token") is False
    assert NotificacaoModel.listar_tokens_push([]) == []


def test_health_snapshot_da_outbox_retorna_contadores_e_reserva_expirada():
    snapshot = PushOutboxModel.health_snapshot()

    assert snapshot["pending"] == 0
    assert snapshot["processing"] == 0
    assert snapshot["failed"] == 0
    assert snapshot["sent"] == 0
    assert snapshot["oldest_pending_age_seconds"] == 0
    assert snapshot["stale_processing"] == 0


def test_notification_model_adds_group_notifications_in_shared_transaction(client):
    dados, headers = criar_usuario_autenticado(
        client, "push-group-admin@example.com"
    )
    membro_dados, membro_headers = criar_usuario_autenticado(
        client, "push-group-member@example.com"
    )
    membro_id = membro_dados["user"]["id"]
    grupo = client.post(
        "/api/grupos",
        json={"nome": "Grupo notificacao", "participantes": [membro_id]},
        headers=headers,
    ).get_json()["data"]["id"]

    with get_connection_context() as connection:
        destinatarios = NotificacaoService.notificar_nova_despesa(
            grupo, dados["user"]["id"], "Jantar", 25.5, connection
        )
        assert destinatarios == [
            {"usuario_id": membro_id, "grupo_nome": "Grupo notificacao"}
        ]
        connection.commit()

    notificacoes = client.get("/api/notificacoes", headers=membro_headers)
    assert notificacoes.status_code == 200
    assert notificacoes.get_json()["data"][0]["mensagem"] == (
        "A despesa 'Jantar' de R$ 25.50 foi adicionada ao grupo."
    )


def test_worker_confirma_evento_sem_dispositivos(monkeypatch):
    monkeypatch.setattr(
        PushOutboxModel,
        "reivindicar_proxima",
        staticmethod(lambda _max: {"id": 1, "notificacao_id": 1, "tentativas": 1}),
    )
    monkeypatch.setattr(
        NotificacaoModel,
        "obter_dados_push",
        staticmethod(lambda _id: []),
    )
    monkeypatch.setattr(
        PushOutboxModel,
        "preparar_destinatarios",
        staticmethod(lambda _outbox_id, _rows: None),
    )
    monkeypatch.setattr(
        PushOutboxModel,
        "recibos_pendentes",
        staticmethod(lambda _outbox_id: []),
    )
    monkeypatch.setattr(
        PushOutboxModel,
        "listar_destinatarios",
        staticmethod(lambda _outbox_id, status=None: []),
    )
    monkeypatch.setattr(
        PushOutboxModel,
        "marcar_enviado",
        staticmethod(lambda _outbox_id: None),
    )
    monkeypatch.setattr(
        NotificacaoService,
        "_enviar_lote_push",
        staticmethod(lambda _mensagens: pytest.fail("Não deveria enviar push")),
    )
    assert processar_proxima() is True


def test_worker_envia_lotes_de_ate_cem_dispositivos(monkeypatch):
    lotes = []
    monkeypatch.setattr(
        PushOutboxModel,
        "reivindicar_proxima",
        staticmethod(lambda _max: {"id": 1, "notificacao_id": 42, "tentativas": 1}),
    )
    monkeypatch.setattr(
        NotificacaoModel,
        "obter_dados_push",
        staticmethod(
            lambda _id: [
                {
                    "token_id": index,
                    "usuario_id": index,
                    "token": f"ExpoPushToken[device-{index}]",
                    "sons_notificacoes_ativos": 1,
                    "titulo": "Nova despesa",
                    "tipo": "nova_despesa",
                    "grupo_id": 42,
                    "grupo_nome": "Grupo",
                }
                for index in range(1, 202)
            ]
        ),
    )
    monkeypatch.setattr(
        NotificacaoService,
        "_enviar_lote_push",
        staticmethod(
            lambda mensagens: lotes.append(mensagens)
            or [{"status": "ok", "id": f"ticket-{len(lotes)}-{index}"} for index, _ in enumerate(mensagens)]
        ),
    )
    destinos = []
    monkeypatch.setattr(
        PushOutboxModel,
        "preparar_destinatarios",
        staticmethod(lambda _outbox_id, _rows: None),
    )
    monkeypatch.setattr(
        PushOutboxModel,
        "recibos_pendentes",
        staticmethod(lambda _outbox_id: []),
    )
    monkeypatch.setattr(
        PushOutboxModel,
        "listar_destinatarios",
        staticmethod(
            lambda _outbox_id, status=None: (
                [{"id": index, "token": f"ExpoPushToken[device-{index}]"} for index in range(1, 202)]
                if status == "pending" and not destinos
                else []
            )
        ),
    )
    monkeypatch.setattr(
        PushOutboxModel,
        "registrar_tickets",
        staticmethod(lambda _outbox_id, results: destinos.extend(results)),
    )
    enviados = []
    monkeypatch.setattr(
        PushOutboxModel,
        "marcar_enviado",
        staticmethod(lambda outbox_id: enviados.append(outbox_id)),
    )
    assert processar_proxima() is True

    assert [len(lote) for lote in lotes] == [100, 100, 1]
    assert enviados == [1]


def test_worker_nao_reenvia_dispositivos_com_ticket_aceito(client, monkeypatch):
    dados, _headers = criar_usuario_autenticado(
        client, "push-partial-batch@example.com"
    )
    usuario_id = dados["user"]["id"]
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE usuarios SET notificacoes_ativas = 1 WHERE id = ?",
                (usuario_id,),
            )
            for index in range(101):
                cursor.execute(
                    """
                    INSERT INTO expo_push_tokens (usuario_id, token, plataforma)
                    VALUES (?, ?, 'ios')
                    """,
                    (usuario_id, f"ExpoPushToken[partial-{index}]"),
                )
            connection.commit()
        finally:
            cursor.close()
    notificacao_id = NotificacaoModel.criar(
        usuario_id,
        None,
        "nova_despesa",
        "Teste parcial",
        "Mensagem de teste",
    )

    chamadas = []

    def enviar(mensagens):
        chamadas.append([mensagem["to"] for mensagem in mensagens])
        if len(chamadas) == 2:
            raise RuntimeError("Expo indisponível no segundo lote")
        return [
            {"status": "ok", "id": f"ticket-{len(chamadas)}-{index}"}
            for index, _ in enumerate(mensagens)
        ]

    monkeypatch.setattr(
        NotificacaoService, "_enviar_lote_push", staticmethod(enviar)
    )
    monkeypatch.setattr(
        NotificacaoService,
        "_consultar_recibos",
        staticmethod(lambda _ticket_ids: {}),
    )

    assert processar_proxima() is True
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                UPDATE push_outbox
                SET disponivel_em = CURRENT_TIMESTAMP
                WHERE notificacao_id = ?
                """,
                (notificacao_id,),
            )
            connection.commit()
        finally:
            cursor.close()

    assert processar_proxima() is True

    assert [len(chamada) for chamada in chamadas] == [100, 1, 1]
    assert set(chamadas[0]).isdisjoint(chamadas[2])
    assert chamadas[2] == chamadas[1]
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT d.status, COUNT(*) AS total
                FROM push_outbox_destinatarios d
                JOIN push_outbox o ON o.id = d.outbox_id
                WHERE o.notificacao_id = ?
                GROUP BY d.status
                """,
                (notificacao_id,),
            )
            resultados = {row["status"]: row["total"] for row in cursor.fetchall()}
        finally:
            cursor.close()

    assert resultados == {"ticketed": 101}


def test_worker_aplica_recibos_e_remove_token_nao_registrado(client, monkeypatch):
    dados, _headers = criar_usuario_autenticado(
        client, "push-receipt-invalid@example.com"
    )
    usuario_id = dados["user"]["id"]
    token_invalido = "ExpoPushToken[receipt-invalid]"
    token_entregue = "ExpoPushToken[receipt-delivered]"
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE usuarios SET notificacoes_ativas = 1 WHERE id = ?",
                (usuario_id,),
            )
            cursor.execute(
                """
                INSERT INTO expo_push_tokens (usuario_id, token, plataforma)
                VALUES (?, ?, 'android')
                """,
                (usuario_id, token_invalido),
            )
            cursor.execute(
                """
                INSERT INTO expo_push_tokens (usuario_id, token, plataforma)
                VALUES (?, ?, 'ios')
                """,
                (usuario_id, token_entregue),
            )
            connection.commit()
        finally:
            cursor.close()
    notificacao_id = NotificacaoModel.criar(
        usuario_id,
        None,
        "nova_despesa",
        "Teste recibo",
        "Mensagem de teste",
    )
    chamadas_envio = []
    monkeypatch.setattr(
        NotificacaoService,
        "_enviar_lote_push",
        staticmethod(
            lambda mensagens: chamadas_envio.append(mensagens)
            or [
                {
                    "status": "ok",
                    "id": (
                        "ticket-receipt-invalid"
                        if mensagem["to"] == token_invalido
                        else "ticket-receipt-delivered"
                    ),
                }
                for mensagem in mensagens
            ]
        ),
    )
    consultas = []

    def consultar(_ticket_ids):
        consultas.append(True)
        if len(consultas) == 1:
            return {}
        return {
            "ticket-receipt-invalid": {
                "status": "error",
                "message": "DeviceNotRegistered",
                "details": {"error": "DeviceNotRegistered"},
            },
            "ticket-receipt-delivered": {"status": "ok"},
        }

    monkeypatch.setattr(
        NotificacaoService, "_consultar_recibos", staticmethod(consultar)
    )

    assert processar_proxima() is True
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                UPDATE push_outbox_destinatarios
                SET receipt_check_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE)
                WHERE ticket_id IN (
                    'ticket-receipt-invalid', 'ticket-receipt-delivered'
                )
                """
            )
            cursor.execute(
                """
                UPDATE push_outbox
                SET disponivel_em = CURRENT_TIMESTAMP
                WHERE notificacao_id = ?
                """,
                (notificacao_id,),
            )
            connection.commit()
        finally:
            cursor.close()

    assert processar_proxima() is True
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT status FROM push_outbox_destinatarios
                WHERE ticket_id = 'ticket-receipt-delivered'
                """
            )
            assert cursor.fetchone()["status"] == "ticketed"
            cursor.execute(
                """
                UPDATE push_outbox_destinatarios
                SET receipt_check_at = DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 MINUTE)
                WHERE ticket_id IN (
                    'ticket-receipt-invalid', 'ticket-receipt-delivered'
                )
                """
            )
            cursor.execute(
                """
                UPDATE push_outbox
                SET disponivel_em = CURRENT_TIMESTAMP
                WHERE notificacao_id = ?
                """,
                (notificacao_id,),
            )
            connection.commit()
        finally:
            cursor.close()

    assert processar_proxima() is True
    assert len(chamadas_envio) == 1
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM expo_push_tokens WHERE token = ?",
                (token_invalido,),
            )
            assert cursor.fetchone()["total"] == 0
            cursor.execute(
                "SELECT COUNT(*) AS total FROM expo_push_tokens WHERE token = ?",
                (token_entregue,),
            )
            assert cursor.fetchone()["total"] == 1
            cursor.execute(
                """
                SELECT d.status
                FROM push_outbox_destinatarios d
                JOIN push_outbox o ON o.id = d.outbox_id
                WHERE o.notificacao_id = ?
                """,
                (notificacao_id,),
            )
            statuses = {row["status"] for row in cursor.fetchall()}
            assert statuses == {"provider_accepted", "failed"}
        finally:
            cursor.close()


def test_reprocessar_evento_failed_preserva_aceitos_e_nao_reativa_tokens_removidos(
    client, monkeypatch
):
    dados, _headers = criar_usuario_autenticado(
        client, "push-manual-retry@example.com"
    )
    usuario_id = dados["user"]["id"]
    token_retry = "ExpoPushToken[manual-retry]"
    token_accepted = "ExpoPushToken[manual-accepted]"
    token_removed = "ExpoPushToken[manual-removed]"
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "UPDATE usuarios SET notificacoes_ativas = 1 WHERE id = ?",
                (usuario_id,),
            )
            for token in (token_retry, token_accepted):
                cursor.execute(
                    """
                    INSERT INTO expo_push_tokens (usuario_id, token, plataforma)
                    VALUES (?, ?, 'android')
                    """,
                    (usuario_id, token),
                )
            connection.commit()
        finally:
            cursor.close()
    notificacao_id = NotificacaoModel.criar(
        usuario_id,
        None,
        "nova_despesa",
        "Evento para reprocessar",
        "Mensagem de teste",
    )
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT id FROM push_outbox WHERE notificacao_id = ?",
                (notificacao_id,),
            )
            outbox_id = cursor.fetchone()["id"]
            cursor.execute(
                """
                UPDATE push_outbox
                SET status = 'failed', tentativas = 8, ultimo_erro = 'erro final'
                WHERE id = ?
                """,
                (outbox_id,),
            )
            cursor.execute(
                """
                INSERT INTO push_outbox_destinatarios
                    (outbox_id, token, status, ultimo_erro)
                VALUES
                    (?, ?, 'failed', 'falha transitória'),
                    (?, ?, 'provider_accepted', NULL),
                    (?, ?, 'failed', 'DeviceNotRegistered')
                """,
                (
                    outbox_id,
                    token_retry,
                    outbox_id,
                    token_accepted,
                    outbox_id,
                    token_removed,
                ),
            )
            connection.commit()
        finally:
            cursor.close()

    assert PushOutboxModel.reprocessar_falhos(outbox_id) == 1
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                """
                SELECT d.token, d.status, o.status AS outbox_status, o.tentativas
                FROM push_outbox_destinatarios d
                JOIN push_outbox o ON o.id = d.outbox_id
                WHERE o.id = ?
                """,
                (outbox_id,),
            )
            rows = {row["token"]: row for row in cursor.fetchall()}
        finally:
            cursor.close()

    assert rows[token_retry]["status"] == "pending"
    assert rows[token_accepted]["status"] == "provider_accepted"
    assert rows[token_removed]["status"] == "failed"
    assert {row["outbox_status"] for row in rows.values()} == {"pending"}
    assert {row["tentativas"] for row in rows.values()} == {0}

    envios = []

    def enviar(mensagens):
        envios.extend(mensagem["to"] for mensagem in mensagens)
        return [{"status": "ok", "id": "manual-retry-ticket"}]

    monkeypatch.setattr(
        NotificacaoService, "_enviar_lote_push", staticmethod(enviar)
    )
    assert processar_proxima() is True
    assert envios == [token_retry]


def test_reprocessar_falhos_rejeita_id_que_nao_esta_failed(client):
    dados, _headers = criar_usuario_autenticado(
        client, "push-manual-retry-missing@example.com"
    )
    notificacao_id = NotificacaoModel.criar(
        dados["user"]["id"],
        None,
        "nova_despesa",
        "Evento pendente",
        "Mensagem de teste",
    )
    with get_connection_context() as connection:
        cursor = cursor_for(connection)
        try:
            cursor.execute(
                "SELECT id FROM push_outbox WHERE notificacao_id = ?",
                (notificacao_id,),
            )
            outbox_id = cursor.fetchone()["id"]
        finally:
            cursor.close()

    assert PushOutboxModel.reprocessar_falhos(outbox_id) == 0
