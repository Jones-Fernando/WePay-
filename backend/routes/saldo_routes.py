from flask import Blueprint
from controllers.saldo_controller import SaldoController
from middlewares.auth_middleware import token_required


saldo_bp = Blueprint("saldo_bp", __name__)


@saldo_bp.route("/grupo/<int:grupo_id>", methods=["GET"])
@token_required
def ver_saldos(current_user_id, grupo_id):
    return SaldoController.ver_saldos(current_user_id, grupo_id)
