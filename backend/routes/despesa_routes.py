from flask import Blueprint
from controllers.despesa_controller import DespesaController
from middlewares.auth_middleware import token_required


despesa_bp = Blueprint("despesa_bp", __name__)


@despesa_bp.route("", methods=["POST"])
@token_required
def criar(current_user_id):
    return DespesaController.criar(current_user_id)


@despesa_bp.route("/grupo/<int:grupo_id>", methods=["GET"])
@token_required
def listar(current_user_id, grupo_id):
    return DespesaController.listar(current_user_id, grupo_id)


@despesa_bp.route("/<int:despesa_id>", methods=["GET"])
@token_required
def detalhes(current_user_id, despesa_id):
    return DespesaController.detalhes(current_user_id, despesa_id)


@despesa_bp.route("/<int:despesa_id>", methods=["PUT"])
@token_required
def atualizar(current_user_id, despesa_id):
    return DespesaController.atualizar(current_user_id, despesa_id)


@despesa_bp.route("/<int:despesa_id>", methods=["DELETE"])
@token_required
def deletar(current_user_id, despesa_id):
    return DespesaController.deletar(current_user_id, despesa_id)
