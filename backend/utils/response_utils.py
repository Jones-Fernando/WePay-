from decimal import Decimal
from flask import jsonify


def _json_safe(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(item) for item in value]
    return value


class ResponseUtils:
    @staticmethod
    def sucesso(dados=None, mensagem=None, status=200):
        resposta = {"status": "sucesso"}
        if mensagem:
            resposta["mensagem"] = mensagem
            resposta["message"] = mensagem
        if dados is not None:
            resposta["data"] = _json_safe(dados)
        return jsonify(resposta), status

    @staticmethod
    def erro(mensagem, status=400):
        texto = str(mensagem).replace('"', "").replace("'", "")
        return jsonify({"status": "erro", "mensagem": texto, "message": texto}), status
