from flask import Blueprint
from controllers.usuario_controller import UsuarioController
from middlewares.auth_middleware import token_required


usuario_bp = Blueprint("usuario_bp", __name__)


@usuario_bp.route("/recover", methods=["POST"])
def recuperar_senha_alias():
    return UsuarioController.recuperar_senha()


@usuario_bp.route("/recuperar-senha", methods=["POST"])
def recuperar_senha():
    return UsuarioController.recuperar_senha()


@usuario_bp.route("/recuperar-senha/confirmar", methods=["POST"])
def confirmar_recuperacao():
    return UsuarioController.confirmar_recuperacao()


@usuario_bp.route("/update", methods=["POST", "PUT"])
@token_required
def atualizar_senha_legacy(current_user_id):
    from controllers.auth_controller import AuthController
    return AuthController.alterar_senha(current_user_id)


@usuario_bp.route("/test-email", methods=["POST"])
@token_required
def testar_email(current_user_id):
    return UsuarioController.testar_email(current_user_id)


@usuario_bp.route("", methods=["GET"])
@token_required
def listar(current_user_id):
    return UsuarioController.listar()
