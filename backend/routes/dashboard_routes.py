from flask import Blueprint
from controllers.dashboard_controller import DashboardController
from middlewares.auth_middleware import token_required


dashboard_bp = Blueprint("dashboard_bp", __name__)


@dashboard_bp.route("", methods=["GET"])
@token_required
def obter_dados(current_user_id):
    return DashboardController.obter_dados(current_user_id)
