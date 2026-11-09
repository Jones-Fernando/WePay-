
from flask import Blueprint, request

from config import Config
from middlewares.auth_middleware import token_required
from services.gemini_service import (
    ler_recibo,
    GeminiReceiptError,
    GeminiUnavailableError,
    normalizar_recibo,
)
from utils.response_utils import ResponseUtils
from utils.rate_limiter import limiter
from utils.rate_limit_keys import authenticated_user_or_ip


recibo_bp = Blueprint("recibo_bp", __name__)

TIPOS_PERMITIDOS = {
    "image/jpeg",
    "image/png",
    "image/webp",
}

TAMANHO_MAXIMO = 8 * 1024 * 1024


def assinatura_imagem_valida(imagem: bytes, mime_type: str) -> bool:
    if mime_type == "image/jpeg":
        return imagem.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return imagem.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return imagem.startswith(b"RIFF") and imagem[8:12] == b"WEBP"
    return False


@recibo_bp.route("/ler", methods=["POST"])
@token_required
@limiter.limit(
    Config.RATE_LIMIT_RECEIPT_HOURLY,
    key_func=authenticated_user_or_ip,
)
@limiter.limit(
    Config.RATE_LIMIT_RECEIPT_DAILY,
    key_func=authenticated_user_or_ip,
)
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
    if not assinatura_imagem_valida(imagem, arquivo.mimetype):
        return ResponseUtils.erro(
            "O conteúdo do arquivo não corresponde a uma imagem JPEG, PNG ou WEBP.",
            status=400,
        )

    try:
        dados = normalizar_recibo(
            ler_recibo(imagem, arquivo.mimetype, current_user_id)
        )

        return ResponseUtils.sucesso(
            dados=dados,
            mensagem="Recibo analisado. Revise os dados antes de confirmar.",
        )

    except GeminiUnavailableError as erro:
        return ResponseUtils.erro(str(erro), status=503)
    except GeminiReceiptError as erro:
        return ResponseUtils.erro(str(erro), status=502)
