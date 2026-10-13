from flask import Blueprint
from controllers.grupo_controller import GrupoController
from middlewares.auth_middleware import token_required


grupo_bp = Blueprint("grupo_bp", __name__)


@grupo_bp.route("", methods=["POST"])
@token_required
def criar(current_user_id):
    return GrupoController.criar(current_user_id)


@grupo_bp.route("", methods=["GET"])
@token_required
def listar(current_user_id):
    return GrupoController.listar(current_user_id)


@grupo_bp.route("/<int:grupo_id>", methods=["GET"])
@token_required
def buscar(current_user_id, grupo_id):
    return GrupoController.buscar(current_user_id, grupo_id)


@grupo_bp.route("/<int:grupo_id>", methods=["PUT"])
@token_required
def atualizar(current_user_id, grupo_id):
    return GrupoController.atualizar(current_user_id, grupo_id)


@grupo_bp.route("/<int:grupo_id>", methods=["DELETE"])
@token_required
def deletar(current_user_id, grupo_id):
    return GrupoController.deletar(current_user_id, grupo_id)
