import pytest

from config import Config
from services.gemini_service import (
    GeminiReceiptError,
    GeminiUnavailableError,
    ler_recibo,
)
from services.gemini_service import normalizar_recibo


def test_normalizar_recibo_mantem_categoria_adicionada():
    recibo = normalizar_recibo({"categoria_sugerida": "Mercado"})

    assert recibo["categoria_sugerida"] == "Mercado"


def test_normalizar_recibo_usa_outros_para_categoria_desconhecida():
    recibo = normalizar_recibo({"categoria_sugerida": "Categoria desconhecida"})

    assert recibo["categoria_sugerida"] == "Outros"


def test_normalizar_recibo_converte_valores_validos():
    resultado = normalizar_recibo(
        {
            "estabelecimento": "  Mercado Central  ",
            "data": "2026-11-08",
            "valor_total": "R$ 1.234,56",
            "categoria_sugerida": "Mercado",
        }
    )

    assert resultado == {
        "estabelecimento": "Mercado Central",
        "data": "2026-11-08",
        "valor_total": 1234.56,
        "moeda": "BRL",
        "categoria_sugerida": "Mercado",
    }


@pytest.mark.parametrize("valor", [None, "valor inválido", 0, -5])
def test_normalizar_recibo_descarta_valores_invalidos(valor):
    resultado = normalizar_recibo(
        {
            "estabelecimento": " ",
            "data": "08/11/2026",
            "valor_total": valor,
            "categoria_sugerida": "Categoria desconhecida",
        }
    )

    assert resultado == {
        "estabelecimento": None,
        "data": None,
        "valor_total": None,
        "moeda": "BRL",
        "categoria_sugerida": "Outros",
    }


def test_ler_recibo_exige_chave_de_api(monkeypatch):
    monkeypatch.setattr(Config, "GEMINI_API_KEY", "")
    monkeypatch.setattr(
        "services.gemini_service.genai.Client",
        lambda **_kwargs: pytest.fail(
            "Client must not be created without an API key."
        ),
    )

    with pytest.raises(GeminiUnavailableError, match="não está configurada"):
        ler_recibo(b"image-bytes", "image/jpeg")


def test_ler_recibo_envia_imagem_e_normaliza_resposta(monkeypatch):
    chamadas = []

    class FakeModels:
        def generate_content(self, **kwargs):
            chamadas.append(kwargs)
            return type(
                "GeminiResponse",
                (),
                {
                    "text": (
                        '{"estabelecimento":" Padaria ","data":"2026-11-08",'
                        '"valor_total":"18,50","categoria_sugerida":"Alimentação"}'
                    )
                },
            )()

    class FakeClient:
        def __init__(self, *, api_key):
            chamadas.append({"api_key": api_key})
            self.models = FakeModels()

    monkeypatch.setattr(Config, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(Config, "GEMINI_MODEL", "test-model")
    monkeypatch.setattr("services.gemini_service.genai.Client", FakeClient)

    resultado = ler_recibo(b"image-bytes", "image/jpeg")

    assert resultado == {
        "estabelecimento": "Padaria",
        "data": "2026-11-08",
        "valor_total": 18.5,
        "moeda": "BRL",
        "categoria_sugerida": "Alimentação",
    }
    assert chamadas[0] == {"api_key": "test-key"}
    requisicao = chamadas[1]
    assert requisicao["model"] == "test-model"
    assert requisicao["contents"][0].inline_data.data == b"image-bytes"
    assert requisicao["contents"][0].inline_data.mime_type == "image/jpeg"
    assert requisicao["config"].response_mime_type == "application/json"
    assert requisicao["config"].temperature == 0


def test_ler_recibo_registra_metricas_por_usuario(monkeypatch, caplog):
    caplog.set_level("INFO")
    metricas = []
    monkeypatch.setattr(
        "services.gemini_service.GeminiUsageModel.registrar_solicitacao",
        lambda usuario_id, modelo, tamanho: metricas.append(
            (usuario_id, modelo, tamanho)
        ),
    )

    class FakeModels:
        def generate_content(self, **_kwargs):
            return type(
                "GeminiResponse",
                (),
                {"text": '{"valor_total":12.5}'},
            )()

    class FakeClient:
        def __init__(self, **_kwargs):
            self.models = FakeModels()

    monkeypatch.setattr(Config, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(Config, "GEMINI_MODEL", "test-model")
    monkeypatch.setattr("services.gemini_service.genai.Client", FakeClient)

    resultado = ler_recibo(b"image-bytes", "image/jpeg", usuario_id=42)

    assert resultado["valor_total"] == 12.5
    assert metricas == [(42, "test-model", len(b"image-bytes"))]
    assert any(
        getattr(record, "event", None) == "gemini_receipt_usage"
        and record.outcome == "sucesso"
        for record in caplog.records
    )


@pytest.mark.parametrize(
    ("text", "message"),
    [
        ("", "A IA não retornou dados"),
        ("[]", "formato inválido"),
        ("{invalid", "interpretar os dados"),
    ],
)
def test_ler_recibo_rejeita_respostas_invalidas(monkeypatch, text, message):
    class FakeModels:
        def generate_content(self, **_kwargs):
            return type("GeminiResponse", (), {"text": text})()

    class FakeClient:
        def __init__(self, **_kwargs):
            self.models = FakeModels()

    monkeypatch.setattr(Config, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("services.gemini_service.genai.Client", FakeClient)

    with pytest.raises(GeminiReceiptError, match=message):
        ler_recibo(b"image-bytes", "image/jpeg")


def test_ler_recibo_wraps_unexpected_client_errors(monkeypatch):
    class FakeModels:
        def generate_content(self, **_kwargs):
            raise RuntimeError("provider unavailable")

    class FakeClient:
        def __init__(self, **_kwargs):
            self.models = FakeModels()

    monkeypatch.setattr(Config, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr("services.gemini_service.genai.Client", FakeClient)

    with pytest.raises(GeminiReceiptError, match="Não foi possível processar"):
        ler_recibo(b"image-bytes", "image/jpeg")
