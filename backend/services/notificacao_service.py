import json
from http.client import HTTPSConnection

from config import Config
from models.notificacao_model import NotificacaoModel

_EXPO_HOST = "exp.host"
_EXPO_PUSH_PATH = "/--/api/v2/push/send"
_EXPO_RECEIPTS_PATH = "/--/api/v2/push/getReceipts"


class NotificacaoService:
    @staticmethod
    def _post_expo_json(path, payload, headers):
        if path not in {_EXPO_PUSH_PATH, _EXPO_RECEIPTS_PATH}:
            raise ValueError("Endpoint Expo invalido.")
        connection = HTTPSConnection(_EXPO_HOST, timeout=5)
        try:
            connection.request(
                "POST",
                path,
                body=json.dumps(payload).encode("utf-8"),
                headers=headers,
            )
            response = connection.getresponse()
            body = response.read()
            if not 200 <= response.status < 300:
                raise RuntimeError(
                    f"Expo Push Service retornou HTTP {response.status}."
                )
        finally:
            connection.close()
        return json.loads(body.decode("utf-8"))

    @staticmethod
    def notificar_nova_despesa(grupo_id, autor_id, descricao, valor, conn):
        from database.connection import cursor_for, fetch_all

        cursor = cursor_for(conn)
        try:
            cursor.execute(
                """
                SELECT p.usuario_id, g.nome AS grupo_nome
                FROM participantes p
                JOIN usuarios u ON u.id = p.usuario_id
                JOIN grupos g ON g.id = p.grupo_id
                WHERE p.grupo_id = ?
                  AND p.ativo = 1
                  AND p.usuario_id <> ?
                  AND u.excluido_em IS NULL
                """,
                (grupo_id, autor_id),
            )
            usuarios = fetch_all(cursor)
        finally:
            cursor.close()

        for row in usuarios:
            NotificacaoModel.criar(
                row["usuario_id"],
                grupo_id,
                "nova_despesa",
                "Nova despesa no grupo",
                f"A despesa '{descricao}' de R$ {valor:.2f} foi adicionada ao grupo.",
                conn=conn,
            )
        return usuarios

    @staticmethod
    def montar_mensagem_push(notificacao, dispositivo):
        return {
            "to": dispositivo["token"],
            "title": notificacao["titulo"],
            "body": "Acesse o WePay para ver os detalhes.",
            "sound": (
                "default" if dispositivo["sons_notificacoes_ativos"] else None
            ),
            "channelId": (
                "default" if dispositivo["sons_notificacoes_ativos"] else "silent"
            ),
            "data": {
                "tipo": notificacao["tipo"],
                "groupId": str(notificacao["grupo_id"]),
                "grupoNome": notificacao["grupo_nome"] or "",
            },
        }

    @staticmethod
    def _enviar_lote_push(mensagens):
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if Config.EXPO_ACCESS_TOKEN:
            headers["Authorization"] = f"Bearer {Config.EXPO_ACCESS_TOKEN}"
        resultado = NotificacaoService._post_expo_json(
            _EXPO_PUSH_PATH, mensagens, headers
        )
        if resultado.get("errors"):
            raise RuntimeError("Expo Push Service rejeitou a notificacao.")
        tickets = resultado.get("data")
        if (
            not isinstance(tickets, list)
            or len(tickets) != len(mensagens)
            or any(not isinstance(ticket, dict) for ticket in tickets)
        ):
            raise RuntimeError(
                "Expo Push Service retornou tickets inválidos."
            )
        return tickets

    @staticmethod
    def _consultar_recibos(ticket_ids):
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if Config.EXPO_ACCESS_TOKEN:
            headers["Authorization"] = f"******"
        resultado = NotificacaoService._post_expo_json(
            _EXPO_RECEIPTS_PATH, {"ids": ticket_ids}, headers
        )
        if resultado.get("errors"):
            raise RuntimeError("Expo Push Service rejeitou a consulta de recibos.")
        recibos = resultado.get("data")
        if not isinstance(recibos, dict) or any(
            not isinstance(recibo, dict) for recibo in recibos.values()
        ):
            raise RuntimeError("Expo Push Service retornou recibos inválidos.")
        return recibos
