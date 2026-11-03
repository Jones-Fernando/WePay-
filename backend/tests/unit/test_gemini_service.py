from services.gemini_service import normalizar_recibo


def test_normalizar_recibo_mantem_categoria_adicionada():
    recibo = normalizar_recibo({"categoria_sugerida": "Mercado"})

    assert recibo["categoria_sugerida"] == "Mercado"


def test_normalizar_recibo_usa_outros_para_categoria_desconhecida():
    recibo = normalizar_recibo({"categoria_sugerida": "Categoria desconhecida"})

    assert recibo["categoria_sugerida"] == "Outros"
