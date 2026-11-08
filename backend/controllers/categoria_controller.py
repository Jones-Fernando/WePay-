from flask import request
from mysql.connector import errorcode
from mysql.connector.errors import IntegrityError

from models.categoria_model import CategoriaModel
from utils.response_utils import ResponseUtils


class CategoriaController:
    @staticmethod
    def listar(current_user_id):
        tipo = request.args.get("tipo") or None
        if tipo and tipo not in {"pessoal", "grupo", "ambos"}:
            return ResponseUtils.erro("Tipo de categoria invalido.")
        return ResponseUtils.sucesso(dados=CategoriaModel.listar(current_user_id, tipo))

    @staticmethod
    def criar(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        nome_value = data.get("nome")
        tipo_value = data.get("tipo", "ambos")
        if not isinstance(nome_value, str) or not isinstance(tipo_value, str):
            return ResponseUtils.erro("Nome e tipo da categoria devem ser textos.")
        nome = nome_value.strip()
        tipo = tipo_value.strip().lower()
        if not nome:
            return ResponseUtils.erro("Nome da categoria eh obrigatorio.")
        if len(nome) > 100:
            return ResponseUtils.erro("Nome da categoria nao pode exceder 100 caracteres.")
        if tipo not in {"pessoal", "grupo", "ambos"}:
            return ResponseUtils.erro("Tipo de categoria invalido.")
        try:
            item_id = CategoriaModel.criar(current_user_id, nome, tipo)
        except IntegrityError as erro:
            if erro.errno != errorcode.ER_DUP_ENTRY:
                raise
            return ResponseUtils.erro("Categoria ja existe ou nao pode ser criada.", status=409)
        return ResponseUtils.sucesso(dados={"id": item_id}, mensagem="Categoria criada.", status=201)

    @staticmethod
    def atualizar(current_user_id, categoria_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        nome_value = data.get("nome")
        tipo_value = data.get("tipo", "ambos")
        if not isinstance(nome_value, str) or not isinstance(tipo_value, str):
            return ResponseUtils.erro("Nome e tipo da categoria devem ser textos.")
        nome = nome_value.strip()
        tipo = tipo_value.strip().lower()
        if not nome:
            return ResponseUtils.erro("Nome da categoria eh obrigatorio.")
        if len(nome) > 100:
            return ResponseUtils.erro("Nome da categoria nao pode exceder 100 caracteres.")
        if tipo not in {"pessoal", "grupo", "ambos"}:
            return ResponseUtils.erro("Tipo de categoria invalido.")
        if not CategoriaModel.atualizar(current_user_id, categoria_id, nome, tipo):
            return ResponseUtils.erro("Categoria nao encontrada.", status=404)
        return ResponseUtils.sucesso(mensagem="Categoria atualizada.")

    @staticmethod
    def deletar(current_user_id, categoria_id):
        if not CategoriaModel.deletar(current_user_id, categoria_id):
            return ResponseUtils.erro("Categoria nao encontrada.", status=404)
        return ResponseUtils.sucesso(mensagem="Categoria removida.")
