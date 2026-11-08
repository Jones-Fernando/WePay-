from flask import request
from services.lembrete_service import LembreteService
from utils.response_utils import ResponseUtils
from utils.validators import parse_pagination


class LembreteController:
    @staticmethod
    def listar(current_user_id):
        try:
            dias = int(request.args.get("dias", 3))
        except (ValueError, TypeError):
            return ResponseUtils.erro("Parametro 'dias' invalido.")
        if dias < 0 or dias > 365:
            return ResponseUtils.erro("Parametro 'dias' invalido.")
        try:
            limit, offset = parse_pagination(
                request.args.get("limit"), request.args.get("offset")
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        dados, paginacao = LembreteService.despesas_a_vencer(
            current_user_id, dias, limit, offset
        )
        return ResponseUtils.sucesso(
            dados=dados,
            paginacao=paginacao,
        )
