from flask import Blueprint
from controllers.despesa_pessoal_controller import DespesaPessoalController
from middlewares.auth_middleware import token_required


despesa_pessoal_bp = Blueprint("despesa_pessoal_bp", __name__)


@despesa_pessoal_bp.route("", methods=["POST"])
@token_required
def criar(current_user_id):
    return DespesaPessoalController.criar(current_user_id)


@despesa_pessoal_bp.route("", methods=["GET"])
@token_required
def listar(current_user_id):
    return DespesaPessoalController.listar(current_user_id)


@despesa_pessoal_bp.route("/<int:despesa_id>", methods=["GET"])
@token_required
def detalhes(current_user_id, despesa_id):
    return DespesaPessoalController.detalhes(current_user_id, despesa_id)


@despesa_pessoal_bp.route("/total-mes", methods=["GET"])
@token_required
def total_mes(current_user_id):
    return DespesaPessoalController.total_mes(current_user_id)


@despesa_pessoal_bp.route("/<int:despesa_id>", methods=["PUT"])
@token_required
def atualizar(current_user_id, despesa_id):
    return DespesaPessoalController.atualizar(current_user_id, despesa_id)


@despesa_pessoal_bp.route("/<int:despesa_id>", methods=["DELETE"])
@token_required
def deletar(current_user_id, despesa_id):
    return DespesaPessoalController.deletar(current_user_id, despesa_id)
