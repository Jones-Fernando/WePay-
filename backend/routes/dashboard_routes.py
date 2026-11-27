from flask import Blueprint
from controllers.dashboard_controller import DashboardController
from middlewares.auth_middleware import token_required


dashboard_bp = Blueprint("dashboard_bp", __name__)


@dashboard_bp.route("", methods=["GET"])
@token_required
def obter_dados(current_user_id):
    return DashboardController.obter_dados(current_user_id)


@dashboard_bp.route("/pendencias", methods=["GET"])
@token_required
def obter_pendencias(current_user_id):
    return DashboardController.obter_pendencias(current_user_id)
