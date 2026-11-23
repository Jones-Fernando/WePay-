import json
from http.client import HTTPSConnection

from config import Config
from models.notificacao_model import NotificacaoModel

_EXPO_HOST = "exp.host"
_EXPO_PUSH_PATH = "/--/api/v2/push/send"
_EXPO_RECEIPTS_PATH = "/--/api/v2/push/getReceipts"


class ErroCobranca(Exception):
    def __init__(self, mensagem, status):
        super().__init__(mensagem)
        self.status = status


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
    def notificar_nova_despesa(
        grupo_id,
        autor_id,
        descricao,
        valor,
        conn,
        referencia_id=None,
    ):
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
                  AND u.notificacoes_despesas_ativas = 1
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
                referencia_id=referencia_id,
            )
        return usuarios

    @staticmethod
    def cobrar_saldo(grupo_id, credor_id, devedor_id):
        from database.connection import (
            cursor_for,
            fetch_all,
            fetch_one,
            get_connection_context,
        )
        from services.financeiro_service import FinanceiroService
        from services.financeiro_saldo_service import FinanceiroSaldoService

        if int(credor_id) == int(devedor_id):
            raise ErroCobranca("Nao e possivel cobrar a propria conta.", 400)

        with get_connection_context() as conn:
            try:
                try:
                    FinanceiroService.lock_group(conn, grupo_id)
                except LookupError as erro:
                    raise ErroCobranca("Grupo nao encontrado.", 404) from erro

                cursor = cursor_for(conn)
                try:
                    cursor.execute(
                        """
                        SELECT p.usuario_id,
                               CASE WHEN u.excluido_em IS NULL THEN u.nome
                                    ELSE 'Usuario excluido' END AS nome,
                               u.notificacoes_cobrancas_ativas,
                               g.nome AS grupo_nome
                        FROM participantes p
                        JOIN usuarios u ON u.id = p.usuario_id
                        JOIN grupos g ON g.id = p.grupo_id
                        WHERE p.grupo_id = ?
                        FOR UPDATE
                        """,
                        (grupo_id,),
                    )
                    participantes = fetch_all(cursor)
                    por_usuario = {
                        int(row["usuario_id"]): row for row in participantes
                    }
                    cursor.execute(
                        "SELECT usuario_id FROM participantes "
                        "WHERE grupo_id = ? AND usuario_id = ? AND ativo = 1",
                        (grupo_id, credor_id),
                    )
                    if fetch_one(cursor) is None:
                        raise ErroCobranca(
                            "Voce precisa ser participante ativo deste grupo.",
                            403,
                        )

                    cursor.execute(
                        """
                        SELECT p.usuario_id
                        FROM participantes p
                        JOIN usuarios u ON u.id = p.usuario_id
                        WHERE p.grupo_id = ? AND p.usuario_id = ?
                          AND p.ativo = 1 AND u.excluido_em IS NULL
                        """,
                        (grupo_id, devedor_id),
                    )
                    if fetch_one(cursor) is None:
                        raise ErroCobranca(
                            "O devedor nao e um participante ativo do grupo.",
                            404,
                        )

                    devedor = por_usuario[int(devedor_id)]
                    if not devedor["notificacoes_cobrancas_ativas"]:
                        raise ErroCobranca(
                            "Esse participante desativou os lembretes de cobranca.",
                            409,
                        )

                    saldos_esperados = (
                        FinanceiroSaldoService.calcular_saldos_esperados(
                            conn, grupo_id
                        )
                    )
                    saldos = [
                        {
                            "usuario_id": int(row["usuario_id"]),
                            "nome": row["nome"],
                            "saldo": saldos_esperados.get(
                                int(row["usuario_id"]), 0
                            ),
                        }
                        for row in participantes
                    ]
                    dividas = FinanceiroService.simplificar_saldos(saldos)
                    divida = next(
                        (
                            item
                            for item in dividas
                            if int(item["credor_id"]) == int(credor_id)
                            and int(item["devedor_id"]) == int(devedor_id)
                        ),
                        None,
                    )
                    if divida is None or divida["valor"] <= 0:
                        raise ErroCobranca(
                            "Nao existe saldo pendente entre voce e esse participante.",
                            409,
                        )

                    cursor.execute(
                        """
                        SELECT COUNT(*) AS total
                        FROM notificacoes
                        WHERE usuario_id = ? AND grupo_id = ?
                          AND tipo = 'cobranca'
                          AND criado_em >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 24 HOUR)
                        """,
                        (devedor_id, grupo_id),
                    )
                    if int(fetch_one(cursor)["total"]) > 0:
                        raise ErroCobranca(
                            "Ja foi enviado um lembrete para esse participante nas ultimas 24 horas.",
                            429,
                        )

                    credor = por_usuario[int(credor_id)]
                    valor = divida["valor"]
                    valor_formatado = f"{valor:.2f}".replace(".", ",")
                    notificacao_id = NotificacaoModel.criar(
                        devedor_id,
                        grupo_id,
                        "cobranca",
                        "Lembrete de pagamento",
                        (
                            f"{credor['nome']} enviou um lembrete de "
                            f"R$ {valor_formatado} no grupo "
                            f"{devedor['grupo_nome']}."
                        ),
                        conn=conn,
                    )
                finally:
                    cursor.close()
                conn.commit()
                return notificacao_id, valor
            except Exception:
                conn.rollback()
                raise

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
                **(
                    {"referenciaId": str(notificacao["referencia_id"])}
                    if notificacao.get("referencia_id") is not None
                    else {}
                ),
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
            headers["Authorization"] = f"Bearer {Config.EXPO_ACCESS_TOKEN}"
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
