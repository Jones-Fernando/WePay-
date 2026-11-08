"""Testes de tratamento de erros ao criar categorias."""

import pytest
from flask import Flask

from controllers.categoria_controller import CategoriaController


def test_criacao_repropaga_erro_de_banco_inesperado(monkeypatch):
    def falhar(*_args):
        raise RuntimeError("Falha de conexão com o banco.")

    monkeypatch.setattr(
        "controllers.categoria_controller.CategoriaModel.criar",
        falhar,
    )

    with Flask(__name__).test_request_context(
        "/api/categorias",
        method="POST",
        json={"nome": "Viagem"},
    ):
        with pytest.raises(RuntimeError, match="Falha de conexão"):
            CategoriaController.criar(1)


@pytest.mark.parametrize(
    "payload",
    [[], {"nome": ["Viagem"]}, {"nome": "x" * 101}],
)
def test_categoria_rejeita_corpo_ou_nome_invalido(payload):
    with Flask(__name__).test_request_context(
        "/api/categorias",
        method="POST",
        json=payload,
    ):
        response, status = CategoriaController.criar(1)

    assert status == 400
