from datetime import date
from flask import current_app, request

from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from services.financeiro_service import FinanceiroService
from utils.response_utils import ResponseUtils
from utils.validators import (
    parse_money,
    parse_iso_date,
    parse_pagination,
    parse_positive_int,
)


class PagamentoController:
    @staticmethod
    def criar(current_user_id):
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        try:
            grupo_id = parse_positive_int(data.get("grupo_id"), "grupo_id")
            recebedor_id = parse_positive_int(
                data.get("recebedor_id"), "recebedor_id"
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        if not GrupoModel.buscar_por_id(grupo_id):
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        if not ParticipanteModel.buscar(grupo_id, recebedor_id):
            return ResponseUtils.erro("Recebedor nao participa deste grupo.", status=400)

        try:
            valor = parse_money(data.get("valor"))
            data_pagamento = parse_iso_date(data.get("data_pagamento"), "data_pagamento") or date.today().isoformat()
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))

        metodo_value = data.get("metodo")
        observacao_value = data.get("observacao")
        if metodo_value is not None and not isinstance(metodo_value, str):
            return ResponseUtils.erro("Metodo deve ser um texto.")
        if observacao_value is not None and not isinstance(observacao_value, str):
            return ResponseUtils.erro("Observacao deve ser um texto.")
        metodo = metodo_value.strip() or None if metodo_value else None
        observacao = observacao_value.strip() or None if observacao_value else None
        if metodo is not None and len(metodo) > 50:
            return ResponseUtils.erro("Metodo nao pode exceder 50 caracteres.")
        if observacao is not None and len(observacao) > 500:
            return ResponseUtils.erro("Observacao nao pode exceder 500 caracteres.")

        try:
            pagamento_id = FinanceiroService.registrar_pagamento(
                grupo_id=grupo_id,
                pagador_id=current_user_id,
                recebedor_id=recebedor_id,
                valor=valor,
                data_pagamento=data_pagamento,
                metodo=metodo,
                observacao=observacao,
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc), status=400)
        except Exception:
            current_app.logger.exception(
                "Falha ao registrar pagamento (grupo_id=%s, usuario_id=%s).",
                grupo_id,
                current_user_id,
            )
            return ResponseUtils.erro("Nao foi possivel registrar o pagamento.", status=500)

        return ResponseUtils.sucesso(
            dados={"id": pagamento_id},
            mensagem="Pagamento registrado e saldos atualizados.",
            status=201,
        )

    @staticmethod
    def listar(current_user_id, grupo_id):
        try:
            limit, offset = parse_pagination(
                request.args.get("limit"), request.args.get("offset")
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        if not GrupoModel.buscar_por_id(grupo_id):
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        dados, paginacao = FinanceiroService.listar_pagamentos(
            grupo_id, limit, offset
        )
        return ResponseUtils.sucesso(dados=dados, paginacao=paginacao)
