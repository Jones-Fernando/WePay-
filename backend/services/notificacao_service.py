import json
from urllib.request import Request, urlopen

from config import Config
from models.notificacao_model import NotificacaoModel

_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class NotificacaoService:
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
        request = Request(
            _EXPO_PUSH_URL,
            data=json.dumps(mensagens).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urlopen(request, timeout=5) as response:
            resultado = json.loads(response.read().decode("utf-8"))
        if resultado.get("errors"):
            raise RuntimeError("Expo Push Service rejeitou a notificacao.")
        tickets = resultado.get("data")
        if (
            not isinstance(tickets, list)
            or len(tickets) != len(mensagens)
            or any(
                not isinstance(ticket, dict) or ticket.get("status") != "ok"
                for ticket in tickets
            )
        ):
            raise RuntimeError(
                "Expo Push Service retornou falha em um ou mais dispositivos."
            )
