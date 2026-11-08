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
    class Resposta:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return b'{"data":[{"status":"ok"}]}'

    capturado = {}

    def fake_urlopen(request, timeout):
        capturado["url"] = request.full_url
        capturado["payload"] = json.loads(request.data)
        capturado["timeout"] = timeout
        return Resposta()

    monkeypatch.setattr(
        "services.notificacao_service.urlopen",
        fake_urlopen,
    )
    monkeypatch.setattr(
        "services.notificacao_service.Config.EXPO_ACCESS_TOKEN",
        "expo-test-access",
    )

    NotificacaoService._enviar_lote_push(
        [{"to": "ExpoPushToken[device]", "title": "Teste"}]
    )

    assert capturado["url"] == "https://exp.host/--/api/v2/push/send"
    assert capturado["payload"][0]["title"] == "Teste"
    assert capturado["timeout"] == 5


def test_push_rejeita_ticket_com_falha_do_expo(monkeypatch):
    class RespostaComTicketFalho:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self):
            return b'{"data":[{"status":"error","message":"DeviceNotRegistered"}]}'

    monkeypatch.setattr(
        "services.notificacao_service.urlopen",
        lambda *_args, **_kwargs: RespostaComTicketFalho(),
    )
    with pytest.raises(RuntimeError, match="falha em um ou mais dispositivos"):
        NotificacaoService._enviar_lote_push(
            [{"to": "ExpoPushToken[device]", "title": "Teste"}]
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


def test_modelo_notificacao_devolve_none_para_usuario_ausente():
    assert NotificacaoModel.obter_preferencias(999999) is None
    assert NotificacaoModel.atualizar_preferencias(999999, True, False) is False
    assert NotificacaoModel.remover_push_token(999999, "missing-token") is False
    assert NotificacaoModel.listar_tokens_push([]) == []


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
        staticmethod(lambda mensagens: lotes.append(mensagens)),
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
