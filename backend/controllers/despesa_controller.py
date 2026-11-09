from datetime import date

from flask import current_app, request

from database.connection import get_connection_context, cursor_for, fetch_one
from models.grupo_model import GrupoModel
from models.participante_model import ParticipanteModel
from models.despesa_model import DespesaModel
from services.financeiro_service import FinanceiroService, money
from utils.response_utils import ResponseUtils
from utils.validators import (
    parse_money,
    parse_iso_date,
    parse_pagination,
    parse_positive_int,
)


class DespesaController:
    @staticmethod
    def _dados_divisao(data):
        tipo = data.get("divisao_tipo", "igual")
        participantes = data.get("participantes", [])
        percentuais = data.get("percentuais")
        valores = data.get("valores")
        if not isinstance(tipo, str) or tipo not in {
            "igual",
            "porcentagem",
            "valores",
        }:
            raise ValueError("Tipo de divisao invalido.")
        if not isinstance(participantes, list):
            raise ValueError("Participantes deve ser uma lista de IDs.")
        participantes = [
            parse_positive_int(item, "participante")
            for item in participantes
        ]
        if percentuais is not None and not isinstance(percentuais, dict):
            raise ValueError("Informe os percentuais.")
        if valores is not None and not isinstance(valores, dict):
            raise ValueError("Informe os valores individuais.")
        return (
            tipo,
            participantes,
            percentuais,
            valores,
        )

    @staticmethod
    def criar(current_user_id):
        data = request.get_json(silent=True) or {}
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        descricao_value = data.get("descricao")
        categoria_value = data.get("categoria")
        if not isinstance(descricao_value, str):
            return ResponseUtils.erro("Descricao eh obrigatoria.")
        if categoria_value is not None and not isinstance(categoria_value, str):
            return ResponseUtils.erro("Categoria deve ser um texto.")
        descricao = descricao_value.strip()
        categoria = categoria_value.strip() or None if categoria_value else None
        if categoria is not None and len(categoria) > 100:
            return ResponseUtils.erro("Categoria nao pode exceder 100 caracteres.")
        observacao = data.get("observacao")

        try:
            grupo_id = parse_positive_int(data.get("grupo_id"), "grupo_id")
            pagador_id = parse_positive_int(
                data.get("pagador_id", current_user_id), "pagador_id"
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        if not descricao:
            return ResponseUtils.erro("Descricao eh obrigatoria.")
        if observacao is not None and not isinstance(observacao, str):
            return ResponseUtils.erro("Observacao deve ser um texto.")
        observacao = observacao.strip() if observacao else None
        if observacao and len(observacao) > 500:
            return ResponseUtils.erro(
                "Observacao nao pode exceder 500 caracteres."
            )

        try:
            valor = parse_money(data.get("valor"))
            data_despesa = parse_iso_date(data.get("data_despesa") or data.get("data"), "data_despesa")
            if data_despesa and date.fromisoformat(data_despesa) > date.today():
                raise ValueError("Data da despesa nao pode ser futura.")
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

        try:
            divisao_tipo, participantes, percentuais, valores = (
                DespesaController._dados_divisao(data)
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
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
                observacao=observacao,
                criador_id=current_user_id,
            )
        except PermissionError as exc:
            return ResponseUtils.erro(str(exc), status=403)
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        except Exception:
            current_app.logger.exception(
                "Falha ao criar despesa (grupo_id=%s, usuario_id=%s).",
                grupo_id,
                current_user_id,
            )
            return ResponseUtils.erro("Nao foi possivel registrar a despesa.", status=500)

        return ResponseUtils.sucesso(
            dados={"id": despesa_id},
            mensagem="Despesa registrada e dividida.",
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
        grupo = GrupoModel.buscar_por_id(grupo_id)
        if not grupo:
            return ResponseUtils.erro("Grupo nao encontrado.", status=404)
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)
        dados, paginacao = DespesaModel.listar_por_grupo(
            grupo_id, limit, offset
        )
        return ResponseUtils.sucesso(dados=dados, paginacao=paginacao)

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
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        descricao_value = data.get("descricao")
        categoria_value = data.get("categoria")
        if not isinstance(descricao_value, str):
            return ResponseUtils.erro("Descricao eh obrigatoria.")
        if categoria_value is not None and not isinstance(categoria_value, str):
            return ResponseUtils.erro("Categoria deve ser um texto.")
        descricao = descricao_value.strip()
        categoria = categoria_value.strip() or None if categoria_value else None
        if categoria is not None and len(categoria) > 100:
            return ResponseUtils.erro("Categoria nao pode exceder 100 caracteres.")
        observacao = data.get("observacao")
        if not descricao:
            return ResponseUtils.erro("Descricao eh obrigatoria.")
        if "observacao" in data and observacao is not None:
            if not isinstance(observacao, str):
                return ResponseUtils.erro("Observacao deve ser um texto.")
            observacao = observacao.strip() or None
            if observacao is not None and len(observacao) > 500:
                return ResponseUtils.erro(
                    "Observacao nao pode exceder 500 caracteres."
                )

        despesa = DespesaModel.buscar_por_id(despesa_id)
        if not despesa:
            return ResponseUtils.erro("Despesa nao encontrada.", status=404)
        grupo_id = despesa["grupo_id"]
        if not ParticipanteModel.buscar(grupo_id, current_user_id):
            return ResponseUtils.erro("Voce nao participa deste grupo.", status=403)

        try:
            pagador_id = parse_positive_int(
                data.get("pagador_id", despesa["pagador_id"]), "pagador_id"
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        if not ParticipanteModel.buscar(grupo_id, pagador_id):
            return ResponseUtils.erro("Pagador deve ser participante ativo do grupo.", status=400)

        try:
            valor = parse_money(data.get("valor"))
            data_despesa = parse_iso_date(
                data.get("data_despesa") or data.get("data") or despesa.get("data_despesa"),
                "data_despesa",
            )
            if data_despesa and date.fromisoformat(data_despesa) > date.today():
                raise ValueError("Data da despesa nao pode ser futura.")
            vencimento = parse_iso_date(data.get("vencimento"), "vencimento")
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))

        try:
            divisao_tipo, participantes, percentuais, valores = (
                DespesaController._dados_divisao(data)
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
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
                **({"observacao": observacao} if "observacao" in data else {}),
                ator_id=current_user_id,
            )
        except PermissionError as exc:
            return ResponseUtils.erro(str(exc), status=403)
        except LookupError as exc:
            return ResponseUtils.erro(str(exc), status=404)
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        except Exception:
            current_app.logger.exception(
                "Falha ao atualizar despesa (despesa_id=%s, usuario_id=%s).",
                despesa_id,
                current_user_id,
            )
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
            FinanceiroService.deletar_despesa(despesa_id, current_user_id)
        except PermissionError as exc:
            return ResponseUtils.erro(str(exc), status=403)
        except LookupError as exc:
            return ResponseUtils.erro(str(exc), status=404)
        except Exception:
            current_app.logger.exception(
                "Falha ao excluir despesa (despesa_id=%s, usuario_id=%s).",
                despesa_id,
                current_user_id,
            )
            return ResponseUtils.erro("Nao foi possivel excluir a despesa.", status=500)

        return ResponseUtils.sucesso(mensagem="Despesa deletada e saldos recalculados.")
