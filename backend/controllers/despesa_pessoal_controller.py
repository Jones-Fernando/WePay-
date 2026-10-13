from datetime import date, timedelta
from flask import request

from models.despesa_pessoal_model import DespesaPessoalModel
from utils.response_utils import ResponseUtils
from utils.validators import parse_money, parse_iso_date


class DespesaPessoalController:
    @staticmethod
    def criar(current_user_id):
        data = request.get_json(silent=True) or {}
        descricao = (data.get("descricao") or "").strip()
        categoria = (data.get("categoria") or "").strip() or None
        tipo = (data.get("tipo") or "despesa").strip().lower()
        if tipo not in {"despesa", "receita"}:
            return ResponseUtils.erro("Tipo deve ser despesa ou receita.")
        if not descricao:
            return ResponseUtils.erro("Descricao eh obrigatoria.")
        try:
            valor = parse_money(data.get("valor"))
            data_despesa = parse_iso_date(
                data.get("data_despesa") or data.get("data"),
                "data_despesa",
            ) or date.today().isoformat()
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))

        item_id = DespesaPessoalModel.criar(
            current_user_id,
            descricao,
            valor,
            categoria,
            tipo,
            data_despesa,
        )
        return ResponseUtils.sucesso(
            dados={"id": item_id},
            mensagem="Transacao pessoal registrada.",
            status=201,
        )

    @staticmethod
    def listar(current_user_id):
        categoria = request.args.get("categoria") or None
        tipo = request.args.get("tipo") or None
        data_inicio = request.args.get("data_inicio") or None
        data_fim = request.args.get("data_fim") or None
        try:
            data_inicio = parse_iso_date(data_inicio, "data_inicio")
            data_fim = parse_iso_date(data_fim, "data_fim")
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))
        if tipo and tipo not in {"despesa", "receita"}:
            return ResponseUtils.erro("Tipo invalido.")
        return ResponseUtils.sucesso(
            dados=DespesaPessoalModel.listar_por_usuario(
                current_user_id, categoria, tipo, data_inicio, data_fim
            )
        )

    @staticmethod
    def detalhes(current_user_id, despesa_id):
        item = DespesaPessoalModel.buscar_por_id(despesa_id)
        if not item:
            return ResponseUtils.erro("Transacao pessoal nao encontrada.", status=404)
        if int(item["usuario_id"]) != int(current_user_id):
            return ResponseUtils.erro("Voce nao pode acessar essa transacao.", status=403)
        return ResponseUtils.sucesso(dados=item)

    @staticmethod
    def atualizar(current_user_id, despesa_id):
        item = DespesaPessoalModel.buscar_por_id(despesa_id)
        if not item:
            return ResponseUtils.erro("Transacao pessoal nao encontrada.", status=404)
        if int(item["usuario_id"]) != int(current_user_id):
            return ResponseUtils.erro("Voce nao pode editar essa transacao.", status=403)

        data = request.get_json(silent=True) or {}
        descricao = (data.get("descricao") or "").strip()
        categoria = (data.get("categoria") if "categoria" in data else item.get("categoria")) or None
        tipo = (data.get("tipo") if "tipo" in data else item.get("tipo", "despesa")) or "despesa"
        if tipo not in {"despesa", "receita"}:
            return ResponseUtils.erro("Tipo invalido.")
        if not descricao:
            return ResponseUtils.erro("Descricao eh obrigatoria.")
        try:
            valor = parse_money(data.get("valor"))
            data_despesa = parse_iso_date(
                data.get("data_despesa") or data.get("data") or item.get("data_despesa"),
                "data_despesa",
            )
        except ValueError as exc:
            return ResponseUtils.erro(str(exc))

        DespesaPessoalModel.atualizar(
            despesa_id, descricao, valor, categoria, tipo, data_despesa
        )
        return ResponseUtils.sucesso(mensagem="Transacao pessoal atualizada.")

    @staticmethod
    def deletar(current_user_id, despesa_id):
        item = DespesaPessoalModel.buscar_por_id(despesa_id)
        if not item:
            return ResponseUtils.erro("Transacao pessoal nao encontrada.", status=404)
        if int(item["usuario_id"]) != int(current_user_id):
            return ResponseUtils.erro("Voce nao pode excluir essa transacao.", status=403)
        DespesaPessoalModel.deletar(despesa_id)
        return ResponseUtils.sucesso(mensagem="Transacao pessoal deletada.")

    @staticmethod
    def total_mes(current_user_id):
        try:
            ano = int(request.args.get("ano", date.today().year))
            mes = int(request.args.get("mes", date.today().month))
            if mes < 1 or mes > 12:
                raise ValueError
        except ValueError:
            return ResponseUtils.erro("Ano ou mes invalido.")

        inicio = date(ano, mes, 1)
        if mes == 12:
            fim = date(ano + 1, 1, 1) - timedelta(days=1)
        else:
            fim = date(ano, mes + 1, 1) - timedelta(days=1)

        resumo = DespesaPessoalModel.resumo_periodo(
            current_user_id,
            inicio.isoformat(),
            fim.isoformat(),
        )
        resumo.update({"ano": ano, "mes": mes})
        return ResponseUtils.sucesso(dados=resumo)
