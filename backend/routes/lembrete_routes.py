from flask import Blueprint
from controllers.lembrete_controller import LembreteController
from middlewares.auth_middleware import token_required


lembrete_bp = Blueprint("lembrete_bp", __name__)


@lembrete_bp.route("", methods=["GET"])
@token_required
def listar(current_user_id):
    return LembreteController.listar(current_user_id)
