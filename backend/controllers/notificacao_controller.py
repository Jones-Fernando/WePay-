from flask import request

from models.notificacao_model import NotificacaoModel
from utils.response_utils import ResponseUtils


class NotificacaoController:
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
