from contextlib import nullcontext
from unittest.mock import Mock

from database.group_cover_icons import (
    AVAILABLE_GROUP_COVER_ICONS,
    DEFAULT_GROUP_COVER_ICONS,
    GROUP_COVER_CATALOG_MARKER,
)
from models.grupo_icone_capa_model import GrupoIconeCapaModel


class FakeCursor:
    def __init__(self):
        self.query = ""
        self.queries = []
        self.params = []

    def execute(self, query, params=()):
        self.query = " ".join(query.split())
        self.queries.append(self.query)
        self.params.append(params)

    def close(self):
        return None


def _listar_com_dados_falsos(monkeypatch, ocultos, existentes, opcoes_ativas):
    cursor = FakeCursor()
    connection = Mock()

    monkeypatch.setattr(
        "models.grupo_icone_capa_model.get_connection_context",
        lambda: nullcontext(connection),
    )
    monkeypatch.setattr(
        "models.grupo_icone_capa_model.cursor_for",
        lambda _connection: cursor,
    )

    def buscar_linhas(cursor_atual):
        if "FROM grupo_icones_capa_ocultos" in cursor_atual.query:
            return [{"icone": icone} for icone in ocultos]
        if "SELECT opcao_id FROM grupo_icones_capa_opcoes" in cursor_atual.query:
            return [{"opcao_id": opcao_id} for opcao_id in existentes]
        if "SELECT opcao_id, nome, icone, origem" in cursor_atual.query:
            return opcoes_ativas
        raise AssertionError(f"Consulta inesperada: {cursor_atual.query}")

    monkeypatch.setattr(
        "models.grupo_icone_capa_model.fetch_all",
        buscar_linhas,
    )

    resultado = GrupoIconeCapaModel.listar(12, DEFAULT_GROUP_COVER_ICONS)
    return resultado, cursor, connection


def test_listar_legacy_catalog_exposes_available_icons_without_writes(monkeypatch):
    icones_disponiveis = {
        icone for icone, _nome in AVAILABLE_GROUP_COVER_ICONS
    }
    opcoes_antigas = [
        {
            "opcao_id": icone,
            "nome": icone,
            "icone": icone,
            "origem": "padrao",
        }
        for icone in icones_disponiveis
    ]
    opcao_personalizada = {
        "opcao_id": "personalizado:abc",
        "nome": "Férias",
        "icone": "🏖️",
        "origem": "personalizado",
    }
    resultado, cursor, connection = _listar_com_dados_falsos(
        monkeypatch,
        ocultos={"✈️"},
        existentes=icones_disponiveis,
        opcoes_ativas=[*opcoes_antigas, opcao_personalizada],
    )

    icones_visiveis = {
        opcao["icone"]
        for opcao in resultado["icones"]
        if opcao["origem"] == "padrao"
    }
    assert icones_visiveis == icones_disponiveis - {"✈️"}
    assert resultado["ocultos"] == sorted(icones_disponiveis - icones_visiveis)
    assert any(
        opcao["id"] == opcao_personalizada["opcao_id"]
        and opcao["nome"] == opcao_personalizada["nome"]
        and opcao["icone"] == opcao_personalizada["icone"]
        and opcao["origem"] == "personalizado"
        for opcao in resultado["icones"]
    )
    assert all(query.startswith("SELECT ") for query in cursor.queries)
    connection.commit.assert_not_called()


def test_substituir_ocultos_persists_catalog_marker(monkeypatch):
    cursor = FakeCursor()
    connection = Mock()
    monkeypatch.setattr(
        "models.grupo_icone_capa_model.get_connection_context",
        lambda: nullcontext(connection),
    )
    monkeypatch.setattr(
        "models.grupo_icone_capa_model.cursor_for",
        lambda _connection: cursor,
    )

    GrupoIconeCapaModel.substituir_ocultos(
        12,
        {"✈️"},
        DEFAULT_GROUP_COVER_ICONS,
    )

    assert GROUP_COVER_CATALOG_MARKER in cursor.params[-1]
    assert cursor.params[-1][0] == 12
    connection.commit.assert_called_once_with()


def test_listar_initialized_catalog_reads_saved_visibility_without_writes(monkeypatch):
    icones_disponiveis = {
        icone for icone, _nome in AVAILABLE_GROUP_COVER_ICONS
    }
    icone_oculto = "✈️"
    opcoes_ativas = [
        {
            "opcao_id": icone,
            "nome": icone,
            "icone": icone,
            "origem": "padrao",
        }
        for icone in icones_disponiveis - {icone_oculto}
    ]
    resultado, cursor, connection = _listar_com_dados_falsos(
        monkeypatch,
        ocultos={icone_oculto},
        existentes=icones_disponiveis | {GROUP_COVER_CATALOG_MARKER},
        opcoes_ativas=opcoes_ativas,
    )

    icones_visiveis = {
        opcao["icone"]
        for opcao in resultado["icones"]
        if opcao["origem"] == "padrao"
    }
    assert icones_visiveis == icones_disponiveis - {icone_oculto}
    assert resultado["ocultos"] == [icone_oculto]
    assert all(query.startswith("SELECT ") for query in cursor.queries)
    connection.commit.assert_not_called()


def test_listar_adds_new_icons_to_existing_catalog_without_overriding_hidden_icons(
    monkeypatch,
):
    icons_available = {
        icone for icone, _nome in AVAILABLE_GROUP_COVER_ICONS
    }
    new_icons = {
        "🚕",
        "🚇",
        "🚢",
        "🛥️",
        "🏡",
        "🏢",
        "🏬",
        "🧾",
        "🧺",
        "🪑",
        "🧰",
        "🧯",
        "🧼",
        "💳",
        "🏦",
        "🖨️",
        "🎭",
        "🎧",
        "🎹",
        "🧪",
        "🐠",
        "🌳",
        "🌷",
        "🍼",
        "🧩",
    }
    hidden_icon = "✈️"
    icons_previously_saved = icons_available - new_icons
    active_options = [
        {
            "opcao_id": icone,
            "nome": icone,
            "icone": icone,
            "origem": "padrao",
        }
        for icone in icons_previously_saved - {hidden_icon}
    ]

    resultado, _cursor, connection = _listar_com_dados_falsos(
        monkeypatch,
        ocultos={hidden_icon},
        existentes=icons_previously_saved | {GROUP_COVER_CATALOG_MARKER},
        opcoes_ativas=active_options,
    )

    visible_icons = {
        opcao["icone"]
        for opcao in resultado["icones"]
        if opcao["origem"] == "padrao"
    }
    assert new_icons <= visible_icons
    assert hidden_icon not in visible_icons
    assert resultado["ocultos"] == [hidden_icon]
    connection.commit.assert_not_called()
