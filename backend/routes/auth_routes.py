from flask import Blueprint, request
from controllers.auth_controller import AuthController
from middlewares.auth_middleware import token_required
from config import Config
from utils.rate_limiter import limiter
from utils.rate_limit_keys import refresh_user_or_ip


auth_bp = Blueprint("auth_bp", __name__)

auth_bp.route("/register", methods=["POST"], endpoint="registrar_register")(
    limiter.limit(Config.RATE_LIMIT_REGISTER)(AuthController.registrar)
)
auth_bp.route("/cadastro", methods=["POST"], endpoint="registrar_cadastro")(
    limiter.limit(Config.RATE_LIMIT_REGISTER)(AuthController.registrar)
)
auth_bp.route("/login", methods=["POST"], endpoint="login")(
    limiter.limit(Config.RATE_LIMIT_LOGIN)(AuthController.login)
)
auth_bp.route("/refresh", methods=["POST"])(
    limiter.limit(
        Config.RATE_LIMIT_REFRESH,
        key_func=refresh_user_or_ip,
    )(AuthController.refresh)
)
auth_bp.route("/esqueci-senha", methods=["POST"])(
    limiter.shared_limit(
        Config.RATE_LIMIT_PASSWORD_RESET_REQUEST,
        scope="password-reset-request",
    )(AuthController.esqueci_senha)
)
auth_bp.route("/redefinir-senha", methods=["POST"])(
    limiter.shared_limit(
        Config.RATE_LIMIT_PASSWORD_RESET_CONFIRM,
        scope="password-reset-confirm",
    )(AuthController.redefinir_senha)
)


@auth_bp.route("/logout", methods=["POST"])
@token_required
def logout(current_user_id):
    token = request.headers.get("Authorization", "").split(" ", 1)[1]
    return AuthController.logout(current_user_id, token)


@auth_bp.route("/me", methods=["GET"])
@token_required
def perfil(current_user_id):
    return AuthController.perfil(current_user_id)


@auth_bp.route("/atualizar", methods=["PUT"])
@token_required
def atualizar(current_user_id):
    return AuthController.atualizar(current_user_id)


@auth_bp.route("/alterar-senha", methods=["PUT"])
@token_required
def alterar_senha(current_user_id):
    return AuthController.alterar_senha(current_user_id)


@auth_bp.route("/delete", methods=["DELETE"])
@token_required
def deletar(current_user_id):
    return AuthController.deletar(current_user_id)
