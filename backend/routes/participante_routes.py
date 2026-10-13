from flask import Blueprint
from controllers.participante_controller import ParticipanteController
from middlewares.auth_middleware import token_required


participante_bp = Blueprint("participante_bp", __name__)


@participante_bp.route("", methods=["POST"])
@token_required
def adicionar(current_user_id):
    return ParticipanteController.adicionar(current_user_id)


@participante_bp.route("/grupo/<int:grupo_id>", methods=["GET"])
@token_required
def listar(current_user_id, grupo_id):
    return ParticipanteController.listar(current_user_id, grupo_id)


@participante_bp.route("/<int:participante_id>", methods=["GET"])
@token_required
def buscar(current_user_id, participante_id):
    return ParticipanteController.buscar(current_user_id, participante_id)


@participante_bp.route("/<int:participante_id>", methods=["PUT"])
@token_required
def atualizar(current_user_id, participante_id):
    return ParticipanteController.atualizar(current_user_id, participante_id)


@participante_bp.route("/<int:participante_id>", methods=["DELETE"])
@token_required
def remover(current_user_id, participante_id):
    return ParticipanteController.remover(current_user_id, participante_id)


@participante_bp.route("/convite", methods=["POST"])
@token_required
def convidar(current_user_id):
    return ParticipanteController.convidar(current_user_id)


@participante_bp.route("/convite/aceitar", methods=["POST"])
@token_required
def aceitar_convite(current_user_id):
    return ParticipanteController.aceitar_convite(current_user_id)
