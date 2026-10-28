
import json
from datetime import datetime

from google import genai
from google.genai import types

from config import Config


class GeminiReceiptError(Exception):
    """Erro controlado durante a leitura do recibo."""


class GeminiUnavailableError(GeminiReceiptError):
    """A integração externa não está configurada ou disponível."""


CATEGORIAS = {"Alimentação", "Transporte", "Casa", "Lazer", "Assinatura", "Outros"}


def normalizar_recibo(dados: dict) -> dict:
    estabelecimento = dados.get("estabelecimento")
    categoria = dados.get("categoria_sugerida")
    data = dados.get("data")
    valor = dados.get("valor_total")
    try:
        texto_valor = str(valor).replace("R$", "").strip()
        if "," in texto_valor and "." in texto_valor:
            texto_valor = texto_valor.replace(".", "").replace(",", ".")
        elif "," in texto_valor:
            texto_valor = texto_valor.replace(",", ".")
        valor = float(texto_valor) if valor is not None else None
    except (TypeError, ValueError):
        valor = None
    if valor is not None and valor <= 0:
        valor = None
    if isinstance(data, str):
        try:
            data = datetime.strptime(data.strip(), "%Y-%m-%d").date().isoformat()
        except ValueError:
            data = None
    else:
        data = None
    return {
        "estabelecimento": estabelecimento.strip() if isinstance(estabelecimento, str) and estabelecimento.strip() else None,
        "data": data,
        "valor_total": valor,
        "moeda": "BRL",
        "categoria_sugerida": categoria if categoria in CATEGORIAS else "Outros",
    }


def ler_recibo(imagem: bytes, mime_type: str) -> dict:
    api_key = Config.GEMINI_API_KEY
    model = Config.GEMINI_MODEL

    if not api_key:
        raise GeminiUnavailableError(
            "A chave da API do Gemini não está configurada."
        )

    prompt = """
    Analise a imagem de um recibo ou comprovante de compra.

    Extraia somente informações visíveis na imagem.
    Não invente dados ausentes ou ilegíveis.

    Responda exclusivamente em JSON válido, com esta estrutura:
    {
      "estabelecimento": "nome ou null",
      "data": "AAAA-MM-DD ou null",
      "valor_total": 0.00,
      "moeda": "BRL",
      "itens": [
        {
          "descricao": "nome do item",
          "quantidade": 1,
          "valor_unitario": 0.00,
          "valor_total": 0.00
        }
      ],
      "categoria_sugerida": "categoria ou null"
    }

    Use null quando um campo não puder ser identificado.
    Não confunda subtotal, valor pago e troco com o valor total.
    Se houver dúvida sobre um valor, retorne null nesse campo.
    A categoria deve ser apenas uma sugestão.
    Não execute ações nem cadastre despesas.
    """

    try:
        client = genai.Client(api_key=api_key)

        resposta = client.models.generate_content(
            model=model,
            contents=[
                types.Part.from_bytes(
                    data=imagem,
                    mime_type=mime_type,
                ),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0,
            ),
        )

        if not resposta.text:
            raise GeminiReceiptError(
                "A IA não retornou dados para o recibo."
            )

        dados = json.loads(resposta.text)

        if not isinstance(dados, dict):
            raise GeminiReceiptError(
                "A resposta da IA está em formato inválido."
            )

        return normalizar_recibo(dados)

    except GeminiReceiptError:
        raise
    except json.JSONDecodeError as erro:
        raise GeminiReceiptError(
            "Não foi possível interpretar os dados do recibo."
        ) from erro
    except Exception as erro:
        raise GeminiReceiptError(
            "Não foi possível processar o recibo. Tente novamente."
        ) from erro
