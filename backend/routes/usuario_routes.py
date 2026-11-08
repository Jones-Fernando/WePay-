from flask import Blueprint
from config import Config
from controllers.auth_controller import AuthController
from controllers.usuario_controller import UsuarioController
from middlewares.auth_middleware import token_required
from utils.rate_limiter import limiter


usuario_bp = Blueprint("usuario_bp", __name__)


_limite_solicitacao = limiter.shared_limit(
    Config.RATE_LIMIT_PASSWORD_RESET_REQUEST,
    scope="password-reset-request",
)
_limite_confirmacao = limiter.shared_limit(
    Config.RATE_LIMIT_PASSWORD_RESET_CONFIRM,
    scope="password-reset-confirm",
)
usuario_bp.add_url_rule(
    "/recover",
    endpoint="recuperar_senha_alias",
    view_func=_limite_solicitacao(AuthController.esqueci_senha),
    methods=["POST"],
)
usuario_bp.add_url_rule(
    "/recuperar-senha",
    endpoint="recuperar_senha",
    view_func=_limite_solicitacao(AuthController.esqueci_senha),
    methods=["POST"],
)
usuario_bp.add_url_rule(
    "/recuperar-senha/confirmar",
    endpoint="confirmar_recuperacao",
    view_func=_limite_confirmacao(AuthController.redefinir_senha),
    methods=["POST"],
)


@usuario_bp.route("/update", methods=["POST", "PUT"])
@token_required
def atualizar_senha_legacy(current_user_id):
    from controllers.auth_controller import AuthController
    return AuthController.alterar_senha(current_user_id)


@usuario_bp.route("/test-email", methods=["POST"])
@token_required
def testar_email(current_user_id):
    return UsuarioController.testar_email(current_user_id)
