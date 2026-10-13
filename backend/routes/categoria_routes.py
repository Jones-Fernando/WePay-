from flask import Blueprint
from controllers.categoria_controller import CategoriaController
from middlewares.auth_middleware import token_required


categoria_bp = Blueprint("categoria_bp", __name__)


@categoria_bp.route("", methods=["GET"])
@token_required
def listar(current_user_id):
    return CategoriaController.listar(current_user_id)


@categoria_bp.route("", methods=["POST"])
@token_required
def criar(current_user_id):
    return CategoriaController.criar(current_user_id)


@categoria_bp.route("/<int:categoria_id>", methods=["PUT"])
@token_required
def atualizar(current_user_id, categoria_id):
    return CategoriaController.atualizar(current_user_id, categoria_id)


@categoria_bp.route("/<int:categoria_id>", methods=["DELETE"])
@token_required
def deletar(current_user_id, categoria_id):
    return CategoriaController.deletar(current_user_id, categoria_id)
