import re

from flask import request

from models.notificacao_model import NotificacaoModel
from utils.response_utils import ResponseUtils

_TOKEN_EXPO_RE = re.compile(
    r"(?:Expo|Exponent)PushToken\[[A-Za-z0-9._-]{1,200}\]"
)


class NotificacaoController:
    @staticmethod
    def obter_preferencias(current_user_id):
        preferencias = NotificacaoModel.obter_preferencias(current_user_id)
        if preferencias is None:
            return ResponseUtils.erro("Usuario nao encontrado.", status=404)
        return ResponseUtils.sucesso(dados=preferencias)

    @staticmethod
    def atualizar_preferencias(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        notificacoes = data.get("notificacoes")
        sons = data.get("sons")
        if not isinstance(notificacoes, bool) or not isinstance(sons, bool):
            return ResponseUtils.erro(
                "As preferencias de notificacao devem ser booleanas."
            )
        if not NotificacaoModel.atualizar_preferencias(
            current_user_id, notificacoes, sons
        ):
            return ResponseUtils.erro("Usuario nao encontrado.", status=404)
        return ResponseUtils.sucesso(
            dados={"notificacoes": notificacoes, "sons": sons},
            mensagem="Preferencias atualizadas.",
        )

    @staticmethod
    def registrar_dispositivo(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        token = data.get("token")
        plataforma = data.get("plataforma")
        if (
            not isinstance(token, str)
            or len(token) > 255
            or _TOKEN_EXPO_RE.fullmatch(token) is None
        ):
            return ResponseUtils.erro("Token de notificacao invalido.")
        if plataforma not in {"ios", "android"}:
            return ResponseUtils.erro("Plataforma de notificacao invalida.")
        NotificacaoModel.registrar_push_token(
            current_user_id, token, plataforma
        )
        return ResponseUtils.sucesso(mensagem="Dispositivo registrado.")

    @staticmethod
    def remover_dispositivo(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        token = data.get("token")
        if (
            not isinstance(token, str)
            or len(token) > 255
            or _TOKEN_EXPO_RE.fullmatch(token) is None
        ):
            return ResponseUtils.erro("Token de notificacao invalido.")
        NotificacaoModel.remover_push_token(current_user_id, token)
        return ResponseUtils.sucesso(mensagem="Dispositivo removido.")

    @staticmethod
    def listar(current_user_id):
        somente_nao_lidas = request.args.get("nao_lidas", "false").lower() == "true"
        return ResponseUtils.sucesso(
            dados=NotificacaoModel.listar(current_user_id, somente_nao_lidas)
        )

    @staticmethod
    def marcar_lida(current_user_id, notificacao_id):
        if not NotificacaoModel.marcar_lida(current_user_id, notificacao_id):
            return ResponseUtils.erro("Notificacao nao encontrada.", status=404)
        return ResponseUtils.sucesso(mensagem="Notificacao marcada como lida.")
