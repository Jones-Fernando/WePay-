from flask import Blueprint
from controllers.pagamento_controller import PagamentoController
from middlewares.auth_middleware import token_required


pagamento_bp = Blueprint("pagamento_bp", __name__)


@pagamento_bp.route("", methods=["POST"])
@token_required
def criar(current_user_id):
    return PagamentoController.criar(current_user_id)


@pagamento_bp.route("/grupo/<int:grupo_id>", methods=["GET"])
@token_required
def listar(current_user_id, grupo_id):
    return PagamentoController.listar(current_user_id, grupo_id)
