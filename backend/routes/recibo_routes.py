
from flask import Blueprint, request

from middlewares.auth_middleware import token_required
from services.gemini_service import (
    ler_recibo,
    GeminiReceiptError,
)
from utils.response_utils import ResponseUtils


recibo_bp = Blueprint("recibo_bp", __name__)

TIPOS_PERMITIDOS = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

TAMANHO_MAXIMO = 8 * 1024 * 1024


@recibo_bp.route("/ler", methods=["POST"])
@token_required
def ler(current_user_id):
    if "imagem" not in request.files:
        return ResponseUtils.erro(
            "Envie uma imagem no campo 'imagem'.",
            status=400,
        )

    arquivo = request.files["imagem"]

    if not arquivo.filename:
        return ResponseUtils.erro(
            "Selecione uma imagem para leitura.",
            status=400,
        )

    if arquivo.mimetype not in TIPOS_PERMITIDOS:
        return ResponseUtils.erro(
            "Formato inválido. Use JPEG, PNG ou WEBP.",
            status=400,
        )

    imagem = arquivo.read(TAMANHO_MAXIMO + 1)

    if not imagem:
        return ResponseUtils.erro(
            "O arquivo enviado está vazio.",
            status=400,
        )

    if len(imagem) > TAMANHO_MAXIMO:
        return ResponseUtils.erro(
            "A imagem deve ter no máximo 8 MB.",
            status=413,
        )

    try:
        dados = ler_recibo(imagem, arquivo.mimetype)

        return ResponseUtils.sucesso(
            dados=dados,
            mensagem="Recibo analisado. Revise os dados antes de confirmar.",
        )

    except GeminiReceiptError as erro:
        return ResponseUtils.erro(str(erro), status=502)
