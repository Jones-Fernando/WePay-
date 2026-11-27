from contextlib import nullcontext
from unittest.mock import Mock

import pytest
from flask import Flask

from controllers.grupo_controller import GrupoController
from database.group_cover_icons import (
    AVAILABLE_GROUP_COVER_ICONS,
    DEFAULT_GROUP_COVER_ICONS,
    GROUP_COVER_ICON_VALUES,
)


def test_default_group_cover_catalog_is_curated_and_customizable():
    default_icons = {
        icone for icone, _nome in DEFAULT_GROUP_COVER_ICONS
    }

    assert 12 <= len(DEFAULT_GROUP_COVER_ICONS) <= 20
    assert len(default_icons) == len(DEFAULT_GROUP_COVER_ICONS)
    assert {"👥", "✈️", "🏠"} <= default_icons
    assert "🚿" not in default_icons
    assert "🚿" in GROUP_COVER_ICON_VALUES
    assert {"🚇", "🧾", "💳", "🎭", "🧩"} <= GROUP_COVER_ICON_VALUES
    assert {"🌲", "🏝️", "🌊", "🏞️", "🦋"} <= GROUP_COVER_ICON_VALUES
    available_icons = {
        icone for icone, _nome in AVAILABLE_GROUP_COVER_ICONS
    }
    assert available_icons == GROUP_COVER_ICON_VALUES


def test_group_creation_persists_selected_cover_icon(monkeypatch):
    connection = Mock()
    persisted = []
    monkeypatch.setattr(
        "controllers.grupo_controller.get_connection_context",
        lambda: nullcontext(connection),
    )
    monkeypatch.setattr(
        "controllers.grupo_controller.GrupoModel.criar",
        lambda *args, **kwargs: persisted.append((args, kwargs)) or 31,
    )
    monkeypatch.setattr(
        "controllers.grupo_controller.ParticipanteModel.adicionar",
        lambda *_args: None,
    )

    with Flask(__name__).test_request_context(
        "/api/grupos",
        method="POST",
        json={"nome": "Viagem", "icone": "✈️"},
    ):
        response, status = GrupoController.criar(10)

    assert status == 201
    assert response.get_json()["data"] == {"id": 31}
    assert persisted == [
        (
            ("Viagem", None, 10),
            {"conn": connection, "icone": "✈️"},
        )
    ]
    connection.commit.assert_called_once_with()


def test_group_creation_rejects_unavailable_cover_icon():
    with Flask(__name__).test_request_context(
        "/api/grupos",
        method="POST",
        json={"nome": "Viagem", "icone": "🔮"},
    ):
        response, status = GrupoController.criar(10)

    assert status == 400
    assert response.get_json()["status"] == "erro"


@pytest.mark.parametrize(
    "payload",
    [
        [],
        {"nome": "", "icone": "✈️"},
        {"nome": "x" * 61, "icone": "✈️"},
        {"nome": "Invalido", "icone": "🔮"},
    ],
)
def test_group_cover_icon_creation_rejects_invalid_data(payload, monkeypatch):
    monkeypatch.setattr(
        "controllers.grupo_controller.GrupoIconeCapaModel.criar",
        lambda *_args: pytest.fail("Invalid icon options must not be persisted."),
    )

    with Flask(__name__).test_request_context(
        "/api/grupos/icones-capa",
        method="POST",
        json=payload,
    ):
        response, status = GrupoController.criar_icone_capa(10)

    assert status == 400
    assert response.get_json()["status"] == "erro"


def test_group_cover_icon_creation_persists_for_current_user(monkeypatch):
    persisted = []
    monkeypatch.setattr(
        "controllers.grupo_controller.GrupoIconeCapaModel.criar",
        lambda *args: persisted.append(args) or "personalizado:abc",
    )

    with Flask(__name__).test_request_context(
        "/api/grupos/icones-capa",
        method="POST",
        json={"nome": " Férias ", "icone": "🏖️"},
    ):
        response, status = GrupoController.criar_icone_capa(10)

    assert status == 201
    assert response.get_json()["data"] == {"id": "personalizado:abc"}
    assert persisted == [(10, "Férias", "🏖️")]


def test_group_cover_icon_edit_and_delete_are_scoped_to_owner(monkeypatch):
    updates = []
    deletes = []
    monkeypatch.setattr(
        "controllers.grupo_controller.GrupoIconeCapaModel.atualizar",
        lambda *args: updates.append(args) or False,
    )
    monkeypatch.setattr(
        "controllers.grupo_controller.GrupoIconeCapaModel.excluir",
        lambda *args: deletes.append(args) or False,
    )

    with Flask(__name__).test_request_context(
        "/api/grupos/icones-capa/personalizado:abc",
        method="PUT",
        json={"nome": "Férias", "icone": "✈️"},
    ):
        update_response, update_status = GrupoController.atualizar_icone_capa(
            20, "personalizado:abc"
        )
    with Flask(__name__).test_request_context(
        "/api/grupos/icones-capa/personalizado:abc",
        method="DELETE",
    ):
        delete_response, delete_status = GrupoController.excluir_icone_capa(
            20, "personalizado:abc"
        )

    assert update_status == 404
    assert update_response.get_json()["status"] == "erro"
    assert delete_status == 404
    assert delete_response.get_json()["status"] == "erro"
    assert updates == [(20, "personalizado:abc", "Férias", "✈️")]
    assert deletes == [(20, "personalizado:abc")]


def test_restoring_group_cover_catalog_keeps_model_defaults(monkeypatch):
    restored = []
    monkeypatch.setattr(
        "controllers.grupo_controller.GrupoIconeCapaModel.restaurar_visibilidade",
        lambda *args: restored.append(args),
    )

    with Flask(__name__).test_request_context():
        response, status = GrupoController.restaurar_catalogo_icones_capa(10)

    assert status == 200
    assert response.get_json()["status"] == "sucesso"
    assert restored == [
        (10, DEFAULT_GROUP_COVER_ICONS, AVAILABLE_GROUP_COVER_ICONS)
    ]
