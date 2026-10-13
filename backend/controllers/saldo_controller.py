from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from services.financeiro_service import FinanceiroService
from utils.response_utils import ResponseUtils


class SaldoController:
    @staticmethod
    def ver_saldos(current_user_id, grupo_id):
        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)

        saldos = FinanceiroService.saldos_grupo(grupo_id)
        simplificadas = FinanceiroService.simplificar_saldos(saldos)
        return ResponseUtils.sucesso(
            dados={
                "grupo_id": grupo_id,
                "saldos": saldos,
                "dividas_simplificadas": simplificadas,
            }
        )
