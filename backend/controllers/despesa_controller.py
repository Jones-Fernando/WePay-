from flask import request

from database.connection import get_connection_context, cursor_for, fetch_one
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from models.despesa_model import DespesaModel
from services.financeiro_service import FinanceiroService, money
from utils.response_utils import ResponseUtils
from utils.validators import parse_money, parse_iso_date


class DespesaController:
    @staticmethod
    def _dados_divisao(data):
        return (
            data.get("divisao_tipo", "igual"),
            data.get("participantes", []),
            data.get("percentuais"),
            data.get("valores"),
        )

    @staticmethod
    def criar(current_user_id):
        data = request.get_json(silent=True) or {}
        grupo_id = data.get("grupo_id")
        descricao = (data.get("descricao") or "").strip()
        categoria = (data.get("categoria") or "").strip() or None
        pagador_id = int(data.get("pagador_id") or current_user_id)

        if not grupo_id:
            return ResponseUtils.erro("grupo_id eh obrigatorio.")
        if not descricao:
            return ResponseUtils.erro("Descricao eh obrigatoria.")

        try:
            valor = parse_money(data.get("valor"))
            data_despesa = parse_iso_date(data.get("data_despesa") or data.get("data"), "data_despesa")
            vencimento = parse_iso_date(data.get("vencimento"), "vencimento")
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))

        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        if not ParticipanteModel.buscar(grupo_id, pagador_id):
            return ResponseUtils.erro("Pagador deve ser participante ativo do grupo.", status=400)

        divisao_tipo, participantes, percentuais, valores = DespesaController._dados_divisao(data)
        if not participantes:
            participantes = [
                row["usuario_id"]
                for row in ParticipanteModel.listar_por_grupo(grupo_id)
            ]

        try:
            despesa_id = FinanceiroService.criar_despesa(
                grupo_id=grupo_id,
                pagador_id=pagador_id,
                descricao=descricao,
                valor=valor,
                categoria=categoria,
                data_despesa=data_despesa,
                vencimento=vencimento,
                divisao_tipo=divisao_tipo,
                participantes=participantes,
                percentuais=percentuais,
                valores=valores,
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        except Exception:
            return ResponseUtils.erro("Nao foi possivel registrar a despesa.", status=500)

        return ResponseUtils.sucesso(
            dados={"id": despesa_id},
            mensagem="Despesa registrada e dividida.",
            status=201,
        )

    @staticmethod
    def listar(current_user_id, grupo_id):
        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        return ResponseUtils.sucesso(dados=DespesaModel.listar_por_grupo(grupo_id))

    @staticmethod
    def detalhes(current_user_id, despesa_id):
        despesa = DespesaModel.buscar_por_id(despesa_id)
        if not despesa:
            return ResponseUtils.erro("Despesa nao encontrada.", status=404)
        if not ParticipanteModel.buscar(despesa["grupo_id"], current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        return ResponseUtils.sucesso(dados=despesa)

    @staticmethod
    def atualizar(current_user_id, despesa_id):
        data = request.get_json(silent=True) or {}
        descricao = (data.get("descricao") or "").strip()
        categoria = (data.get("categoria") or "").strip() or None
        if not descricao:
            return ResponseUtils.erro("Descricao eh obrigatoria.")

        despesa = DespesaModel.buscar_por_id(despesa_id)
        if not despesa:
            return ResponseUtils.erro("Despesa nao encontrada.", status=404)
        grupo_id = despesa["grupo_id"]
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)

        pagador_id = int(data.get("pagador_id") or despesa["pagador_id"])
        if not ParticipanteModel.buscar(grupo_id, pagador_id):
            return ResponseUtils.erro("Pagador deve ser participante ativo do grupo.", status=400)

        try:
            valor = parse_money(data.get("valor"))
            data_despesa = parse_iso_date(
                data.get("data_despesa") or data.get("data") or despesa.get("data_despesa"),
                "data_despesa",
            )
            vencimento = parse_iso_date(data.get("vencimento"), "vencimento")
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))

        divisao_tipo, participantes, percentuais, valores = DespesaController._dados_divisao(data)
        if not participantes:
            participantes = [row["usuario_id"] for row in despesa.get("divisoes", [])]
        if not participantes:
            participantes = [row["usuario_id"] for row in ParticipanteModel.listar_por_grupo(grupo_id)]

        try:
            FinanceiroService.atualizar_despesa(
                despesa_id=despesa_id,
                descricao=descricao,
                valor=valor,
                pagador_id=pagador_id,
                categoria=categoria,
                data_despesa=data_despesa,
                vencimento=vencimento,
                divisao_tipo=divisao_tipo,
                participantes=participantes,
                percentuais=percentuais,
                valores=valores,
            )
        except LookupError as exc:
            return ResponseUtils.erro(str(exc), status=404)
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        except Exception:
            return ResponseUtils.erro("Nao foi possivel atualizar a despesa.", status=500)

        return ResponseUtils.sucesso(mensagem="Despesa atualizada e saldos recalculados.")

    @staticmethod
    def deletar(current_user_id, despesa_id):
        despesa = DespesaModel.buscar_por_id(despesa_id)
        if not despesa:
            return ResponseUtils.erro("Despesa nao encontrada.", status=404)
        if not ParticipanteModel.buscar(despesa["grupo_id"], current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)

        try:
            FinanceiroService.deletar_despesa(despesa_id)
        except LookupError as exc:
            return ResponseUtils.erro(str(exc), status=404)
        except Exception:
            return ResponseUtils.erro("Nao foi possivel excluir a despesa.", status=500)

        return ResponseUtils.sucesso(mensagem="Despesa deletada e saldos recalculados.")
