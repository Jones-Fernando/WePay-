from flask import Blueprint
from controllers.grupo_controller import GrupoController
from middlewares.auth_middleware import token_required


grupo_bp = Blueprint("grupo_bp", __name__)


@grupo_bp.route("/icones-capa", methods=["GET"])
@token_required
def listar_icones_capa(current_user_id):
    return GrupoController.listar_icones_capa(current_user_id)


@grupo_bp.route("/icones-capa", methods=["POST"])
@token_required
def criar_icone_capa(current_user_id):
    return GrupoController.criar_icone_capa(current_user_id)


@grupo_bp.route("/icones-capa", methods=["PUT"])
@token_required
def atualizar_icones_capa(current_user_id):
    return GrupoController.atualizar_icones_capa(current_user_id)


@grupo_bp.route("/icones-capa/<string:opcao_id>", methods=["PUT"])
@token_required
def atualizar_icone_capa(current_user_id, opcao_id):
    return GrupoController.atualizar_icone_capa(current_user_id, opcao_id)


@grupo_bp.route("/icones-capa/<string:opcao_id>", methods=["DELETE"])
@token_required
def excluir_icone_capa(current_user_id, opcao_id):
    return GrupoController.excluir_icone_capa(current_user_id, opcao_id)


@grupo_bp.route("/icones-capa/restaurar", methods=["POST"])
@token_required
def restaurar_catalogo_icones_capa(current_user_id):
    return GrupoController.restaurar_catalogo_icones_capa(current_user_id)


@grupo_bp.route("/icones-capa", methods=["DELETE"])
@token_required
def restaurar_icones_capa(current_user_id):
    return GrupoController.restaurar_icones_capa(current_user_id)


@grupo_bp.route("", methods=["POST"])
@token_required
def criar(current_user_id):
    return GrupoController.criar(current_user_id)


@grupo_bp.route("", methods=["GET"])
@token_required
def listar(current_user_id):
    return GrupoController.listar(current_user_id)


@grupo_bp.route("/<int:grupo_id>", methods=["GET"])
@token_required
def buscar(current_user_id, grupo_id):
    return GrupoController.buscar(current_user_id, grupo_id)


@grupo_bp.route("/<int:grupo_id>", methods=["PUT"])
@token_required
def atualizar(current_user_id, grupo_id):
    return GrupoController.atualizar(current_user_id, grupo_id)


@grupo_bp.route("/<int:grupo_id>", methods=["DELETE"])
@token_required
def deletar(current_user_id, grupo_id):
    return GrupoController.deletar(current_user_id, grupo_id)
