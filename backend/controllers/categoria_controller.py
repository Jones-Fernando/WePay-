from flask import request
from mysql.connector import errorcode
from mysql.connector.errors import IntegrityError

from models.categoria_model import CategoriaModel
from utils.response_utils import ResponseUtils

ICONE_CATEGORIA_PADRAO = "📌"
ICONES_CATEGORIA = frozenset(
    {
        "🛒", "🚕", "🏠", "🎮", "🎬", "📦", "💡", "📶", "🧹", "🔧",
        "🏨", "✈️", "⛽", "🅿️", "🎟️", "🏘️", "💊", "📚", "🛍️", "🐾",
        "🧾", "🍽️", "☕", "🚗", "🚌", "🏥", "💻", "📱", "👕", "⚽",
        "🏋️", "🎁", "💳", "🏦", "🧳", "🧼", "🪴", "🐶", "🐱",
        "🍕", "🥗", "🥩", "🥛", "🍔", "🍰", "🥤", "🍷", "🚲", "🚆", "🚇",
        "🛵", "🚚", "🚙", "🛏️", "🛋️", "🚿", "🧺", "🪑", "🪟", "🔌", "🚰",
        "🛜", "🦷", "👓", "🩺", "💉", "🎓", "📝", "🏀", "🎾", "🏊", "🧘",
        "🎨", "🎤", "🎧", "📷", "🧸", "🍼", "👗", "👟", "💄", "🪙", "💰",
        "🧰", "📅", "🏖️", "⛺", "🎉",
        "🥐", "🥖", "🥕", "🍜", "🍣", "🍱", "🍿", "🧴", "🧻", "🪥", "🪒",
        "💅", "💇", "🧖", "💆", "💈", "👶", "🩹", "💼", "🖨️", "💸", "💵",
        "💶", "🛡️", "🏛️", "📈", "🎵", "🎸", "🎼", "🧩", "🧶", "🏄", "⛷️",
        ICONE_CATEGORIA_PADRAO,
    }
)


class CategoriaController:
    @staticmethod
    def listar_icones(current_user_id):
        tipo = request.args.get("tipo") or None
        if tipo and tipo not in {"pessoal", "grupo"}:
            return ResponseUtils.erro("Tipo de categoria invalido.")
        return ResponseUtils.sucesso(
            dados=CategoriaModel.listar_icones(current_user_id, tipo)
        )

    @staticmethod
    def atualizar_icone_padrao(current_user_id):
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return ResponseUtils.erro("Corpo da requisicao invalido.")
        nome_value = data.get("nome")
        tipo_value = data.get("tipo")
        icone_value = data.get("icone")
        if not all(
            isinstance(value, str)
            for value in (nome_value, tipo_value, icone_value)
        ):
            return ResponseUtils.erro(
                "Nome, tipo e ícone da categoria devem ser textos."
            )
        nome = nome_value.strip()
        if not nome or len(nome) > 100:
            return ResponseUtils.erro("Nome de categoria invalido.")
        if tipo_value not in {"pessoal", "grupo"}:
            return ResponseUtils.erro("Tipo de categoria invalido.")
        if icone_value not in ICONES_CATEGORIA:
            return ResponseUtils.erro("Ícone de categoria inválido.")
        CategoriaModel.definir_icone_padrao(
            current_user_id, nome, tipo_value, icone_value
        )
        return ResponseUtils.sucesso(mensagem="Ícone de categoria atualizado.")

    @staticmethod
    def restaurar_icone_padrao(current_user_id):
        nome = request.args.get("nome", "").strip()
        tipo = request.args.get("tipo", "")
        if not nome or len(nome) > 100:
            return ResponseUtils.erro("Nome de categoria invalido.")
        if tipo not in {"pessoal", "grupo"}:
            return ResponseUtils.erro("Tipo de categoria invalido.")
        CategoriaModel.restaurar_icone_padrao(current_user_id, nome, tipo)
        return ResponseUtils.sucesso(mensagem="Ícone padrão restaurado.")

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
        icone_value = data.get("icone", ICONE_CATEGORIA_PADRAO)
        if (
            not isinstance(nome_value, str)
            or not isinstance(tipo_value, str)
            or not isinstance(icone_value, str)
        ):
            return ResponseUtils.erro(
                "Nome, tipo e ícone da categoria devem ser textos."
            )
        nome = nome_value.strip()
        tipo = tipo_value.strip().lower()
        if not nome:
            return ResponseUtils.erro("Nome da categoria eh obrigatorio.")
        if len(nome) > 100:
            return ResponseUtils.erro("Nome da categoria nao pode exceder 100 caracteres.")
        if tipo not in {"pessoal", "grupo", "ambos"}:
            return ResponseUtils.erro("Tipo de categoria invalido.")
        if icone_value not in ICONES_CATEGORIA:
            return ResponseUtils.erro("Ícone de categoria inválido.")
        if CategoriaModel.nome_em_uso(current_user_id, nome, tipo):
            return ResponseUtils.erro(
                "Já existe uma categoria com esse nome para esse tipo.",
                status=409,
            )
        try:
            item_id = CategoriaModel.criar(
                current_user_id, nome, tipo, icone_value
            )
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
        icone_value = data.get("icone", ICONE_CATEGORIA_PADRAO)
        if (
            not isinstance(nome_value, str)
            or not isinstance(tipo_value, str)
            or not isinstance(icone_value, str)
        ):
            return ResponseUtils.erro(
                "Nome, tipo e ícone da categoria devem ser textos."
            )
        nome = nome_value.strip()
        tipo = tipo_value.strip().lower()
        if not nome:
            return ResponseUtils.erro("Nome da categoria eh obrigatorio.")
        if len(nome) > 100:
            return ResponseUtils.erro("Nome da categoria nao pode exceder 100 caracteres.")
        if tipo not in {"pessoal", "grupo", "ambos"}:
            return ResponseUtils.erro("Tipo de categoria invalido.")
        if icone_value not in ICONES_CATEGORIA:
            return ResponseUtils.erro("Ícone de categoria inválido.")
        if CategoriaModel.nome_em_uso(
            current_user_id, nome, tipo, excluir_id=categoria_id
        ):
            return ResponseUtils.erro(
                "Já existe uma categoria com esse nome para esse tipo.",
                status=409,
            )
        try:
            atualizado = CategoriaModel.atualizar(
                current_user_id, categoria_id, nome, tipo, icone_value
            )
        except IntegrityError as erro:
            if erro.errno != errorcode.ER_DUP_ENTRY:
                raise
            return ResponseUtils.erro(
                "Ja existe uma categoria com esse nome para esse tipo.",
                status=409,
            )
        if atualizado == "tipo_em_uso":
            return ResponseUtils.erro(
                "Não é possível alterar o tipo de uma categoria vinculada a despesas.",
                status=409,
            )
        if not atualizado:
            return ResponseUtils.erro("Categoria nao encontrada.", status=404)
        return ResponseUtils.sucesso(mensagem="Categoria atualizada.")

    @staticmethod
    def deletar(current_user_id, categoria_id):
        try:
            resultado = CategoriaModel.deletar(current_user_id, categoria_id)
        except IntegrityError as erro:
            if erro.errno != errorcode.ER_ROW_IS_REFERENCED_2:
                raise
            return ResponseUtils.erro(
                "Não é possível excluir uma categoria que já possui despesas.",
                status=409,
            )
        if resultado is None:
            return ResponseUtils.erro("Categoria nao encontrada.", status=404)
        if resultado:
            return ResponseUtils.erro(
                "Não é possível excluir uma categoria que já possui despesas.",
                status=409,
            )
        return ResponseUtils.sucesso(mensagem="Categoria removida.")
