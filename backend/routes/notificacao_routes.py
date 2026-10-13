from flask import Blueprint
from controllers.notificacao_controller import NotificacaoController
from middlewares.auth_middleware import token_required


notificacao_bp = Blueprint("notificacao_bp", __name__)


@notificacao_bp.route("", methods=["GET"])
@token_required
def listar(current_user_id):
    return NotificacaoController.listar(current_user_id)


@notificacao_bp.route("/<int:notificacao_id>/ler", methods=["PUT"])
@token_required
def marcar_lida(current_user_id, notificacao_id):
    return NotificacaoController.marcar_lida(current_user_id, notificacao_id)
