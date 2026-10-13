from flask import request
from services.lembrete_service import LembreteService
from utils.response_utils import ResponseUtils


class LembreteController:
    @staticmethod
    def listar(current_user_id):
        try:
            dias = int(request.args.get("dias", 3))
        except (ValueError, TypeError):
            return ResponseUtils.erro("Parametro 'dias' invalido.")
        if dias < 0 or dias > 365:
            return ResponseUtils.erro("Parametro 'dias' invalido.")
        return ResponseUtils.sucesso(
            dados=LembreteService.despesas_a_vencer(current_user_id, dias)
        )
