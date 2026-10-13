from datetime import date
from flask import request

from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from services.financeiro_service import FinanceiroService
from utils.response_utils import ResponseUtils
from utils.validators import parse_money, parse_iso_date


class PagamentoController:
    @staticmethod
    def criar(current_user_id):
        data = request.get_json(silent=True) or {}
        grupo_id = data.get("grupo_id")
        recebedor_id = data.get("recebedor_id")
        if not grupo_id or not recebedor_id:
            return ResponseUtils.erro("grupo_id e recebedor_id sao obrigatorios.")
        if not GrupoModel.buscar_por_id(grupo_id):
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        if not ParticipanteModel.buscar(grupo_id, int(recebedor_id)):
            return ResponseUtils.erro("Recebedor nao participa deste grupo.", status=400)

        try:
            valor = parse_money(data.get("valor"))
            data_pagamento = parse_iso_date(data.get("data_pagamento"), "data_pagamento") or date.today().isoformat()
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))

        try:
            pagamento_id = FinanceiroService.registrar_pagamento(
                grupo_id=grupo_id,
                pagador_id=current_user_id,
                recebedor_id=int(recebedor_id),
                valor=valor,
                data_pagamento=data_pagamento,
                metodo=(data.get("metodo") or "").strip() or None,
                observacao=(data.get("observacao") or "").strip() or None,
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc), status=400)
        except Exception:
            return ResponseUtils.erro("Nao foi possivel registrar o pagamento.", status=500)

        return ResponseUtils.sucesso(
            dados={"id": pagamento_id},
            mensagem="Pagamento registrado e saldos recalculados.",
            status=201,
        )

    @staticmethod
    def listar(current_user_id, grupo_id):
        if not GrupoModel.buscar_por_id(grupo_id):
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        return ResponseUtils.sucesso(dados=FinanceiroService.listar_pagamentos(grupo_id))
